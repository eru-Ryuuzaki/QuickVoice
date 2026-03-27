import { NextResponse } from "next/server";

import { transcribeAudio } from "@/server/core/transcribe-audio";
import { AppError, isAppError } from "@/server/platform/errors";
import {
  createRateLimiter,
  type RateLimiter,
} from "@/server/platform/rate-limit";
import { createProviderRegistry } from "@/server/providers/provider-registry";
import { createSiliconFlowSttProvider } from "@/server/providers/stt/siliconflow";
import { createVoskSttProvider } from "@/server/providers/stt/vosk";
import {
  isSttProviderId,
  type PublicProviderStatus,
  type SttProvider,
  type SttProviderId,
} from "@/server/providers/types";

export const runtime = "nodejs";

type SttRouteDeps = {
  providers?: Partial<Record<SttProviderId, SttProvider>>;
  limiter?: RateLimiter;
  getClientIp?: (request: Request) => string;
  getPublicStatus?: () => Promise<PublicProviderStatus>;
};

const defaultLimiter = createRateLimiter({
  max: 8,
  windowMs: 60_000,
});

const defaultProviders: Record<SttProviderId, SttProvider> = {
  siliconflow: createSiliconFlowSttProvider(),
  vosk: createVoskSttProvider(),
};

function defaultGetClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const [firstIp] = forwardedFor.split(",");
    if (firstIp?.trim()) {
      return firstIp.trim();
    }
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp?.trim()) {
    return realIp.trim();
  }

  return "anonymous";
}

async function defaultGetPublicStatus() {
  const registry = createProviderRegistry();
  return await registry.getPublicStatus();
}

function readStringField(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function toErrorResponse(error: unknown) {
  if (isAppError(error)) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
        },
      },
      { status: error.status },
    );
  }

  return NextResponse.json(
    {
      error: {
        code: "PROCESSING_FAILED",
        message: "PROCESSING_FAILED: unexpected STT failure",
      },
    },
    { status: 500 },
  );
}

function resolveProviderId(
  requestedProvider: string,
  status: PublicProviderStatus["stt"],
): SttProviderId {
  if (!requestedProvider) {
    return status.defaultProvider;
  }

  if (!isSttProviderId(requestedProvider)) {
    throw new AppError(
      "VALIDATION_ERROR",
      `VALIDATION_ERROR: unsupported STT provider \"${requestedProvider}\"`,
      { status: 400 },
    );
  }

  return requestedProvider;
}

export function createSttRouteHandler(deps: SttRouteDeps = {}) {
  const providers = {
    ...defaultProviders,
    ...deps.providers,
  };
  const limiter = deps.limiter ?? defaultLimiter;
  const getClientIp = deps.getClientIp ?? defaultGetClientIp;
  const getPublicStatus = deps.getPublicStatus ?? defaultGetPublicStatus;

  return async function POST(request: Request) {
    try {
      const ip = getClientIp(request);
      const limitResult = limiter.consume(ip);
      if (!limitResult.allowed) {
        throw new AppError(
          "RATE_LIMITED",
          "RATE_LIMITED: too many STT requests, please retry later",
          { status: 429 },
        );
      }

      const publicStatus = await getPublicStatus();
      if (!publicStatus.stt.available) {
        throw new AppError(
          "PROVIDER_UNAVAILABLE",
          "PROVIDER_UNAVAILABLE: stt is temporarily unavailable",
          { status: 503, details: publicStatus.stt.reason },
        );
      }

      const formData = await request.formData();
      const providerId = resolveProviderId(
        readStringField(formData, "provider").toLowerCase(),
        publicStatus.stt,
      );
      const providerStatus = publicStatus.stt.providers.find(
        (provider) => provider.id === providerId,
      );

      if (!providerStatus) {
        throw new AppError(
          "VALIDATION_ERROR",
          `VALIDATION_ERROR: unknown STT provider \"${providerId}\"`,
          { status: 400 },
        );
      }

      if (!providerStatus.available) {
        throw new AppError(
          "PROVIDER_UNAVAILABLE",
          `PROVIDER_UNAVAILABLE: ${providerStatus.label} is temporarily unavailable`,
          { status: 503, details: providerStatus.reason },
        );
      }

      const provider = providers[providerId];
      if (!provider) {
        throw new AppError(
          "VALIDATION_ERROR",
          `VALIDATION_ERROR: STT provider \"${providerId}\" is not registered`,
          { status: 400 },
        );
      }

      const file = formData.get("file");
      if (!(file instanceof File)) {
        throw new AppError(
          "VALIDATION_ERROR",
          "VALIDATION_ERROR: audio file is required",
          { status: 400 },
        );
      }

      const result = await transcribeAudio(
        {
          file,
        },
        {
          provider,
          enabled: providerStatus.available,
        },
      );

      return NextResponse.json(
        {
          text: result.text,
          provider: provider.id,
        },
        { status: 200 },
      );
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

export const POST = createSttRouteHandler();

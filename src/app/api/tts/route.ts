import { NextResponse } from "next/server";

import {
  generateSpeech,
  type GenerateSpeechInput,
} from "@/server/core/generate-speech";
import { assertTextUpload } from "@/server/platform/files";
import { AppError, isAppError } from "@/server/platform/errors";
import {
  createRateLimiter,
  type RateLimiter,
} from "@/server/platform/rate-limit";
import { createProviderRegistry } from "@/server/providers/provider-registry";
import { createMiniMaxTtsProvider } from "@/server/providers/tts/minimax";
import {
  createMicrosoftUnofficialTtsProvider,
} from "@/server/providers/tts/microsoft-unofficial";
import {
  isTtsProviderId,
  type PublicProviderStatus,
  type TtsProvider,
  type TtsProviderId,
} from "@/server/providers/types";

export const runtime = "nodejs";

type TtsRouteDeps = {
  providers?: Partial<Record<TtsProviderId, TtsProvider>>;
  limiter?: RateLimiter;
  getClientIp?: (request: Request) => string;
  getPublicStatus?: () => Promise<PublicProviderStatus>;
};

const defaultLimiter = createRateLimiter({
  max: 20,
  windowMs: 60_000,
});

const defaultProviders: Partial<Record<TtsProviderId, TtsProvider>> = {
  minimax: createMiniMaxTtsProvider(),
  microsoft_unofficial: createMicrosoftUnofficialTtsProvider(),
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

function readStringField(formData: FormData, key: string, fallback = "") {
  const value = formData.get(key);
  return typeof value === "string" ? value : fallback;
}

async function defaultGetPublicStatus() {
  const registry = createProviderRegistry();
  return await registry.getPublicStatus();
}

async function resolveText(formData: FormData) {
  const inlineText = readStringField(formData, "text").trim();
  if (inlineText) {
    return inlineText;
  }

  const file = formData.get("file");
  if (file instanceof File) {
    assertTextUpload(file);
    return (await file.text()).trim();
  }

  return "";
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
        message: "PROCESSING_FAILED: unexpected TTS failure",
      },
    },
    { status: 500 },
  );
}

function resolveProviderId(
  requestedProvider: string,
  status: PublicProviderStatus["tts"],
): TtsProviderId {
  if (!requestedProvider) {
    return status.defaultProvider;
  }

  if (!isTtsProviderId(requestedProvider)) {
    throw new AppError(
      "VALIDATION_ERROR",
      `VALIDATION_ERROR: unsupported TTS provider \"${requestedProvider}\"`,
      { status: 400 },
    );
  }

  return requestedProvider;
}

export function createTtsRouteHandler(deps: TtsRouteDeps = {}) {
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
          "RATE_LIMITED: too many TTS requests, please retry later",
          { status: 429 },
        );
      }

      const formData = await request.formData();
      const publicStatus = await getPublicStatus();
      if (!publicStatus.tts.available) {
        throw new AppError(
          "PROVIDER_UNAVAILABLE",
          "PROVIDER_UNAVAILABLE: tts is temporarily unavailable",
          { status: 503, details: publicStatus.tts.reason },
        );
      }

      const providerId = resolveProviderId(
        readStringField(formData, "provider").trim().toLowerCase(),
        publicStatus.tts,
      );
      const providerStatus = publicStatus.tts.providers.find(
        (provider) => provider.id === providerId,
      );

      if (!providerStatus) {
        throw new AppError(
          "VALIDATION_ERROR",
          `VALIDATION_ERROR: unknown TTS provider \"${providerId}\"`,
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
          `VALIDATION_ERROR: TTS provider \"${providerId}\" is not registered`,
          { status: 400 },
        );
      }

      const text = await resolveText(formData);
      const voice = readStringField(formData, "voice", "zh-CN-XiaoxiaoNeural");
      const model =
        readStringField(formData, "model").trim() ||
        publicStatus.tts.defaultModel;
      const rate = readStringField(formData, "rate", "1.0");
      const pitch = readStringField(formData, "pitch", "0");
      const style = readStringField(formData, "style", "general");

      const input: GenerateSpeechInput = {
        text,
        voice,
        model,
        rate,
        pitch,
        style,
      };

      const result = await generateSpeech(input, { provider });

      return new NextResponse(result.audio, {
        status: 200,
        headers: {
          "Content-Type": result.contentType,
          "Content-Disposition": 'attachment; filename="quickvoice.mp3"',
          "Cache-Control": "no-store",
        },
      });
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

export const POST = createTtsRouteHandler();

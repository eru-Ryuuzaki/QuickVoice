import { NextResponse } from "next/server";

import { transcribeAudio } from "@/server/core/transcribe-audio";
import { AppError, isAppError } from "@/server/platform/errors";
import {
  createRateLimiter,
  type RateLimiter,
} from "@/server/platform/rate-limit";
import { createProviderRegistry } from "@/server/providers/provider-registry";
import { createSiliconFlowSttProvider } from "@/server/providers/stt/siliconflow";
import type { PublicProviderStatus, SttProvider } from "@/server/providers/types";

export const runtime = "nodejs";

type SttAvailability = PublicProviderStatus["stt"];

type SttRouteDeps = {
  provider?: SttProvider;
  limiter?: RateLimiter;
  getClientIp?: (request: Request) => string;
  getSttAvailability?: () => Promise<SttAvailability>;
};

const defaultLimiter = createRateLimiter({
  max: 8,
  windowMs: 60_000,
});

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

async function defaultGetSttAvailability() {
  const registry = createProviderRegistry();
  const status = await registry.getPublicStatus();
  return status.stt;
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

export function createSttRouteHandler(deps: SttRouteDeps = {}) {
  const provider = deps.provider ?? createSiliconFlowSttProvider();
  const limiter = deps.limiter ?? defaultLimiter;
  const getClientIp = deps.getClientIp ?? defaultGetClientIp;
  const getSttAvailability = deps.getSttAvailability ?? defaultGetSttAvailability;

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

      const availability = await getSttAvailability();
      if (!availability.available) {
        throw new AppError(
          "PROVIDER_UNAVAILABLE",
          "PROVIDER_UNAVAILABLE: stt is temporarily unavailable",
          { status: 503, details: availability.reason },
        );
      }

      const formData = await request.formData();
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
          enabled: availability.available,
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

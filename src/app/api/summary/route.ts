import { NextResponse } from "next/server";

import { summarizeTranscript } from "@/server/core/summarize-transcript";
import { loadConfig } from "@/server/platform/env";
import { AppError, isAppError } from "@/server/platform/errors";
import {
  createRateLimiter,
  type RateLimiter,
} from "@/server/platform/rate-limit";
import { createOpenAiSummaryProvider } from "@/server/providers/summary/openai";
import type { SummaryProvider } from "@/server/providers/types";

export const runtime = "nodejs";

type SummaryRouteConfig = {
  openaiSummaryModel: string;
};

type SummaryRouteDeps = {
  provider?: SummaryProvider;
  limiter?: RateLimiter;
  getClientIp?: (request: Request) => string;
  config?: SummaryRouteConfig;
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
        message: "PROCESSING_FAILED: unexpected summary failure",
      },
    },
    { status: 500 },
  );
}

function readBodyValue(body: unknown, key: string) {
  if (!body || typeof body !== "object") {
    return "";
  }

  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function defaultConfig(): SummaryRouteConfig {
  const config = loadConfig();
  return {
    openaiSummaryModel: config.openaiSummaryModel,
  };
}

export function createSummaryRouteHandler(deps: SummaryRouteDeps = {}) {
  const provider = deps.provider ?? createOpenAiSummaryProvider();
  const limiter = deps.limiter ?? defaultLimiter;
  const getClientIp = deps.getClientIp ?? defaultGetClientIp;

  return async function POST(request: Request) {
    try {
      const ip = getClientIp(request);
      const limitResult = limiter.consume(ip);
      if (!limitResult.allowed) {
        throw new AppError(
          "RATE_LIMITED",
          "RATE_LIMITED: too many summary requests, please retry later",
          { status: 429 },
        );
      }

      const body = await request.json();
      const config = deps.config ?? defaultConfig();
      const result = await summarizeTranscript(
        {
          transcript: readBodyValue(body, "transcript"),
          model: readBodyValue(body, "model"),
        },
        {
          provider,
          defaultModel: config.openaiSummaryModel,
        },
      );

      return NextResponse.json(result, { status: 200 });
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

export const POST = createSummaryRouteHandler();

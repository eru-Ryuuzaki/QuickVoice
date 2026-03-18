import { createHmac, randomUUID } from "node:crypto";

import { AppError } from "@/server/platform/errors";
import type { TtsProvider, TtsSynthesizeInput } from "@/server/providers/types";

const TOKEN_REFRESH_BEFORE_EXPIRY_SECONDS = 3 * 60;
const SIGN_SECRET =
  "oik6PdDdMnOXemTbwvMn9de/h9lFnfBaCWbGMMZqqoSaQaqUOqjVGm5NqsmjcBI1x+sS9ugjB55HEJWRiFXYFw==";
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 Edg/127.0.0.0";
const DEFAULT_OUTPUT_FORMAT = "audio-24khz-48kbitrate-mono-mp3";

type EndpointPayload = {
  r: string;
  t: string;
};

type CachedEndpoint = {
  endpoint: EndpointPayload;
  expiresAt: number;
};

type MicrosoftUnofficialTtsOptions = {
  fetchImpl?: typeof fetch;
  maxRetries?: number;
  retryDelayMs?: number;
  outputFormat?: string;
};

let endpointCache: CachedEndpoint | null = null;

function createSignature(url: string) {
  const payload = url.split("://")[1] ?? url;
  const encodedUrl = encodeURIComponent(payload);
  const traceId = randomUUID().replace(/-/g, "");
  const formattedDate = `${new Date().toUTCString().replace("GMT", "").trim()} GMT`
    .toLowerCase();
  const bytesToSign =
    `MSTranslatorAndroidApp${encodedUrl}${formattedDate}${traceId}`.toLowerCase();
  const key = Buffer.from(SIGN_SECRET, "base64");
  const signature = createHmac("sha256", key).update(bytesToSign).digest("base64");

  return `MSTranslatorAndroidApp::${signature}::${formattedDate}::${traceId}`;
}

function decodeJwtExpiry(token: string) {
  const [, payload] = token.split(".");
  if (!payload) {
    return Math.floor(Date.now() / 1000) + 300;
  }

  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  const decoded = Buffer.from(normalized, "base64").toString("utf8");

  try {
    const parsed = JSON.parse(decoded) as { exp?: number };
    if (typeof parsed.exp === "number" && Number.isFinite(parsed.exp)) {
      return parsed.exp;
    }
  } catch {}

  return Math.floor(Date.now() / 1000) + 300;
}

function escapeXml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function buildSsml(input: TtsSynthesizeInput) {
  const safeStyle = input.style.trim() || "general";
  return `<speak xmlns="http://www.w3.org/2001/10/synthesis" ` +
    `xmlns:mstts="http://www.w3.org/2001/mstts" version="1.0" xml:lang="zh-CN">` +
    `<voice name="${input.voice}">` +
    `<mstts:express-as style="${safeStyle}" styledegree="2.0" role="default">` +
    `<prosody rate="${input.rate}" pitch="${input.pitch}" volume="+0%">` +
    `${escapeXml(input.text)}</prosody></mstts:express-as></voice></speak>`;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function getEndpoint(fetchImpl: typeof fetch) {
  const now = Math.floor(Date.now() / 1000);
  if (
    endpointCache &&
    now < endpointCache.expiresAt - TOKEN_REFRESH_BEFORE_EXPIRY_SECONDS
  ) {
    return endpointCache.endpoint;
  }

  const endpointUrl =
    "https://dev.microsofttranslator.com/apps/endpoint?api-version=1.0";
  const traceId = randomUUID().replace(/-/g, "");
  const response = await fetchImpl(endpointUrl, {
    method: "POST",
    headers: {
      "Accept-Language": "zh-Hans",
      "X-ClientVersion": "4.0.530a 5fe1dc6c",
      "X-UserId": "0f04d16a175c411e",
      "X-HomeGeographicRegion": "zh-Hans-CN",
      "X-ClientTraceId": traceId,
      "X-MT-Signature": createSignature(endpointUrl),
      "User-Agent": DEFAULT_USER_AGENT,
      "Content-Type": "application/json; charset=utf-8",
      "Content-Length": "0",
      "Accept-Encoding": "gzip",
    },
  });

  if (!response.ok) {
    if (endpointCache) {
      return endpointCache.endpoint;
    }

    throw new AppError(
      "PROVIDER_UNAVAILABLE",
      `PROVIDER_UNAVAILABLE: failed to get Microsoft endpoint (${response.status})`,
      { status: 503 },
    );
  }

  const endpoint = (await response.json()) as Partial<EndpointPayload>;
  if (!endpoint.r || !endpoint.t) {
    throw new AppError(
      "PROVIDER_UNAVAILABLE",
      "PROVIDER_UNAVAILABLE: Microsoft endpoint payload is invalid",
      { status: 503 },
    );
  }

  endpointCache = {
    endpoint: {
      r: endpoint.r,
      t: endpoint.t,
    },
    expiresAt: decodeJwtExpiry(endpoint.t),
  };

  return endpointCache.endpoint;
}

export function createMicrosoftUnofficialTtsProvider(
  options: MicrosoftUnofficialTtsOptions = {},
): TtsProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  const maxRetries = Math.max(0, options.maxRetries ?? 2);
  const retryDelayMs = Math.max(100, options.retryDelayMs ?? 400);
  const outputFormat = options.outputFormat ?? DEFAULT_OUTPUT_FORMAT;

  return {
    id: "microsoft_unofficial",
    async synthesize(input) {
      let lastError: unknown;

      for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        try {
          const endpoint = await getEndpoint(fetchImpl);
          const url =
            `https://${endpoint.r}.tts.speech.microsoft.com/cognitiveservices/v1`;
          const response = await fetchImpl(url, {
            method: "POST",
            headers: {
              Authorization: endpoint.t,
              "Content-Type": "application/ssml+xml",
              "User-Agent": DEFAULT_USER_AGENT,
              "X-Microsoft-OutputFormat": input.outputFormat ?? outputFormat,
            },
            body: buildSsml(input),
          });

          if (response.ok) {
            return await response.arrayBuffer();
          }

          const errorBody = await response.text();
          const shouldRetry =
            response.status === 429 || response.status >= 500;

          if (shouldRetry && attempt < maxRetries) {
            await sleep(retryDelayMs * (attempt + 1));
            continue;
          }

          throw new AppError(
            "PROVIDER_UNAVAILABLE",
            `PROVIDER_UNAVAILABLE: Microsoft TTS failed (${response.status}) ${errorBody.slice(0, 180)}`,
            { status: shouldRetry ? 503 : 400 },
          );
        } catch (error) {
          lastError = error;
          if (attempt < maxRetries) {
            await sleep(retryDelayMs * (attempt + 1));
            continue;
          }
        }
      }

      throw new AppError(
        "PROVIDER_UNAVAILABLE",
        "PROVIDER_UNAVAILABLE: Microsoft TTS request failed after retries",
        { status: 503, cause: lastError },
      );
    },
  };
}

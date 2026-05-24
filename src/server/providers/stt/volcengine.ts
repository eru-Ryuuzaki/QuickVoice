import { randomUUID } from "node:crypto";

import { loadConfig } from "@/server/platform/env";
import { AppError } from "@/server/platform/errors";
import type { SttProvider } from "@/server/providers/types";
import { createCosS3AudioStorage } from "@/server/storage/cos-s3";
import type { AudioObjectStorage } from "@/server/storage/audio-object-storage";

type VolcengineSttOptions = {
  apiKey?: string;
  resourceId?: string;
  submitEndpoint?: string;
  queryEndpoint?: string;
  storage?: AudioObjectStorage;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  maxPollAttempts?: number;
  pollIntervalMs?: number;
};

type VolcenginePayload = {
  result?: { text?: string };
  text?: string;
};

const DEFAULT_MAX_POLL_ATTEMPTS = 20;
const DEFAULT_POLL_INTERVAL_MS = 1500;

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

function getDefaults() {
  const config = loadConfig();
  return {
    apiKey: config.volcengineSttApiKey,
    resourceId: config.volcengineSttModel,
    submitEndpoint: config.volcengineSttEndpoint,
    queryEndpoint: config.volcengineSttEndpoint.replace(/\/submit$/, "/query"),
  };
}

async function readJsonPayload(response: Response): Promise<VolcenginePayload> {
  try {
    return (await response.json()) as VolcenginePayload;
  } catch {
    return {};
  }
}

async function throwResponseError(response: Response) {
  const body = await response.text();
  const code = response.status === 429 ? "RATE_LIMITED" : "PROVIDER_UNAVAILABLE";
  const message = body
    ? `PROVIDER_UNAVAILABLE: Volcengine STT returned ${response.status} ${body.slice(0, 180)}`
    : `PROVIDER_UNAVAILABLE: Volcengine STT returned ${response.status}`;
  throw new AppError(code, message, {
    status: response.status === 429 ? 429 : 503,
    details: body,
  });
}

function getTranscriptText(payload: VolcenginePayload) {
  const transcript = payload.result?.text ?? payload.text;
  if (transcript == null) {
    return undefined;
  }

  return transcript.trim();
}

export function createVolcengineSttProvider(
  options: VolcengineSttOptions = {},
): SttProvider {
  const defaults = getDefaults();
  const apiKey = options.apiKey ?? defaults.apiKey;
  const resourceId = options.resourceId ?? defaults.resourceId;
  const submitEndpoint = options.submitEndpoint ?? defaults.submitEndpoint;
  const queryEndpoint = options.queryEndpoint ?? defaults.queryEndpoint;
  const storage = options.storage ?? createCosS3AudioStorage();
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const maxPollAttempts = options.maxPollAttempts ?? DEFAULT_MAX_POLL_ATTEMPTS;
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;

  return {
    id: "volcengine",
    label: "Volcengine",
    async transcribe(input) {
      if (!apiKey) {
        throw new AppError(
          "PROVIDER_UNAVAILABLE",
          "PROVIDER_UNAVAILABLE: Volcengine STT is not configured",
          { status: 503 },
        );
      }

      const requestResourceId = input.model.trim() || resourceId;
      const requestId = randomUUID();
      const audio = await storage.uploadAudio(input.file);

      const submitResponse = await fetchImpl(submitEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": apiKey,
          "X-Api-Resource-Id": requestResourceId,
          "X-Api-Request-Id": requestId,
          "X-Api-Sequence": "-1",
        },
        body: JSON.stringify({
          user: {
            uid: apiKey,
          },
          audio: {
            url: audio.url,
          },
          request: {
            model_name: "bigmodel",
          },
        }),
      });

      if (!submitResponse.ok) {
        await throwResponseError(submitResponse);
      }

      let lastPayload: VolcenginePayload = {};
      for (let attempt = 0; attempt < maxPollAttempts; attempt++) {
        if (attempt > 0) {
          await sleep(pollIntervalMs);
        }

        const queryResponse = await fetchImpl(queryEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Api-Key": apiKey,
            "X-Api-Resource-Id": requestResourceId,
            "X-Api-Request-Id": requestId,
            "X-Api-Sequence": "-1",
          },
          body: JSON.stringify({
            request: {
              request_id: requestId,
            },
          }),
        });

        if (!queryResponse.ok) {
          await throwResponseError(queryResponse);
        }

        lastPayload = await readJsonPayload(queryResponse);
        const text = getTranscriptText(lastPayload);
        if (text) {
          return { text, raw: lastPayload };
        }
      }

      throw new AppError(
        "PROCESSING_FAILED",
        "PROCESSING_FAILED: empty transcription result from Volcengine",
        { status: 502, details: lastPayload },
      );
    },
  };
}

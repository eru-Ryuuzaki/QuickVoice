import { randomUUID } from "node:crypto";

import { loadConfig } from "@/server/platform/env";
import { AppError } from "@/server/platform/errors";
import type { SttProvider } from "@/server/providers/types";

type VolcengineSttOptions = {
  apiKey?: string;
  resourceId?: string;
  endpoint?: string;
  fetchImpl?: typeof fetch;
};

type VolcenginePayload = {
  result?: { text?: string };
  text?: string;
};

async function readFileBuffer(file: File) {
  if (typeof file.arrayBuffer === "function") {
    return Buffer.from(await file.arrayBuffer());
  }

  return Buffer.from(await file.text());
}

function getDefaults() {
  const config = loadConfig();
  return {
    apiKey: config.volcengineSttApiKey,
    resourceId: config.volcengineSttModel,
    endpoint: config.volcengineSttEndpoint,
  };
}

export function createVolcengineSttProvider(
  options: VolcengineSttOptions = {},
): SttProvider {
  const defaults = getDefaults();
  const apiKey = options.apiKey ?? defaults.apiKey;
  const resourceId = options.resourceId ?? defaults.resourceId;
  const endpoint = options.endpoint ?? defaults.endpoint;
  const fetchImpl = options.fetchImpl ?? fetch;

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
      const audioData = (await readFileBuffer(input.file)).toString("base64");

      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": apiKey,
          "X-Api-Resource-Id": requestResourceId,
          "X-Api-Request-Id": randomUUID(),
          "X-Api-Sequence": "-1",
        },
        body: JSON.stringify({
          user: {
            uid: apiKey,
          },
          audio: {
            data: audioData,
          },
          request: {
            model_name: "bigmodel",
          },
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        const message = body
          ? `PROVIDER_UNAVAILABLE: Volcengine STT returned ${response.status} ${body.slice(0, 180)}`
          : `PROVIDER_UNAVAILABLE: Volcengine STT returned ${response.status}`;
        throw new AppError(
          response.status === 429 ? "RATE_LIMITED" : "PROVIDER_UNAVAILABLE",
          message,
          { status: response.status === 429 ? 429 : 503, details: body },
        );
      }

      const payload = (await response.json()) as VolcenginePayload;
      const text = (payload.result?.text ?? payload.text ?? "").trim();
      if (!text) {
        throw new AppError(
          "PROCESSING_FAILED",
          "PROCESSING_FAILED: empty transcription result from Volcengine",
          { status: 502 },
        );
      }

      return { text, raw: payload };
    },
  };
}

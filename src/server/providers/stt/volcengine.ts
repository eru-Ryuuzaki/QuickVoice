import { loadConfig } from "@/server/platform/env";
import { AppError } from "@/server/platform/errors";
import type { SttProvider } from "@/server/providers/types";

type VolcengineSttOptions = {
  accessKeyId?: string;
  secretAccessKey?: string;
  appId?: string;
  resourceId?: string;
  endpoint?: string;
  fetchImpl?: typeof fetch;
};

type VolcenginePayload = {
  result?: { text?: string };
  text?: string;
};

function getDefaults() {
  const config = loadConfig();
  return {
    accessKeyId: config.volcengineAccessKeyId,
    secretAccessKey: config.volcengineSecretAccessKey,
    appId: config.volcengineSttAppId,
    resourceId: config.volcengineSttResourceId,
    endpoint: config.volcengineSttEndpoint,
  };
}

export function createVolcengineSttProvider(
  options: VolcengineSttOptions = {},
): SttProvider {
  const defaults = getDefaults();
  const accessKeyId = options.accessKeyId ?? defaults.accessKeyId;
  const secretAccessKey = options.secretAccessKey ?? defaults.secretAccessKey;
  const appId = options.appId ?? defaults.appId;
  const resourceId = options.resourceId ?? defaults.resourceId;
  const endpoint = options.endpoint ?? defaults.endpoint;
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    id: "volcengine",
    label: "Volcengine",
    async transcribe(input) {
      if (!accessKeyId || !secretAccessKey || !appId) {
        throw new AppError(
          "PROVIDER_UNAVAILABLE",
          "PROVIDER_UNAVAILABLE: Volcengine STT is not configured",
          { status: 503 },
        );
      }

      const formData = new FormData();
      formData.append("file", input.file);

      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          "X-Api-Access-Key": accessKeyId,
          "X-Api-Secret-Key": secretAccessKey,
          "X-Api-App-Key": appId,
          "X-Api-Resource-Id": resourceId,
        },
        body: formData,
      });

      if (!response.ok) {
        const body = await response.text();
        throw new AppError(
          response.status === 429 ? "RATE_LIMITED" : "PROVIDER_UNAVAILABLE",
          `PROVIDER_UNAVAILABLE: Volcengine STT returned ${response.status}`,
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

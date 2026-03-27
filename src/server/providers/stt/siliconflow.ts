import { loadConfig } from "@/server/platform/env";
import { AppError } from "@/server/platform/errors";
import type { SttProvider } from "@/server/providers/types";

const SILICONFLOW_TRANSCRIBE_ENDPOINT =
  "https://api.siliconflow.cn/v1/audio/transcriptions";

type SiliconFlowSttOptions = {
  token?: string;
  model?: string;
  endpoint?: string;
  fetchImpl?: typeof fetch;
};

function getConfigDefaults() {
  const config = loadConfig();
  return {
    token: config.siliconflowApiKey,
    model: config.siliconflowSttModel,
  };
}

export function createSiliconFlowSttProvider(
  options: SiliconFlowSttOptions = {},
): SttProvider {
  const defaults = getConfigDefaults();
  const token = options.token ?? defaults.token;
  const model = options.model ?? defaults.model;
  const endpoint = options.endpoint ?? SILICONFLOW_TRANSCRIBE_ENDPOINT;
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    id: "siliconflow",
    label: "SiliconFlow",
    async transcribe(input) {
      const formData = new FormData();
      formData.append("file", input.file);
      formData.append("model", model);

      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const body = await response.text();
        if (response.status === 429) {
          throw new AppError(
            "RATE_LIMITED",
            "RATE_LIMITED: siliconflow request limit reached",
            { status: 429, details: body },
          );
        }

        throw new AppError(
          "PROVIDER_UNAVAILABLE",
          `PROVIDER_UNAVAILABLE: siliconflow returned ${response.status}`,
          { status: 503, details: body },
        );
      }

      const payload = (await response.json()) as { text?: string };
      if (!payload.text || !payload.text.trim()) {
        throw new AppError(
          "PROCESSING_FAILED",
          "PROCESSING_FAILED: empty transcription result",
          { status: 502 },
        );
      }

      return {
        text: payload.text.trim(),
        raw: payload,
      };
    },
  };
}

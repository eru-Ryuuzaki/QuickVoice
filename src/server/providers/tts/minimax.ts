import { loadConfig } from "@/server/platform/env";
import { AppError } from "@/server/platform/errors";
import type { TtsProvider } from "@/server/providers/types";

const DEFAULT_ENDPOINT = "https://api.minimaxi.com/v1/t2a_v2";

type MiniMaxTtsOptions = {
  apiKey?: string;
  model?: string;
  defaultVoiceId?: string;
  endpoint?: string;
  fetchImpl?: typeof fetch;
};

type MiniMaxPayload = {
  data?: { audio?: string };
  base_resp?: { status_msg?: string };
};

function parseNumber(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function createMiniMaxTtsProvider(
  options: MiniMaxTtsOptions = {},
): TtsProvider {
  const config = loadConfig();
  const apiKey = options.apiKey ?? config.minimaxApiKey;
  const model = options.model ?? config.minimaxTtsModel;
  const defaultVoiceId = options.defaultVoiceId ?? config.minimaxTtsVoiceId;
  const endpoint = options.endpoint ?? config.minimaxTtsEndpoint ?? DEFAULT_ENDPOINT;
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    id: "minimax",
    label: "MiniMax",
    async synthesize(input) {
      if (!apiKey) {
        throw new AppError(
          "PROVIDER_UNAVAILABLE",
          "PROVIDER_UNAVAILABLE: MiniMax TTS is not configured",
          { status: 503 },
        );
      }

      const voiceId = input.voice.trim() || defaultVoiceId;
      if (!voiceId) {
        throw new AppError(
          "VALIDATION_ERROR",
          "VALIDATION_ERROR: MiniMax voice is required",
          { status: 400 },
        );
      }

      const requestModel = input.model?.trim() || model;
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: requestModel,
          text: input.text,
          stream: false,
          output_format: "hex",
          voice_setting: {
            voice_id: voiceId,
            speed: parseNumber(input.rate, 1),
            pitch: parseNumber(input.pitch, 0),
            vol: 1,
          },
          audio_setting: {
            sample_rate: 32000,
            bitrate: 128000,
            format: "mp3",
            channel: 1,
          },
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new AppError(
          response.status === 429 ? "RATE_LIMITED" : "PROVIDER_UNAVAILABLE",
          `PROVIDER_UNAVAILABLE: MiniMax TTS returned ${response.status}`,
          { status: response.status === 429 ? 429 : 503, details: body },
        );
      }

      const payload = (await response.json()) as MiniMaxPayload;
      if (!payload.data?.audio) {
        const message = payload.base_resp?.status_msg
          ? `PROCESSING_FAILED: MiniMax TTS returned empty audio (${payload.base_resp.status_msg})`
          : "PROCESSING_FAILED: MiniMax TTS returned empty audio";
        throw new AppError(
          "PROCESSING_FAILED",
          message,
          { status: 502, details: payload.base_resp?.status_msg },
        );
      }

      const audio = Buffer.from(payload.data.audio, "hex");
      return audio.buffer.slice(
        audio.byteOffset,
        audio.byteOffset + audio.byteLength,
      );
    },
  };
}

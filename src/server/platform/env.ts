import {
  STT_PROVIDER_IDS,
  TTS_PROVIDER_IDS,
  type SttProviderId,
  type TtsProviderId,
} from "@/server/providers/types";

export type AppConfig = {
  ttsProvider: TtsProviderId;
  sttProvider: SttProviderId;
  summaryProvider: "openai";
  enableStt: boolean;
  enablePublicStt: boolean;
  enableSttVolcengine: boolean;
  enableSttVosk: boolean;
  enableTtsMinimax: boolean;
  enableTtsMicrosoftUnofficial: boolean;
  volcengineAccessKeyId: string;
  volcengineSecretAccessKey: string;
  volcengineSttAppId: string;
  volcengineSttResourceId: string;
  volcengineSttEndpoint: string;
  voskWsUrl: string;
  minimaxApiKey: string;
  minimaxGroupId: string;
  minimaxTtsModel: string;
  minimaxTtsVoiceId: string;
  openaiApiKey: string;
  openaiSummaryModel: string;
  openaiSummaryModels: string[];
};

type ConfigInput = {
  TTS_PROVIDER?: string;
  STT_PROVIDER?: string;
  SUMMARY_PROVIDER?: string;
  ENABLE_STT?: string;
  ENABLE_PUBLIC_STT?: string;
  ENABLE_STT_VOLCENGINE?: string;
  ENABLE_STT_VOSK?: string;
  ENABLE_TTS_MINIMAX?: string;
  ENABLE_TTS_MICROSOFT_UNOFFICIAL?: string;
  VOLCENGINE_ACCESS_KEY_ID?: string;
  VOLCENGINE_SECRET_ACCESS_KEY?: string;
  VOLCENGINE_STT_APP_ID?: string;
  VOLCENGINE_STT_RESOURCE_ID?: string;
  VOLCENGINE_STT_ENDPOINT?: string;
  VOSK_WS_URL?: string;
  MINIMAX_API_KEY?: string;
  MINIMAX_GROUP_ID?: string;
  MINIMAX_TTS_MODEL?: string;
  MINIMAX_TTS_VOICE_ID?: string;
  OPENAI_API_KEY?: string;
  OPENAI_SUMMARY_MODEL?: string;
  OPENAI_SUMMARY_MODELS?: string;
};

const DEFAULT_VOSK_WS_URL = "ws://vosk-cn:2700";
const DEFAULT_VOLCENGINE_STT_ENDPOINT =
  "https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash";
const DEFAULT_VOLCENGINE_STT_RESOURCE_ID = "volc.bigasr.auc_turbo";
const DEFAULT_MINIMAX_TTS_MODEL = "speech-2.8-turbo";
const DEFAULT_OPENAI_SUMMARY_MODEL = "gpt-5.5";
const DEFAULT_OPENAI_SUMMARY_MODELS = [
  "gpt-5.5",
  "gpt-5.4-mini",
  "gpt-5.4-nano",
];

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value == null || value.trim() === "") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function parseString(value: string | undefined, fallback: string) {
  if (value == null || value.trim() === "") {
    return fallback;
  }

  return value.trim();
}

function parseOptionalString(value: string | undefined, fallback = "") {
  if (value == null) {
    return fallback;
  }

  return value.trim();
}

function parseCsv(value: string | undefined, fallback: string[]) {
  if (value == null || value.trim() === "") {
    return fallback;
  }

  const parsed = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return parsed.length > 0 ? parsed : fallback;
}

function parseSttProvider(value: string | undefined): SttProviderId {
  const normalized = value?.trim().toLowerCase();
  if (normalized && STT_PROVIDER_IDS.includes(normalized as SttProviderId)) {
    return normalized as SttProviderId;
  }

  return "volcengine";
}

function parseTtsProvider(value: string | undefined): TtsProviderId {
  const normalized = value?.trim().toLowerCase();
  if (normalized && TTS_PROVIDER_IDS.includes(normalized as TtsProviderId)) {
    return normalized as TtsProviderId;
  }

  return "minimax";
}

export function loadConfig(input?: ConfigInput): AppConfig {
  const source = input ?? (process.env as ConfigInput);
  const openaiSummaryModels = parseCsv(
    source.OPENAI_SUMMARY_MODELS,
    DEFAULT_OPENAI_SUMMARY_MODELS,
  );
  const requestedSummaryModel = parseString(
    source.OPENAI_SUMMARY_MODEL,
    DEFAULT_OPENAI_SUMMARY_MODEL,
  );

  return {
    ttsProvider: parseTtsProvider(source.TTS_PROVIDER),
    sttProvider: parseSttProvider(source.STT_PROVIDER),
    summaryProvider: "openai",
    enableStt: parseBoolean(source.ENABLE_STT, true),
    enablePublicStt: parseBoolean(source.ENABLE_PUBLIC_STT, true),
    enableSttVolcengine: parseBoolean(source.ENABLE_STT_VOLCENGINE, true),
    enableSttVosk: parseBoolean(source.ENABLE_STT_VOSK, true),
    enableTtsMinimax: parseBoolean(source.ENABLE_TTS_MINIMAX, true),
    enableTtsMicrosoftUnofficial: parseBoolean(
      source.ENABLE_TTS_MICROSOFT_UNOFFICIAL,
      true,
    ),
    volcengineAccessKeyId: parseOptionalString(source.VOLCENGINE_ACCESS_KEY_ID),
    volcengineSecretAccessKey: parseOptionalString(
      source.VOLCENGINE_SECRET_ACCESS_KEY,
    ),
    volcengineSttAppId: parseOptionalString(source.VOLCENGINE_STT_APP_ID),
    volcengineSttResourceId: parseString(
      source.VOLCENGINE_STT_RESOURCE_ID,
      DEFAULT_VOLCENGINE_STT_RESOURCE_ID,
    ),
    volcengineSttEndpoint: parseString(
      source.VOLCENGINE_STT_ENDPOINT,
      DEFAULT_VOLCENGINE_STT_ENDPOINT,
    ),
    voskWsUrl: parseOptionalString(source.VOSK_WS_URL, DEFAULT_VOSK_WS_URL),
    minimaxApiKey: parseOptionalString(source.MINIMAX_API_KEY),
    minimaxGroupId: parseOptionalString(source.MINIMAX_GROUP_ID),
    minimaxTtsModel: parseString(
      source.MINIMAX_TTS_MODEL,
      DEFAULT_MINIMAX_TTS_MODEL,
    ),
    minimaxTtsVoiceId: parseOptionalString(source.MINIMAX_TTS_VOICE_ID),
    openaiApiKey: parseOptionalString(source.OPENAI_API_KEY),
    openaiSummaryModel: openaiSummaryModels.includes(requestedSummaryModel)
      ? requestedSummaryModel
      : (openaiSummaryModels[0] ?? DEFAULT_OPENAI_SUMMARY_MODEL),
    openaiSummaryModels,
  };
}

import {
  STT_PROVIDER_IDS,
  TTS_PROVIDER_IDS,
  type SttProviderId,
  type TtsProviderId,
} from "@/server/providers/types";

export type AppConfig = {
  ttsProvider: TtsProviderId;
  sttProvider: SttProviderId;
  enableSttVolcengine: boolean;
  enableSttVosk: boolean;
  enableTtsMinimax: boolean;
  enableTtsMicrosoftUnofficial: boolean;
  volcengineSttApiKey: string;
  volcengineSttModel: string;
  volcengineSttModelOptions: string[];
  volcengineSttEndpoint: string;
  voskWsUrl: string;
  minimaxApiKey: string;
  minimaxTtsModel: string;
  minimaxTtsModelOptions: string[];
  minimaxTtsEndpoint: string;
  minimaxTtsVoiceId: string;
  minimaxTtsVoiceOptions: string[];
  microsoftTtsModel: string;
  microsoftTtsModelOptions: string[];
  microsoftTtsVoiceId: string;
  microsoftTtsVoiceOptions: string[];
  openaiApiKey: string;
  openaiSummaryModel: string;
  openaiSummaryModelOptions: string[];
  openaiSummaryEndpoint: string;
};

type ConfigInput = {
  TTS_PROVIDER?: string;
  STT_PROVIDER?: string;
  VOLCENGINE_STT_ENABLED?: string;
  VOLCENGINE_STT_API_KEY?: string;
  VOLCENGINE_STT_MODEL?: string;
  VOLCENGINE_STT_MODEL_OPTIONS?: string;
  VOLCENGINE_STT_ENDPOINT?: string;
  VOSK_STT_ENABLED?: string;
  VOSK_STT_WS_URL?: string;
  MINIMAX_TTS_ENABLED?: string;
  MINIMAX_TTS_API_KEY?: string;
  MINIMAX_TTS_MODEL?: string;
  MINIMAX_TTS_MODEL_OPTIONS?: string;
  MINIMAX_TTS_ENDPOINT?: string;
  MINIMAX_TTS_VOICE_ID?: string;
  MINIMAX_TTS_VOICE_OPTIONS?: string;
  MICROSOFT_TTS_ENABLED?: string;
  MICROSOFT_TTS_VOICE_ID?: string;
  MICROSOFT_TTS_VOICE_OPTIONS?: string;
  OPENAI_SUMMARY_API_KEY?: string;
  OPENAI_SUMMARY_MODEL?: string;
  OPENAI_SUMMARY_MODEL_OPTIONS?: string;
  OPENAI_SUMMARY_ENDPOINT?: string;
};

const DEFAULT_VOSK_STT_WS_URL = "ws://vosk-cn:2700";
const DEFAULT_VOLCENGINE_STT_ENDPOINT =
  "https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash";
const DEFAULT_VOLCENGINE_STT_MODEL = "volc.bigasr.auc_turbo";
const DEFAULT_MINIMAX_TTS_MODEL = "speech-2.8-turbo";
const DEFAULT_MINIMAX_TTS_ENDPOINT = "https://api.minimaxi.com/v1/t2a_v2";
const DEFAULT_MINIMAX_TTS_VOICE_ID = "Chinese (Mandarin)_Warm_Girl";
const DEFAULT_MICROSOFT_TTS_VOICE_ID = "zh-CN-XiaoxiaoNeural";
const DEFAULT_MINIMAX_TTS_MODEL_OPTIONS = [
  "speech-2.8-turbo",
  "speech-2.8-hd",
  "speech-2.6-turbo",
  "speech-2.6-hd",
];
const DEFAULT_MINIMAX_TTS_VOICE_OPTIONS = [
  "Chinese (Mandarin)_Warm_Girl",
  "Chinese (Mandarin)_News_Anchor",
  "English_expressive_narrator",
];
const DEFAULT_MICROSOFT_TTS_VOICE_OPTIONS = [
  DEFAULT_MICROSOFT_TTS_VOICE_ID,
  "zh-CN-YunxiNeural",
];
const DEFAULT_OPENAI_SUMMARY_MODEL = "gpt-5.5";
const DEFAULT_OPENAI_SUMMARY_ENDPOINT = "https://api.openai.com/v1/responses";

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

function parseStringList(value: string | undefined, fallback: string[]) {
  const rawValues =
    value == null || value.trim() === "" ? fallback : value.split(",");
  const seen = new Set<string>();
  const parsed: string[] = [];

  for (const rawValue of rawValues) {
    const option = rawValue.trim();
    if (option && !seen.has(option)) {
      seen.add(option);
      parsed.push(option);
    }
  }

  return parsed.length > 0 ? parsed : fallback;
}

function withDefaultOption(defaultValue: string, options: string[]) {
  if (!defaultValue) {
    return options;
  }

  return [defaultValue, ...options.filter((option) => option !== defaultValue)];
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
  const volcengineSttModel = parseString(
    source.VOLCENGINE_STT_MODEL,
    DEFAULT_VOLCENGINE_STT_MODEL,
  );
  const minimaxTtsModel = parseString(
    source.MINIMAX_TTS_MODEL,
    DEFAULT_MINIMAX_TTS_MODEL,
  );
  const minimaxTtsVoiceId = parseString(
    source.MINIMAX_TTS_VOICE_ID,
    DEFAULT_MINIMAX_TTS_VOICE_ID,
  );
  const microsoftTtsVoiceId = parseString(
    source.MICROSOFT_TTS_VOICE_ID,
    DEFAULT_MICROSOFT_TTS_VOICE_ID,
  );
  const openaiSummaryModel = parseString(
    source.OPENAI_SUMMARY_MODEL,
    DEFAULT_OPENAI_SUMMARY_MODEL,
  );

  return {
    ttsProvider: parseTtsProvider(source.TTS_PROVIDER),
    sttProvider: parseSttProvider(source.STT_PROVIDER),
    enableSttVolcengine: parseBoolean(source.VOLCENGINE_STT_ENABLED, true),
    enableSttVosk: parseBoolean(source.VOSK_STT_ENABLED, true),
    enableTtsMinimax: parseBoolean(source.MINIMAX_TTS_ENABLED, true),
    enableTtsMicrosoftUnofficial: parseBoolean(
      source.MICROSOFT_TTS_ENABLED,
      true,
    ),
    volcengineSttApiKey: parseOptionalString(source.VOLCENGINE_STT_API_KEY),
    volcengineSttModel,
    volcengineSttModelOptions: withDefaultOption(
      volcengineSttModel,
      parseStringList(source.VOLCENGINE_STT_MODEL_OPTIONS, [
        DEFAULT_VOLCENGINE_STT_MODEL,
      ]),
    ),
    volcengineSttEndpoint: parseString(
      source.VOLCENGINE_STT_ENDPOINT,
      DEFAULT_VOLCENGINE_STT_ENDPOINT,
    ),
    voskWsUrl: parseOptionalString(
      source.VOSK_STT_WS_URL,
      DEFAULT_VOSK_STT_WS_URL,
    ),
    minimaxApiKey: parseOptionalString(source.MINIMAX_TTS_API_KEY),
    minimaxTtsModel,
    minimaxTtsModelOptions: withDefaultOption(
      minimaxTtsModel,
      parseStringList(
        source.MINIMAX_TTS_MODEL_OPTIONS,
        DEFAULT_MINIMAX_TTS_MODEL_OPTIONS,
      ),
    ),
    minimaxTtsEndpoint: parseString(
      source.MINIMAX_TTS_ENDPOINT,
      DEFAULT_MINIMAX_TTS_ENDPOINT,
    ),
    minimaxTtsVoiceId,
    minimaxTtsVoiceOptions: withDefaultOption(
      minimaxTtsVoiceId,
      parseStringList(
        source.MINIMAX_TTS_VOICE_OPTIONS,
        DEFAULT_MINIMAX_TTS_VOICE_OPTIONS,
      ),
    ),
    microsoftTtsModel: "",
    microsoftTtsModelOptions: [],
    microsoftTtsVoiceId,
    microsoftTtsVoiceOptions: withDefaultOption(
      microsoftTtsVoiceId,
      parseStringList(
        source.MICROSOFT_TTS_VOICE_OPTIONS,
        DEFAULT_MICROSOFT_TTS_VOICE_OPTIONS,
      ),
    ),
    openaiApiKey: parseOptionalString(source.OPENAI_SUMMARY_API_KEY),
    openaiSummaryModel,
    openaiSummaryModelOptions: withDefaultOption(
      openaiSummaryModel,
      parseStringList(source.OPENAI_SUMMARY_MODEL_OPTIONS, [
        DEFAULT_OPENAI_SUMMARY_MODEL,
      ]),
    ),
    openaiSummaryEndpoint: parseString(
      source.OPENAI_SUMMARY_ENDPOINT,
      DEFAULT_OPENAI_SUMMARY_ENDPOINT,
    ),
  };
}

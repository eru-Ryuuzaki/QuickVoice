import {
  STT_PROVIDER_IDS,
  type SttProviderId,
} from "@/server/providers/types";

export type AppConfig = {
  ttsProvider: string;
  sttProvider: SttProviderId;
  enableStt: boolean;
  enablePublicStt: boolean;
  enableSttSiliconflow: boolean;
  enableSttVosk: boolean;
  siliconflowApiKey: string;
  siliconflowSttModel: string;
  voskWsUrl: string;
};

type ConfigInput = {
  TTS_PROVIDER?: string;
  STT_PROVIDER?: string;
  ENABLE_STT?: string;
  ENABLE_PUBLIC_STT?: string;
  ENABLE_STT_SILICONFLOW?: string;
  ENABLE_STT_VOSK?: string;
  SILICONFLOW_API_KEY?: string;
  SILICONFLOW_STT_MODEL?: string;
  VOSK_WS_URL?: string;
};

const DEFAULT_SILICONFLOW_TOKEN =
  "sk-wtldsvuprmwltxpbspbmawtolbacghzawnjhtlzlnujjkfhh";
const DEFAULT_SILICONFLOW_MODEL = "FunAudioLLM/SenseVoiceSmall";
const DEFAULT_VOSK_WS_URL = "ws://vosk-cn:2700";

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

function parseOptionalString(value: string | undefined, fallback: string) {
  if (value == null) {
    return fallback;
  }

  return value.trim();
}

function parseSttProvider(value: string | undefined): SttProviderId {
  const normalized = value?.trim().toLowerCase();
  if (normalized && STT_PROVIDER_IDS.includes(normalized as SttProviderId)) {
    return normalized as SttProviderId;
  }

  return "siliconflow";
}

export function loadConfig(input?: ConfigInput): AppConfig {
  const source = input ?? (process.env as ConfigInput);

  return {
    ttsProvider: source.TTS_PROVIDER ?? "microsoft_unofficial",
    sttProvider: parseSttProvider(source.STT_PROVIDER),
    enableStt: parseBoolean(source.ENABLE_STT, true),
    enablePublicStt: parseBoolean(source.ENABLE_PUBLIC_STT, true),
    enableSttSiliconflow: parseBoolean(source.ENABLE_STT_SILICONFLOW, true),
    enableSttVosk: parseBoolean(source.ENABLE_STT_VOSK, false),
    siliconflowApiKey: parseString(
      source.SILICONFLOW_API_KEY,
      DEFAULT_SILICONFLOW_TOKEN,
    ),
    siliconflowSttModel: parseString(
      source.SILICONFLOW_STT_MODEL,
      DEFAULT_SILICONFLOW_MODEL,
    ),
    voskWsUrl: parseOptionalString(source.VOSK_WS_URL, DEFAULT_VOSK_WS_URL),
  };
}

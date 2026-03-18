export type AppConfig = {
  ttsProvider: string;
  sttProvider: string;
  enableStt: boolean;
  enablePublicStt: boolean;
  siliconflowApiKey: string;
  siliconflowSttModel: string;
};

type ConfigInput = {
  TTS_PROVIDER?: string;
  STT_PROVIDER?: string;
  ENABLE_STT?: string;
  ENABLE_PUBLIC_STT?: string;
  SILICONFLOW_API_KEY?: string;
  SILICONFLOW_STT_MODEL?: string;
};

const DEFAULT_SILICONFLOW_TOKEN =
  "sk-wtldsvuprmwltxpbspbmawtolbacghzawnjhtlzlnujjkfhh";
const DEFAULT_SILICONFLOW_MODEL = "FunAudioLLM/SenseVoiceSmall";

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

export function loadConfig(input?: ConfigInput): AppConfig {
  const source = input ?? (process.env as ConfigInput);

  return {
    ttsProvider: source.TTS_PROVIDER ?? "microsoft_unofficial",
    sttProvider: source.STT_PROVIDER ?? "siliconflow",
    enableStt: parseBoolean(source.ENABLE_STT, true),
    enablePublicStt: parseBoolean(source.ENABLE_PUBLIC_STT, true),
    siliconflowApiKey: parseString(
      source.SILICONFLOW_API_KEY,
      DEFAULT_SILICONFLOW_TOKEN,
    ),
    siliconflowSttModel: parseString(
      source.SILICONFLOW_STT_MODEL,
      DEFAULT_SILICONFLOW_MODEL,
    ),
  };
}

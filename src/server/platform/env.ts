export type AppConfig = {
  ttsProvider: string;
  sttProvider: string;
  enableStt: boolean;
  enablePublicStt: boolean;
};

type ConfigInput = {
  TTS_PROVIDER?: string;
  STT_PROVIDER?: string;
  ENABLE_STT?: string;
  ENABLE_PUBLIC_STT?: string;
};

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value == null || value.trim() === "") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

export function loadConfig(input?: ConfigInput): AppConfig {
  const source = input ?? (process.env as ConfigInput);

  return {
    ttsProvider: source.TTS_PROVIDER ?? "microsoft_unofficial",
    sttProvider: source.STT_PROVIDER ?? "siliconflow",
    enableStt: parseBoolean(source.ENABLE_STT, true),
    enablePublicStt: parseBoolean(source.ENABLE_PUBLIC_STT, true),
  };
}

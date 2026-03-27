export type AvailabilityReason = "disabled" | "unconfigured" | "unavailable";

export type ProviderAvailability = {
  available: boolean;
  reason?: AvailabilityReason;
};

export const STT_PROVIDER_IDS = ["siliconflow", "vosk"] as const;

export type SttProviderId = (typeof STT_PROVIDER_IDS)[number];

export const STT_PROVIDER_LABELS: Record<SttProviderId, string> = {
  siliconflow: "SiliconFlow",
  vosk: "Vosk CN",
};

export function isSttProviderId(value: string): value is SttProviderId {
  return STT_PROVIDER_IDS.includes(value as SttProviderId);
}

export type PublicSttProviderStatus = ProviderAvailability & {
  id: SttProviderId;
  label: string;
};

export type PublicSttStatus = ProviderAvailability & {
  defaultProvider: SttProviderId;
  providers: PublicSttProviderStatus[];
};

export type PublicProviderStatus = {
  tts: ProviderAvailability & { provider: string };
  stt: PublicSttStatus;
};

export type TtsSynthesizeInput = {
  text: string;
  voice: string;
  rate: string;
  pitch: string;
  style: string;
  outputFormat?: string;
};

export type TtsProvider = {
  id: string;
  synthesize: (input: TtsSynthesizeInput) => Promise<ArrayBuffer>;
};

export type SttTranscribeInput = {
  file: File;
};

export type SttTranscribeResult = {
  text: string;
  raw?: unknown;
};

export type SttProvider = {
  id: SttProviderId;
  label: string;
  transcribe: (input: SttTranscribeInput) => Promise<SttTranscribeResult>;
};

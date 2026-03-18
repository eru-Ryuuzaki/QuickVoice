export type AvailabilityReason = "disabled" | "unconfigured" | "unavailable";

export type ProviderAvailability = {
  available: boolean;
  reason?: AvailabilityReason;
};

export type PublicProviderStatus = {
  tts: ProviderAvailability & { provider: string };
  stt: ProviderAvailability & { provider: string };
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
  id: string;
  transcribe: (input: SttTranscribeInput) => Promise<SttTranscribeResult>;
};

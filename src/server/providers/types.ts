export type AvailabilityReason = "disabled" | "unconfigured" | "unavailable";

export type ProviderAvailability = {
  available: boolean;
  reason?: AvailabilityReason;
};

export const STT_PROVIDER_IDS = ["volcengine", "vosk"] as const;
export type SttProviderId = (typeof STT_PROVIDER_IDS)[number];

export const STT_PROVIDER_LABELS: Record<SttProviderId, string> = {
  volcengine: "Volcengine",
  vosk: "Vosk CN",
};

export function isSttProviderId(value: string): value is SttProviderId {
  return STT_PROVIDER_IDS.includes(value as SttProviderId);
}

export const TTS_PROVIDER_IDS = ["minimax", "microsoft_unofficial"] as const;
export type TtsProviderId = (typeof TTS_PROVIDER_IDS)[number];

export const TTS_PROVIDER_LABELS: Record<TtsProviderId, string> = {
  minimax: "MiniMax",
  microsoft_unofficial: "Microsoft Unofficial",
};

export function isTtsProviderId(value: string): value is TtsProviderId {
  return TTS_PROVIDER_IDS.includes(value as TtsProviderId);
}

export type PublicSelectableProviderStatus<TId extends string> =
  ProviderAvailability & {
    id: TId;
    label: string;
  };

export type PublicSttProviderStatus =
  PublicSelectableProviderStatus<SttProviderId>;

export type PublicTtsProviderStatus =
  PublicSelectableProviderStatus<TtsProviderId>;

export type PublicTtsProviderSettings = {
  defaultModel: string;
  modelOptions: string[];
  defaultVoice: string;
  voiceOptions: string[];
};

export type PublicSttStatus = ProviderAvailability & {
  defaultProvider: SttProviderId;
  defaultModel: string;
  modelOptions: string[];
  providers: PublicSttProviderStatus[];
};

export type PublicTtsStatus = ProviderAvailability & {
  defaultProvider: TtsProviderId;
  defaultModel: string;
  modelOptions: string[];
  defaultVoice: string;
  voiceOptions: string[];
  providerSettings: Record<TtsProviderId, PublicTtsProviderSettings>;
  providers: PublicTtsProviderStatus[];
};

export type PublicSummaryStatus = ProviderAvailability & {
  provider: "openai";
  defaultModel: string;
  modelOptions: string[];
};

export type PublicProviderStatus = {
  tts: PublicTtsStatus;
  stt: PublicSttStatus;
  summary: PublicSummaryStatus;
};

export type TtsSynthesizeInput = {
  text: string;
  voice: string;
  model: string;
  rate: string;
  pitch: string;
  style: string;
  outputFormat?: string;
};

export type TtsProvider = {
  id: TtsProviderId;
  label: string;
  synthesize: (input: TtsSynthesizeInput) => Promise<ArrayBuffer>;
};

export type SttTranscribeInput = {
  file: File;
  model: string;
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

export type SummaryInput = {
  transcript: string;
  model: string;
};

export type SummaryResult = {
  title: string;
  summary: string;
  keyPoints: string[];
  actionItems: string[];
  keywords: string[];
  cleanTranscript: string;
  model: string;
};

export type SummaryProvider = {
  id: "openai";
  summarize: (input: SummaryInput) => Promise<SummaryResult>;
};

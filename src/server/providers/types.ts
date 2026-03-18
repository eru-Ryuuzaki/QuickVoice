export type AvailabilityReason = "disabled" | "unconfigured" | "unavailable";

export type ProviderAvailability = {
  available: boolean;
  reason?: AvailabilityReason;
};

export type PublicProviderStatus = {
  tts: ProviderAvailability & { provider: string };
  stt: ProviderAvailability & { provider: string };
};

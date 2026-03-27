import { loadConfig } from "@/server/platform/env";
import {
  STT_PROVIDER_IDS,
  STT_PROVIDER_LABELS,
  type PublicProviderStatus,
  type PublicSttProviderStatus,
  type SttProviderId,
} from "@/server/providers/types";

type RegistryConfigInput = Partial<{
  TTS_PROVIDER: string;
  STT_PROVIDER: string;
  ENABLE_STT: string;
  ENABLE_PUBLIC_STT: string;
  ENABLE_STT_SILICONFLOW: string;
  ENABLE_STT_VOSK: string;
  VOSK_WS_URL: string;
}>;

export function createProviderRegistry(overrides?: RegistryConfigInput) {
  const config = loadConfig({ ...process.env, ...overrides });

  function buildSttProviderStatus(id: SttProviderId): PublicSttProviderStatus {
    if (!config.enableStt || !config.enablePublicStt) {
      return {
        id,
        label: STT_PROVIDER_LABELS[id],
        available: false,
        reason: "disabled",
      };
    }

    if (id === "siliconflow" && !config.enableSttSiliconflow) {
      return {
        id,
        label: STT_PROVIDER_LABELS[id],
        available: false,
        reason: "disabled",
      };
    }

    if (id === "vosk") {
      if (!config.enableSttVosk) {
        return {
          id,
          label: STT_PROVIDER_LABELS[id],
          available: false,
          reason: "disabled",
        };
      }

      if (!config.voskWsUrl) {
        return {
          id,
          label: STT_PROVIDER_LABELS[id],
          available: false,
          reason: "unconfigured",
        };
      }
    }

    return {
      id,
      label: STT_PROVIDER_LABELS[id],
      available: true,
    };
  }

  async function getPublicStatus(): Promise<PublicProviderStatus> {
    const tts = {
      available: true,
      provider: config.ttsProvider,
    };

    const providers = STT_PROVIDER_IDS.map((id) => buildSttProviderStatus(id));
    const sttAvailable = providers.some((provider) => provider.available);
    const sttReason = sttAvailable
      ? undefined
      : providers.some((provider) => provider.reason === "unconfigured")
        ? "unconfigured"
        : "disabled";

    return {
      tts,
      stt: {
        available: sttAvailable,
        reason: sttReason,
        defaultProvider: config.sttProvider,
        providers,
      },
    };
  }

  return {
    getPublicStatus,
  };
}

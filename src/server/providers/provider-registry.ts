import { loadConfig } from "@/server/platform/env";
import {
  STT_PROVIDER_IDS,
  STT_PROVIDER_LABELS,
  TTS_PROVIDER_IDS,
  TTS_PROVIDER_LABELS,
  type PublicProviderStatus,
  type PublicSelectableProviderStatus,
  type PublicSttProviderStatus,
  type PublicTtsProviderStatus,
  type SttProviderId,
  type TtsProviderId,
} from "@/server/providers/types";

type RegistryConfigInput = Partial<{
  TTS_PROVIDER: string;
  STT_PROVIDER: string;
  VOLCENGINE_STT_ENABLED: string;
  VOLCENGINE_STT_API_KEY: string;
  VOLCENGINE_STT_MODEL: string;
  VOLCENGINE_STT_MODEL_OPTIONS: string;
  VOSK_STT_ENABLED: string;
  VOSK_STT_WS_URL: string;
  MINIMAX_TTS_ENABLED: string;
  MINIMAX_TTS_API_KEY: string;
  MINIMAX_TTS_MODEL: string;
  MINIMAX_TTS_MODEL_OPTIONS: string;
  MINIMAX_TTS_ENDPOINT: string;
  MINIMAX_TTS_VOICE_ID: string;
  MINIMAX_TTS_VOICE_OPTIONS: string;
  MICROSOFT_TTS_ENABLED: string;
  MICROSOFT_TTS_VOICE_ID: string;
  MICROSOFT_TTS_VOICE_OPTIONS: string;
  OPENAI_SUMMARY_API_KEY: string;
  OPENAI_SUMMARY_MODEL: string;
  OPENAI_SUMMARY_MODEL_OPTIONS: string;
}>;

function disabled<TId extends string>(
  id: TId,
  label: string,
): PublicSelectableProviderStatus<TId> {
  return { id, label, available: false, reason: "disabled" };
}

function unconfigured<TId extends string>(
  id: TId,
  label: string,
): PublicSelectableProviderStatus<TId> {
  return { id, label, available: false, reason: "unconfigured" };
}

function aggregateReason(
  providers: Array<PublicSelectableProviderStatus<string>>,
) {
  const hasAvailable = providers.some((provider) => provider.available);
  if (hasAvailable) {
    return undefined;
  }

  return providers.some((provider) => provider.reason === "unconfigured")
    ? "unconfigured"
    : "disabled";
}

export function createProviderRegistry(overrides?: RegistryConfigInput) {
  const config = loadConfig({ ...process.env, ...overrides });

  function buildSttProviderStatus(id: SttProviderId): PublicSttProviderStatus {
    const label = STT_PROVIDER_LABELS[id];

    if (id === "volcengine") {
      if (!config.enableSttVolcengine) {
        return disabled(id, label);
      }

      if (!config.volcengineSttApiKey) {
        return unconfigured(id, label);
      }
    }

    if (id === "vosk") {
      if (!config.enableSttVosk) {
        return disabled(id, label);
      }

      if (!config.voskWsUrl) {
        return unconfigured(id, label);
      }
    }

    return { id, label, available: true };
  }

  function buildTtsProviderStatus(id: TtsProviderId): PublicTtsProviderStatus {
    const label = TTS_PROVIDER_LABELS[id];

    if (id === "minimax") {
      if (!config.enableTtsMinimax) {
        return disabled(id, label);
      }

      if (!config.minimaxApiKey) {
        return unconfigured(id, label);
      }
    }

    if (id === "microsoft_unofficial" && !config.enableTtsMicrosoftUnofficial) {
      return disabled(id, label);
    }

    return { id, label, available: true };
  }

  async function getPublicStatus(): Promise<PublicProviderStatus> {
    const sttProviders = STT_PROVIDER_IDS.map((id) =>
      buildSttProviderStatus(id),
    );
    const ttsProviders = TTS_PROVIDER_IDS.map((id) =>
      buildTtsProviderStatus(id),
    );
    const sttAvailable = sttProviders.some((provider) => provider.available);
    const ttsAvailable = ttsProviders.some((provider) => provider.available);
    const summaryAvailable = Boolean(config.openaiApiKey);
    const providerSettings = {
      minimax: {
        defaultModel: config.minimaxTtsModel,
        modelOptions: config.minimaxTtsModelOptions,
        defaultVoice: config.minimaxTtsVoiceId,
        voiceOptions: config.minimaxTtsVoiceOptions,
      },
      microsoft_unofficial: {
        defaultModel: config.microsoftTtsModel,
        modelOptions: config.microsoftTtsModelOptions,
        defaultVoice: config.microsoftTtsVoiceId,
        voiceOptions: config.microsoftTtsVoiceOptions,
      },
    };
    const defaultTtsSettings = providerSettings[config.ttsProvider];

    return {
      tts: {
        available: ttsAvailable,
        reason: aggregateReason(ttsProviders),
        defaultProvider: config.ttsProvider,
        defaultModel: defaultTtsSettings.defaultModel,
        modelOptions: defaultTtsSettings.modelOptions,
        defaultVoice: defaultTtsSettings.defaultVoice,
        voiceOptions: defaultTtsSettings.voiceOptions,
        providerSettings,
        providers: ttsProviders,
      },
      stt: {
        available: sttAvailable,
        reason: aggregateReason(sttProviders),
        defaultProvider: config.sttProvider,
        defaultModel: config.volcengineSttModel,
        modelOptions: config.volcengineSttModelOptions,
        providers: sttProviders,
      },
      summary: {
        provider: "openai",
        available: summaryAvailable,
        reason: summaryAvailable ? undefined : "unconfigured",
        defaultModel: config.openaiSummaryModel,
        modelOptions: config.openaiSummaryModelOptions,
      },
    };
  }

  return {
    getPublicStatus,
  };
}

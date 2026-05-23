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
  ENABLE_STT: string;
  ENABLE_PUBLIC_STT: string;
  ENABLE_STT_VOLCENGINE: string;
  ENABLE_STT_VOSK: string;
  ENABLE_TTS_MINIMAX: string;
  ENABLE_TTS_MICROSOFT_UNOFFICIAL: string;
  VOLCENGINE_ACCESS_KEY_ID: string;
  VOLCENGINE_SECRET_ACCESS_KEY: string;
  VOLCENGINE_STT_APP_ID: string;
  VOSK_WS_URL: string;
  MINIMAX_API_KEY: string;
  MINIMAX_GROUP_ID: string;
  OPENAI_API_KEY: string;
  OPENAI_SUMMARY_MODEL: string;
  OPENAI_SUMMARY_MODELS: string;
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
    if (!config.enableStt || !config.enablePublicStt) {
      return disabled(id, label);
    }

    if (id === "volcengine") {
      if (!config.enableSttVolcengine) {
        return disabled(id, label);
      }

      if (
        !config.volcengineAccessKeyId ||
        !config.volcengineSecretAccessKey ||
        !config.volcengineSttAppId
      ) {
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

      if (!config.minimaxApiKey || !config.minimaxGroupId) {
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

    return {
      tts: {
        available: ttsAvailable,
        reason: aggregateReason(ttsProviders),
        defaultProvider: config.ttsProvider,
        providers: ttsProviders,
      },
      stt: {
        available: sttAvailable,
        reason: aggregateReason(sttProviders),
        defaultProvider: config.sttProvider,
        providers: sttProviders,
      },
      summary: {
        provider: "openai",
        available: summaryAvailable,
        reason: summaryAvailable ? undefined : "unconfigured",
        defaultModel: config.openaiSummaryModel,
        models: config.openaiSummaryModels.map((model) => ({
          id: model,
          label: model,
          default: model === config.openaiSummaryModel,
        })),
      },
    };
  }

  return {
    getPublicStatus,
  };
}

import { loadConfig } from "@/server/platform/env";
import type { PublicProviderStatus } from "@/server/providers/types";

type RegistryConfigInput = Partial<{
  TTS_PROVIDER: string;
  STT_PROVIDER: string;
  ENABLE_STT: string;
  ENABLE_PUBLIC_STT: string;
}>;

export function createProviderRegistry(overrides?: RegistryConfigInput) {
  const config = loadConfig({ ...process.env, ...overrides });

  async function getPublicStatus(): Promise<PublicProviderStatus> {
    const tts = {
      available: true,
      provider: config.ttsProvider,
    };

    if (!config.enableStt || !config.enablePublicStt) {
      return {
        tts,
        stt: {
          available: false,
          provider: config.sttProvider,
          reason: "disabled",
        },
      };
    }

    return {
      tts,
      stt: {
        available: true,
        provider: config.sttProvider,
      },
    };
  }

  return {
    getPublicStatus,
  };
}

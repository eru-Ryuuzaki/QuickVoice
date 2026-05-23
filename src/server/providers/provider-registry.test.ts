import { createProviderRegistry } from "@/server/providers/provider-registry";

test("exposes MVP provider options and defaults", async () => {
  const registry = createProviderRegistry({
    VOLCENGINE_ACCESS_KEY_ID: "ak",
    VOLCENGINE_SECRET_ACCESS_KEY: "sk",
    VOLCENGINE_STT_APP_ID: "app",
    VOSK_WS_URL: "ws://vosk-cn:2700",
    MINIMAX_API_KEY: "minimax",
    MINIMAX_GROUP_ID: "group",
    OPENAI_API_KEY: "openai",
  });

  const status = await registry.getPublicStatus();

  expect(status.stt.defaultProvider).toBe("volcengine");
  expect(status.stt.providers).toEqual([
    { id: "volcengine", label: "Volcengine", available: true },
    { id: "vosk", label: "Vosk CN", available: true },
  ]);
  expect(status.tts.defaultProvider).toBe("minimax");
  expect(status.tts.defaultModel).toBe("speech-2.8-turbo");
  expect(status.tts.providers).toEqual([
    { id: "minimax", label: "MiniMax", available: true },
    {
      id: "microsoft_unofficial",
      label: "Microsoft Unofficial",
      available: true,
    },
  ]);
  expect(status.stt.defaultModel).toBe("volc.bigasr.auc_turbo");
  expect(status.summary.available).toBe(true);
  expect(status.summary.defaultModel).toBe("gpt-5.5");
  expect(status.summary).not.toHaveProperty("models");
});

test("does not expose SiliconFlow", async () => {
  const registry = createProviderRegistry({
    ENABLE_STT: "true",
    ENABLE_PUBLIC_STT: "true",
  });

  const status = await registry.getPublicStatus();

  expect(status.stt.providers.map((provider) => provider.id)).toEqual([
    "volcengine",
    "vosk",
  ]);
});

test("marks missing paid-provider credentials as unconfigured", async () => {
  const registry = createProviderRegistry({
    VOSK_WS_URL: "   ",
    OPENAI_API_KEY: "",
  });

  const status = await registry.getPublicStatus();

  expect(status.stt.providers).toEqual([
    {
      id: "volcengine",
      label: "Volcengine",
      available: false,
      reason: "unconfigured",
    },
    {
      id: "vosk",
      label: "Vosk CN",
      available: false,
      reason: "unconfigured",
    },
  ]);
  expect(status.tts.providers).toEqual([
    {
      id: "minimax",
      label: "MiniMax",
      available: false,
      reason: "unconfigured",
    },
    {
      id: "microsoft_unofficial",
      label: "Microsoft Unofficial",
      available: true,
    },
  ]);
  expect(status.summary.available).toBe(false);
  expect(status.summary.reason).toBe("unconfigured");
});

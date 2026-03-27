import { createProviderRegistry } from "@/server/providers/provider-registry";

test("marks all STT providers unavailable when public exposure is disabled", async () => {
  const registry = createProviderRegistry({
    ENABLE_STT: "true",
    ENABLE_PUBLIC_STT: "false",
    ENABLE_STT_SILICONFLOW: "true",
    ENABLE_STT_VOSK: "true",
  });

  const status = await registry.getPublicStatus();

  expect(status.tts.available).toBe(true);
  expect(status.stt.available).toBe(false);
  expect(status.stt.reason).toBe("disabled");
  expect(status.stt.providers).toEqual([
    {
      id: "siliconflow",
      label: "SiliconFlow",
      available: false,
      reason: "disabled",
    },
    {
      id: "vosk",
      label: "Vosk CN",
      available: false,
      reason: "disabled",
    },
  ]);
});

test("returns both STT providers and honors the configured default provider", async () => {
  const registry = createProviderRegistry({
    STT_PROVIDER: "vosk",
    ENABLE_STT: "true",
    ENABLE_PUBLIC_STT: "true",
    ENABLE_STT_SILICONFLOW: "true",
    ENABLE_STT_VOSK: "true",
    VOSK_WS_URL: "ws://vosk-cn:2700",
  });

  const status = await registry.getPublicStatus();

  expect(status.stt.available).toBe(true);
  expect(status.stt.defaultProvider).toBe("vosk");
  expect(status.stt.providers).toEqual([
    { id: "siliconflow", label: "SiliconFlow", available: true },
    { id: "vosk", label: "Vosk CN", available: true },
  ]);
});

test("marks Vosk as unconfigured when enabled without a websocket URL", async () => {
  const registry = createProviderRegistry({
    ENABLE_STT: "true",
    ENABLE_PUBLIC_STT: "true",
    ENABLE_STT_SILICONFLOW: "false",
    ENABLE_STT_VOSK: "true",
    VOSK_WS_URL: "   ",
  });

  const status = await registry.getPublicStatus();

  expect(status.stt.available).toBe(false);
  expect(status.stt.reason).toBe("unconfigured");
  expect(status.stt.providers).toEqual([
    {
      id: "siliconflow",
      label: "SiliconFlow",
      available: false,
      reason: "disabled",
    },
    {
      id: "vosk",
      label: "Vosk CN",
      available: false,
      reason: "unconfigured",
    },
  ]);
});

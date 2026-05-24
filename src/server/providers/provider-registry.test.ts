import { createProviderRegistry } from "@/server/providers/provider-registry";

test("exposes MVP provider options and defaults", async () => {
  const registry = createProviderRegistry({
    VOLCENGINE_STT_API_KEY: "api-key",
    VOLCENGINE_STT_MODEL_OPTIONS: "volc.bigasr.auc_turbo,volc.bigasr.auc",
    COS_SECRET_ID: "secret-id",
    COS_SECRET_KEY: "secret-key",
    COS_ENDPOINT: "https://quickvoice-1250000000.cos.ap-shanghai.myqcloud.com",
    VOSK_STT_WS_URL: "ws://vosk-cn:2700",
    MINIMAX_TTS_API_KEY: "minimax",
    MINIMAX_TTS_MODEL_OPTIONS: "speech-2.8-turbo,speech-2.8-hd",
    MINIMAX_TTS_VOICE_ID: "Chinese (Mandarin)_Warm_Girl",
    MINIMAX_TTS_VOICE_OPTIONS:
      "Chinese (Mandarin)_Warm_Girl,Chinese (Mandarin)_News_Anchor",
    MICROSOFT_TTS_VOICE_ID: "zh-CN-YunxiNeural",
    MICROSOFT_TTS_VOICE_OPTIONS: "zh-CN-YunxiNeural,en-US-JennyNeural",
    OPENAI_SUMMARY_API_KEY: "openai",
    OPENAI_SUMMARY_MODEL_OPTIONS: "gpt-5.5,gpt-5.5-mini",
  });

  const status = await registry.getPublicStatus();

  expect(status.stt.defaultProvider).toBe("volcengine");
  expect(status.stt.providers).toEqual([
    { id: "volcengine", label: "Volcengine", available: true },
    { id: "vosk", label: "Vosk CN", available: true },
  ]);
  expect(status.tts.defaultProvider).toBe("minimax");
  expect(status.tts.providerSettings.minimax).toEqual({
    defaultModel: "speech-2.8-turbo",
    modelOptions: ["speech-2.8-turbo", "speech-2.8-hd"],
    defaultVoice: "Chinese (Mandarin)_Warm_Girl",
    voiceOptions: [
      "Chinese (Mandarin)_Warm_Girl",
      "Chinese (Mandarin)_News_Anchor",
    ],
  });
  expect(status.tts.providerSettings.microsoft_unofficial).toEqual({
    defaultModel: "",
    modelOptions: [],
    defaultVoice: "zh-CN-YunxiNeural",
    voiceOptions: ["zh-CN-YunxiNeural", "en-US-JennyNeural"],
  });
  expect(status.tts.providerSettings.minimax.voiceOptions).not.toContain(
    "zh-CN-YunxiNeural",
  );
  expect(
    status.tts.providerSettings.microsoft_unofficial.voiceOptions,
  ).not.toContain("Chinese (Mandarin)_Warm_Girl");
  expect(status.tts.providers).toEqual([
    { id: "minimax", label: "MiniMax", available: true },
    {
      id: "microsoft_unofficial",
      label: "Microsoft Unofficial",
      available: true,
    },
  ]);
  expect(status.stt.defaultModel).toBe("volc.seedasr.auc");
  expect(status.stt.modelOptions).toEqual([
    "volc.seedasr.auc",
    "volc.bigasr.auc_turbo",
    "volc.bigasr.auc",
  ]);
  expect(status.summary.available).toBe(true);
  expect(status.summary.defaultModel).toBe("gpt-5.5");
  expect(status.summary.modelOptions).toEqual(["gpt-5.5", "gpt-5.5-mini"]);
});

test("exposes only active STT providers", async () => {
  const registry = createProviderRegistry({
    VOLCENGINE_STT_ENABLED: "true",
  });

  const status = await registry.getPublicStatus();

  expect(status.stt.providers.map((provider) => provider.id)).toEqual([
    "volcengine",
    "vosk",
  ]);
});

test("marks missing paid-provider credentials as unconfigured", async () => {
  const registry = createProviderRegistry({
    VOSK_STT_WS_URL: "   ",
    OPENAI_SUMMARY_API_KEY: "",
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

test("does not require legacy Volcengine AppKey or Secret fields", async () => {
  const registry = createProviderRegistry({
    VOLCENGINE_STT_API_KEY: "api-key",
    COS_SECRET_ID: "secret-id",
    COS_SECRET_KEY: "secret-key",
    COS_ENDPOINT: "https://quickvoice-1250000000.cos.ap-shanghai.myqcloud.com",
    VOSK_STT_WS_URL: "   ",
  });

  const status = await registry.getPublicStatus();

  expect(status.stt.providers[0]).toEqual({
    id: "volcengine",
    label: "Volcengine",
    available: true,
  });
});

test("marks Volcengine unconfigured when COS config is incomplete", async () => {
  const registry = createProviderRegistry({
    VOLCENGINE_STT_API_KEY: "api-key",
    COS_SECRET_ID: "",
    COS_SECRET_KEY: "",
    COS_ENDPOINT: "",
    VOSK_STT_WS_URL: "   ",
    MINIMAX_TTS_API_KEY: "minimax",
  });

  const status = await registry.getPublicStatus();

  expect(status.stt.providers[0]).toEqual({
    id: "volcengine",
    label: "Volcengine",
    available: false,
    reason: "unconfigured",
  });
  expect(status.stt.available).toBe(false);
  expect(status.stt.reason).toBe("unconfigured");
});

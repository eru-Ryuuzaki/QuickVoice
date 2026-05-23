import { loadConfig } from "@/server/platform/env";

test("defaults to the MVP provider stack", () => {
  const config = loadConfig({});

  expect(config.sttProvider).toBe("volcengine");
  expect(config.ttsProvider).toBe("minimax");
  expect(config.enableSttVolcengine).toBe(true);
  expect(config.enableSttVosk).toBe(true);
  expect(config.enableTtsMinimax).toBe(true);
  expect(config.enableTtsMicrosoftUnofficial).toBe(true);
  expect(config).not.toHaveProperty("enableStt");
  expect(config.volcengineSttModel).toBe("volc.bigasr.auc_turbo");
  expect(config.volcengineSttModelOptions).toEqual(["volc.bigasr.auc_turbo"]);
  expect(config.minimaxTtsModel).toBe("speech-2.8-turbo");
  expect(config.minimaxTtsModelOptions).toContain("speech-2.8-turbo");
  expect(config.minimaxTtsVoiceId).toBe("Chinese (Mandarin)_Warm_Girl");
  expect(config.minimaxTtsVoiceOptions).toEqual([
    "Chinese (Mandarin)_Warm_Girl",
    "Chinese (Mandarin)_News_Anchor",
    "English_expressive_narrator",
  ]);
  expect(config).not.toHaveProperty("minimaxTtsStyle");
  expect(config).not.toHaveProperty("minimaxTtsStyleOptions");
  expect(config.microsoftTtsModel).toBe("");
  expect(config.microsoftTtsModelOptions).toEqual([]);
  expect(config.microsoftTtsVoiceId).toBe("zh-CN-XiaoxiaoNeural");
  expect(config.microsoftTtsVoiceOptions).toEqual([
    "zh-CN-XiaoxiaoNeural",
    "zh-CN-YunxiNeural",
  ]);
  expect(config).not.toHaveProperty("microsoftTtsStyle");
  expect(config).not.toHaveProperty("microsoftTtsStyleOptions");
  expect(config.openaiSummaryModel).toBe("gpt-5.5");
  expect(config.openaiSummaryModelOptions).toEqual(["gpt-5.5"]);
});

test("keeps Vosk configurable as an STT provider", () => {
  const config = loadConfig({
    STT_PROVIDER: "vosk",
    VOSK_STT_WS_URL: " ws://localhost:2700 ",
  });

  expect(config.sttProvider).toBe("vosk");
  expect(config.voskWsUrl).toBe("ws://localhost:2700");
});

test("falls back to Volcengine when an unsupported STT provider is configured", () => {
  const config = loadConfig({
    STT_PROVIDER: "legacy_provider",
  });

  expect(config.sttProvider).toBe("volcengine");
});

test("parses manual model defaults and endpoint overrides", () => {
  const config = loadConfig({
    VOLCENGINE_STT_MODEL: " custom-stt-model ",
    VOLCENGINE_STT_MODEL_OPTIONS: " custom-stt-model, backup-stt-model ",
    VOLCENGINE_STT_ENDPOINT: " https://stt.example.test ",
    MINIMAX_TTS_MODEL: " speech-custom ",
    MINIMAX_TTS_MODEL_OPTIONS: " speech-custom, speech-alt ",
    MINIMAX_TTS_ENDPOINT: " https://tts.example.test ",
    MINIMAX_TTS_VOICE_ID: " minimax-main ",
    MINIMAX_TTS_VOICE_OPTIONS: " minimax-main, minimax-backup ",
    MICROSOFT_TTS_VOICE_ID: " zh-CN-YunxiNeural ",
    MICROSOFT_TTS_VOICE_OPTIONS: " zh-CN-YunxiNeural, en-US-JennyNeural ",
    OPENAI_SUMMARY_API_KEY: " openai-key ",
    OPENAI_SUMMARY_MODEL: " gpt-custom ",
    OPENAI_SUMMARY_MODEL_OPTIONS: " gpt-custom, gpt-alt ",
    OPENAI_SUMMARY_ENDPOINT: " https://summary.example.test ",
  });

  expect(config.volcengineSttModel).toBe("custom-stt-model");
  expect(config.volcengineSttModelOptions).toEqual([
    "custom-stt-model",
    "backup-stt-model",
  ]);
  expect(config.volcengineSttEndpoint).toBe("https://stt.example.test");
  expect(config.minimaxTtsModel).toBe("speech-custom");
  expect(config.minimaxTtsModelOptions).toEqual([
    "speech-custom",
    "speech-alt",
  ]);
  expect(config.minimaxTtsEndpoint).toBe("https://tts.example.test");
  expect(config.minimaxTtsVoiceId).toBe("minimax-main");
  expect(config.minimaxTtsVoiceOptions).toEqual([
    "minimax-main",
    "minimax-backup",
  ]);
  expect(config).not.toHaveProperty("minimaxTtsStyle");
  expect(config).not.toHaveProperty("minimaxTtsStyleOptions");
  expect(config.microsoftTtsModel).toBe("");
  expect(config.microsoftTtsModelOptions).toEqual([]);
  expect(config.microsoftTtsVoiceId).toBe("zh-CN-YunxiNeural");
  expect(config.microsoftTtsVoiceOptions).toEqual([
    "zh-CN-YunxiNeural",
    "en-US-JennyNeural",
  ]);
  expect(config.openaiApiKey).toBe("openai-key");
  expect(config).not.toHaveProperty("microsoftTtsStyle");
  expect(config).not.toHaveProperty("microsoftTtsStyleOptions");
  expect(config.openaiSummaryModel).toBe("gpt-custom");
  expect(config.openaiSummaryModelOptions).toEqual(["gpt-custom", "gpt-alt"]);
  expect(config.openaiSummaryEndpoint).toBe("https://summary.example.test");
});

import { loadConfig } from "@/server/platform/env";
import { readFileSync } from "node:fs";
import path from "node:path";

test("defaults to the MVP provider stack", () => {
  const config = loadConfig({});

  expect(config.sttProvider).toBe("volcengine");
  expect(config.ttsProvider).toBe("minimax");
  expect(config.enableSttVolcengine).toBe(true);
  expect(config.enableSttVosk).toBe(true);
  expect(config.enableTtsMinimax).toBe(true);
  expect(config.enableTtsMicrosoftUnofficial).toBe(true);
  expect(config).not.toHaveProperty("enableStt");
  expect(config.volcengineSttModel).toBe("volc.seedasr.auc");
  expect(config.volcengineSttModelOptions).toEqual(["volc.seedasr.auc"]);
  expect(config.cosSecretId).toBe("");
  expect(config.cosSecretKey).toBe("");
  expect(config.cosEndpoint).toBe("");
  expect(config.cosPublicBaseUrl).toBe("");
  expect(config.cosSttPrefix).toBe("quickvoice/stt");
  expect(config.cosSttUrlTtlSeconds).toBe(3600);
  expect(config.cosConfigured).toBe(false);
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
    COS_SECRET_ID: " secret-id ",
    COS_SECRET_KEY: " secret-key ",
    COS_ENDPOINT: " https://quickvoice-1250000000.cos.ap-shanghai.myqcloud.com/ ",
    COS_PUBLIC_BASE_URL: " https://cdn.example.test/audio/ ",
    COS_STT_PREFIX: " speech/uploads/ ",
    COS_STT_URL_TTL_SECONDS: " 900 ",
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
  expect(config.cosSecretId).toBe("secret-id");
  expect(config.cosSecretKey).toBe("secret-key");
  expect(config.cosEndpoint).toBe(
    "https://quickvoice-1250000000.cos.ap-shanghai.myqcloud.com",
  );
  expect(config.cosPublicBaseUrl).toBe("https://cdn.example.test/audio");
  expect(config.cosSttPrefix).toBe("speech/uploads");
  expect(config.cosSttUrlTtlSeconds).toBe(900);
  expect(config.cosConfigured).toBe(true);
});

test("uses the fallback COS URL TTL for invalid values", () => {
  const config = loadConfig({
    COS_STT_URL_TTL_SECONDS: "not-a-number",
  });

  expect(config.cosSttUrlTtlSeconds).toBe(3600);
});

test(".env.example documents the Volcengine submit endpoint", () => {
  const envExample = readFileSync(
    path.join(process.cwd(), ".env.example"),
    "utf8",
  );

  expect(envExample).toContain(
    "VOLCENGINE_STT_ENDPOINT=https://openspeech.bytedance.com/api/v3/auc/bigmodel/submit",
  );
  expect(envExample).not.toContain("/recognize/flash");
});

import { loadConfig } from "@/server/platform/env";

test("defaults to the MVP provider stack", () => {
  const config = loadConfig({});

  expect(config.sttProvider).toBe("volcengine");
  expect(config.ttsProvider).toBe("minimax");
  expect(config.summaryProvider).toBe("openai");
  expect(config.enableSttVolcengine).toBe(true);
  expect(config.enableSttVosk).toBe(true);
  expect(config.enableTtsMinimax).toBe(true);
  expect(config.enableTtsMicrosoftUnofficial).toBe(true);
  expect(config.volcengineSttModel).toBe("volc.bigasr.auc_turbo");
  expect(config.minimaxTtsModel).toBe("speech-2.8-turbo");
  expect(config.openaiSummaryModel).toBe("gpt-5.5");
});

test("keeps Vosk configurable as an STT provider", () => {
  const config = loadConfig({
    STT_PROVIDER: "vosk",
    VOSK_WS_URL: " ws://localhost:2700 ",
  });

  expect(config.sttProvider).toBe("vosk");
  expect(config.voskWsUrl).toBe("ws://localhost:2700");
});

test("falls back to Volcengine when removed SiliconFlow is configured", () => {
  const config = loadConfig({
    STT_PROVIDER: "siliconflow",
  });

  expect(config.sttProvider).toBe("volcengine");
});

test("parses manual model defaults and endpoint overrides", () => {
  const config = loadConfig({
    VOLCENGINE_STT_MODEL: " custom-stt-model ",
    VOLCENGINE_STT_ENDPOINT: " https://stt.example.test ",
    MINIMAX_TTS_MODEL: " speech-custom ",
    MINIMAX_TTS_ENDPOINT: " https://tts.example.test ",
    OPENAI_SUMMARY_MODEL: " gpt-custom ",
    OPENAI_SUMMARY_ENDPOINT: " https://summary.example.test ",
  });

  expect(config.volcengineSttModel).toBe("custom-stt-model");
  expect(config.volcengineSttEndpoint).toBe("https://stt.example.test");
  expect(config.minimaxTtsModel).toBe("speech-custom");
  expect(config.minimaxTtsEndpoint).toBe("https://tts.example.test");
  expect(config.openaiSummaryModel).toBe("gpt-custom");
  expect(config.openaiSummaryEndpoint).toBe("https://summary.example.test");
});

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
  expect(config.openaiSummaryModel).toBe("gpt-5.5");
  expect(config.openaiSummaryModels).toEqual([
    "gpt-5.5",
    "gpt-5.4-mini",
    "gpt-5.4-nano",
  ]);
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

test("parses summary model allowlist", () => {
  const config = loadConfig({
    OPENAI_SUMMARY_MODEL: " gpt-5.4-mini ",
    OPENAI_SUMMARY_MODELS: " gpt-5.5, gpt-5.4-mini ,, gpt-5.4-nano ",
  });

  expect(config.openaiSummaryModel).toBe("gpt-5.4-mini");
  expect(config.openaiSummaryModels).toEqual([
    "gpt-5.5",
    "gpt-5.4-mini",
    "gpt-5.4-nano",
  ]);
});

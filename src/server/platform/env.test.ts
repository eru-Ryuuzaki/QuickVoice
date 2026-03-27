import { loadConfig } from "@/server/platform/env";

test("falls back to default siliconflow token when env value is blank", () => {
  const config = loadConfig({
    SILICONFLOW_API_KEY: "   ",
  });

  expect(config.siliconflowApiKey).toBe(
    "sk-wtldsvuprmwltxpbspbmawtolbacghzawnjhtlzlnujjkfhh",
  );
});

test("parses Vosk-specific provider config", () => {
  const config = loadConfig({
    STT_PROVIDER: "vosk",
    ENABLE_STT_VOSK: "true",
    VOSK_WS_URL: " ws://localhost:2700 ",
  });

  expect(config.sttProvider).toBe("vosk");
  expect(config.enableSttVosk).toBe(true);
  expect(config.voskWsUrl).toBe("ws://localhost:2700");
});

test("treats a blank Vosk URL as unconfigured", () => {
  const config = loadConfig({
    VOSK_WS_URL: "   ",
  });

  expect(config.voskWsUrl).toBe("");
});

import { GET } from "@/app/api/providers/status/route";

test("returns provider status for public UI", async () => {
  const previousEnv = {
    VOLCENGINE_STT_ENABLED: process.env.VOLCENGINE_STT_ENABLED,
    VOSK_STT_ENABLED: process.env.VOSK_STT_ENABLED,
    MINIMAX_TTS_ENABLED: process.env.MINIMAX_TTS_ENABLED,
    MICROSOFT_TTS_ENABLED: process.env.MICROSOFT_TTS_ENABLED,
    VOLCENGINE_STT_API_KEY: process.env.VOLCENGINE_STT_API_KEY,
    MINIMAX_TTS_API_KEY: process.env.MINIMAX_TTS_API_KEY,
    OPENAI_SUMMARY_API_KEY: process.env.OPENAI_SUMMARY_API_KEY,
    OPENAI_SUMMARY_MODEL_OPTIONS: process.env.OPENAI_SUMMARY_MODEL_OPTIONS,
  };

  process.env.VOLCENGINE_STT_ENABLED = "true";
  process.env.VOSK_STT_ENABLED = "false";
  process.env.MINIMAX_TTS_ENABLED = "true";
  process.env.MICROSOFT_TTS_ENABLED = "true";
  process.env.VOLCENGINE_STT_API_KEY = "api-key";
  process.env.MINIMAX_TTS_API_KEY = "minimax";
  process.env.OPENAI_SUMMARY_API_KEY = "openai";
  process.env.OPENAI_SUMMARY_MODEL_OPTIONS = "gpt-5.5,gpt-5.5-mini";

  try {
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.tts.defaultProvider).toBe("minimax");
    expect(payload.tts.defaultModel).toBe("speech-2.8-turbo");
    expect(payload.tts.providerSettings.minimax).toMatchObject({
      defaultModel: "speech-2.8-turbo",
      defaultVoice: "Chinese (Mandarin)_Warm_Girl",
      voiceOptions: [
        "Chinese (Mandarin)_Warm_Girl",
        "Chinese (Mandarin)_News_Anchor",
        "English_expressive_narrator",
      ],
    });
    expect(payload.tts.providerSettings.microsoft_unofficial).toMatchObject({
      defaultModel: "",
      defaultVoice: "zh-CN-XiaoxiaoNeural",
      voiceOptions: ["zh-CN-XiaoxiaoNeural", "zh-CN-YunxiNeural"],
    });
    expect(payload.tts.providerSettings.minimax).not.toHaveProperty(
      "defaultStyle",
    );
    expect(payload.tts.providerSettings.minimax).not.toHaveProperty(
      "styleOptions",
    );
    expect(
      payload.tts.providerSettings.microsoft_unofficial,
    ).not.toHaveProperty("defaultStyle");
    expect(
      payload.tts.providerSettings.microsoft_unofficial,
    ).not.toHaveProperty("styleOptions");
    expect(payload.tts.providerSettings.minimax.voiceOptions).not.toContain(
      "zh-CN-XiaoxiaoNeural",
    );
    expect(payload.tts.providers).toEqual([
      { id: "minimax", label: "MiniMax", available: true },
      {
        id: "microsoft_unofficial",
        label: "Microsoft Unofficial",
        available: true,
      },
    ]);
    expect(payload.stt.available).toBe(true);
    expect(payload.stt.defaultProvider).toBe("volcengine");
    expect(payload.stt.defaultModel).toBe("volc.bigasr.auc_turbo");
    expect(payload.stt.providers).toEqual([
      { id: "volcengine", label: "Volcengine", available: true },
      {
        id: "vosk",
        label: "Vosk CN",
        available: false,
        reason: "disabled",
      },
    ]);
    expect(payload.summary).toMatchObject({
      provider: "openai",
      available: true,
      defaultModel: "gpt-5.5",
      modelOptions: ["gpt-5.5", "gpt-5.5-mini"],
    });
  } finally {
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value == null) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
});

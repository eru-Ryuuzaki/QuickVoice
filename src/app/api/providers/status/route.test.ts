import { GET } from "@/app/api/providers/status/route";

test("returns provider status for public UI", async () => {
  const previousEnv = {
    ENABLE_STT: process.env.ENABLE_STT,
    ENABLE_PUBLIC_STT: process.env.ENABLE_PUBLIC_STT,
    ENABLE_STT_VOLCENGINE: process.env.ENABLE_STT_VOLCENGINE,
    ENABLE_STT_VOSK: process.env.ENABLE_STT_VOSK,
    ENABLE_TTS_MINIMAX: process.env.ENABLE_TTS_MINIMAX,
    ENABLE_TTS_MICROSOFT_UNOFFICIAL:
      process.env.ENABLE_TTS_MICROSOFT_UNOFFICIAL,
    VOLCENGINE_ACCESS_KEY_ID: process.env.VOLCENGINE_ACCESS_KEY_ID,
    VOLCENGINE_SECRET_ACCESS_KEY: process.env.VOLCENGINE_SECRET_ACCESS_KEY,
    VOLCENGINE_STT_APP_ID: process.env.VOLCENGINE_STT_APP_ID,
    MINIMAX_API_KEY: process.env.MINIMAX_API_KEY,
    MINIMAX_GROUP_ID: process.env.MINIMAX_GROUP_ID,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  };

  process.env.ENABLE_STT = "true";
  process.env.ENABLE_PUBLIC_STT = "true";
  process.env.ENABLE_STT_VOLCENGINE = "true";
  process.env.ENABLE_STT_VOSK = "false";
  process.env.ENABLE_TTS_MINIMAX = "true";
  process.env.ENABLE_TTS_MICROSOFT_UNOFFICIAL = "true";
  process.env.VOLCENGINE_ACCESS_KEY_ID = "ak";
  process.env.VOLCENGINE_SECRET_ACCESS_KEY = "sk";
  process.env.VOLCENGINE_STT_APP_ID = "app";
  process.env.MINIMAX_API_KEY = "minimax";
  process.env.MINIMAX_GROUP_ID = "group";
  process.env.OPENAI_API_KEY = "openai";

  try {
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.tts.defaultProvider).toBe("minimax");
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

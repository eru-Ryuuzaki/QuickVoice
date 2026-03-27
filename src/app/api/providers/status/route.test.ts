import { GET } from "@/app/api/providers/status/route";

test("returns provider status for public UI", async () => {
  const previousEnableStt = process.env.ENABLE_STT;
  const previousEnablePublicStt = process.env.ENABLE_PUBLIC_STT;
  const previousEnableSttSiliconflow = process.env.ENABLE_STT_SILICONFLOW;
  const previousEnableSttVosk = process.env.ENABLE_STT_VOSK;

  process.env.ENABLE_STT = "true";
  process.env.ENABLE_PUBLIC_STT = "true";
  process.env.ENABLE_STT_SILICONFLOW = "true";
  process.env.ENABLE_STT_VOSK = "false";

  try {
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.tts.available).toBe(true);
    expect(payload.stt.available).toBe(true);
    expect(payload.stt.defaultProvider).toBe("siliconflow");
    expect(payload.stt.providers).toEqual([
      { id: "siliconflow", label: "SiliconFlow", available: true },
      {
        id: "vosk",
        label: "Vosk CN",
        available: false,
        reason: "disabled",
      },
    ]);
  } finally {
    process.env.ENABLE_STT = previousEnableStt;
    process.env.ENABLE_PUBLIC_STT = previousEnablePublicStt;
    process.env.ENABLE_STT_SILICONFLOW = previousEnableSttSiliconflow;
    process.env.ENABLE_STT_VOSK = previousEnableSttVosk;
  }
});

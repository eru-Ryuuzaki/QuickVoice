import { transcribeAudio } from "@/server/core/transcribe-audio";
import type { SttProvider } from "@/server/providers/types";

test("returns transcript for valid audio upload", async () => {
  const provider: SttProvider = {
    id: "fake-stt",
    async transcribe() {
      return {
        text: "test transcript",
      };
    },
  };

  const result = await transcribeAudio(
    {
      file: new File([new Uint8Array([1, 2, 3])], "voice.mp3", {
        type: "audio/mpeg",
      }),
    },
    {
      provider,
      enabled: true,
    },
  );

  expect(result.text).toBe("test transcript");
});

test("rejects unsupported audio file upload", async () => {
  const provider: SttProvider = {
    id: "fake-stt",
    async transcribe() {
      return {
        text: "never-called",
      };
    },
  };

  await expect(
    transcribeAudio(
      {
        file: new File([new Uint8Array([1])], "malware.exe", {
          type: "application/octet-stream",
        }),
      },
      {
        provider,
        enabled: true,
      },
    ),
  ).rejects.toThrow("VALIDATION_ERROR");
});

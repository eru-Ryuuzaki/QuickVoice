import { generateSpeech } from "@/server/core/generate-speech";
import type { TtsProvider } from "@/server/providers/types";

function createFakeProvider(): TtsProvider {
  return {
    id: "minimax",
    label: "MiniMax",
    async synthesize(request) {
      return new TextEncoder().encode(request.text).buffer;
    },
  };
}

test("returns audio data for valid TTS input", async () => {
  const result = await generateSpeech(
    {
      text: "hello quickvoice",
      voice: "zh-CN-XiaoxiaoNeural",
      rate: "1.0",
      pitch: "0",
      style: "general",
    },
    {
      provider: createFakeProvider(),
    },
  );

  expect(result.contentType).toBe("audio/mpeg");
  expect(result.audio.byteLength).toBeGreaterThan(0);
});

test("splits long text and synthesizes every chunk", async () => {
  const synthesize = vi.fn(async (request: { text: string }) =>
    new TextEncoder().encode(request.text).buffer,
  );

  const provider: TtsProvider = {
    id: "minimax",
    label: "MiniMax",
    synthesize,
  };

  const originalText = "A".repeat(3_100);
  const result = await generateSpeech(
    {
      text: originalText,
      voice: "zh-CN-XiaoxiaoNeural",
      rate: "1.0",
      pitch: "0",
      style: "general",
    },
    {
      provider,
      maxChunkLength: 1_500,
    },
  );

  const decoded = new TextDecoder().decode(result.audio);
  expect(synthesize).toHaveBeenCalledTimes(3);
  expect(decoded).toBe(originalText);
});

test("passes the requested model to the TTS provider", async () => {
  const synthesize = vi.fn(async () =>
    new TextEncoder().encode("audio").buffer,
  );

  const provider: TtsProvider = {
    id: "minimax",
    label: "MiniMax",
    synthesize,
  };

  await generateSpeech(
    {
      text: "hello",
      voice: "zh-CN-XiaoxiaoNeural",
      model: "speech-custom",
      rate: "1.0",
      pitch: "0",
      style: "general",
    },
    {
      provider,
    },
  );

  expect(synthesize).toHaveBeenCalledWith(
    expect.objectContaining({
      model: "speech-custom",
    }),
  );
});

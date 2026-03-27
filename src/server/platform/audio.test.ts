import { writeFile } from "node:fs/promises";

import {
  extractPcmDataFromWav,
  normalizeAudioForVosk,
  VOSK_SAMPLE_RATE,
} from "@/server/platform/audio";

function createWavBuffer(pcmData: Uint8Array) {
  const buffer = new ArrayBuffer(44 + pcmData.byteLength);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  bytes.set(new TextEncoder().encode("RIFF"), 0);
  view.setUint32(4, 36 + pcmData.byteLength, true);
  bytes.set(new TextEncoder().encode("WAVE"), 8);
  bytes.set(new TextEncoder().encode("fmt "), 12);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, VOSK_SAMPLE_RATE, true);
  view.setUint32(28, VOSK_SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  bytes.set(new TextEncoder().encode("data"), 36);
  view.setUint32(40, pcmData.byteLength, true);
  bytes.set(pcmData, 44);

  return bytes;
}

test("extracts PCM data from a normalized wav file", () => {
  const pcmData = new Uint8Array([1, 0, 2, 0]);
  const result = extractPcmDataFromWav(createWavBuffer(pcmData));

  expect(result.sampleRate).toBe(VOSK_SAMPLE_RATE);
  expect(result.channels).toBe(1);
  expect(result.bitsPerSample).toBe(16);
  expect(Array.from(result.pcmData)).toEqual(Array.from(pcmData));
});

test("normalizes uploaded audio through ffmpeg and returns PCM data", async () => {
  const pcmData = new Uint8Array([1, 0, 2, 0]);
  const runner = vi.fn(async (args: string[]) => {
    const outputPath = args[args.length - 1];
    await writeFile(outputPath, createWavBuffer(pcmData));
  });

  const result = await normalizeAudioForVosk(
    new File([new Uint8Array([9, 8, 7])], "voice.mp3", {
      type: "audio/mpeg",
    }),
    { runner },
  );

  expect(runner).toHaveBeenCalledWith(
    expect.arrayContaining(["-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1"]),
  );
  expect(Array.from(result.pcmData)).toEqual(Array.from(pcmData));
});

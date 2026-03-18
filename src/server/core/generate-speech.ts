import { AppError } from "@/server/platform/errors";
import type { TtsProvider } from "@/server/providers/types";
import { normalizeTtsParams } from "@/server/tts/normalize";
import { splitTextForTts } from "@/server/tts/text-split";

export type GenerateSpeechInput = {
  text: string;
  voice: string;
  rate?: string;
  pitch?: string;
  style?: string;
  outputFormat?: string;
};

type GenerateSpeechDeps = {
  provider: TtsProvider;
  maxChunkLength?: number;
};

export type GenerateSpeechResult = {
  audio: ArrayBuffer;
  contentType: string;
  chunks: number;
};

function concatUint8Arrays(parts: Uint8Array[]) {
  const totalLength = parts.reduce((accumulator, part) => {
    return accumulator + part.byteLength;
  }, 0);

  const merged = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    merged.set(part, offset);
    offset += part.byteLength;
  }
  return merged;
}

export async function generateSpeech(
  input: GenerateSpeechInput,
  deps: GenerateSpeechDeps,
): Promise<GenerateSpeechResult> {
  const text = input.text.trim();
  if (!text) {
    throw new AppError("VALIDATION_ERROR", "VALIDATION_ERROR: text is required");
  }

  if (!input.voice.trim()) {
    throw new AppError("VALIDATION_ERROR", "VALIDATION_ERROR: voice is required");
  }

  const normalized = normalizeTtsParams({
    rate: input.rate,
    pitch: input.pitch,
    style: input.style,
  });

  const chunks = splitTextForTts(text, deps.maxChunkLength ?? 1_500).filter(
    (chunk) => chunk.trim().length > 0,
  );

  const audioParts: Uint8Array[] = [];
  for (const chunk of chunks) {
    const chunkAudio = await deps.provider.synthesize({
      text: chunk,
      voice: input.voice,
      rate: normalized.rate,
      pitch: normalized.pitch,
      style: normalized.style,
      outputFormat: input.outputFormat,
    });
    audioParts.push(new Uint8Array(chunkAudio));
  }

  const mergedAudio = concatUint8Arrays(audioParts);

  return {
    audio: mergedAudio.buffer.slice(
      mergedAudio.byteOffset,
      mergedAudio.byteOffset + mergedAudio.byteLength,
    ),
    contentType: "audio/mpeg",
    chunks: chunks.length,
  };
}

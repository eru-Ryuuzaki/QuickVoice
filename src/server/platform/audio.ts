import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";

import { AppError } from "@/server/platform/errors";
import { assertAudioUpload } from "@/server/platform/files";

export const VOSK_SAMPLE_RATE = 16_000;

export type NormalizedVoskAudio = {
  pcmData: Uint8Array;
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
};

export type FfmpegRunner = (args: string[]) => Promise<void>;

type NormalizeAudioOptions = {
  runner?: FfmpegRunner;
};

function readChunkId(view: DataView, offset: number) {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );
}

async function readUploadBuffer(file: File) {
  if (typeof file.arrayBuffer === "function") {
    return Buffer.from(await file.arrayBuffer());
  }

  return Buffer.from(await new Response(file).arrayBuffer());
}

export function extractPcmDataFromWav(buffer: Uint8Array): NormalizedVoskAudio {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  if (
    buffer.byteLength < 44 ||
    readChunkId(view, 0) !== "RIFF" ||
    readChunkId(view, 8) !== "WAVE"
  ) {
    throw new AppError(
      "PROCESSING_FAILED",
      "PROCESSING_FAILED: normalized audio is not a valid wav file",
      { status: 502 },
    );
  }

  let audioFormat = 0;
  let channels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let dataOffset = -1;
  let dataSize = 0;
  let cursor = 12;

  while (cursor + 8 <= view.byteLength) {
    const chunkId = readChunkId(view, cursor);
    const chunkSize = view.getUint32(cursor + 4, true);
    const chunkDataOffset = cursor + 8;

    if (chunkId === "fmt ") {
      audioFormat = view.getUint16(chunkDataOffset, true);
      channels = view.getUint16(chunkDataOffset + 2, true);
      sampleRate = view.getUint32(chunkDataOffset + 4, true);
      bitsPerSample = view.getUint16(chunkDataOffset + 14, true);
    }

    if (chunkId === "data") {
      dataOffset = chunkDataOffset;
      dataSize = chunkSize;
      break;
    }

    cursor = chunkDataOffset + chunkSize + (chunkSize % 2);
  }

  if (
    audioFormat !== 1 ||
    channels !== 1 ||
    sampleRate !== VOSK_SAMPLE_RATE ||
    bitsPerSample !== 16
  ) {
    throw new AppError(
      "PROCESSING_FAILED",
      "PROCESSING_FAILED: normalized audio must be 16kHz 16-bit mono PCM wav",
      { status: 502 },
    );
  }

  if (dataOffset < 0 || dataOffset + dataSize > buffer.byteLength) {
    throw new AppError(
      "PROCESSING_FAILED",
      "PROCESSING_FAILED: normalized audio payload is missing pcm data",
      { status: 502 },
    );
  }

  return {
    pcmData: buffer.slice(dataOffset, dataOffset + dataSize),
    sampleRate,
    channels,
    bitsPerSample,
  };
}

async function runFfmpeg(args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("ffmpeg", args, {
      stdio: ["ignore", "ignore", "pipe"],
    });

    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(
        new AppError(
          "PROCESSING_FAILED",
          "PROCESSING_FAILED: ffmpeg is not available for audio normalization",
          { status: 502, cause: error },
        ),
      );
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new AppError(
          "PROCESSING_FAILED",
          "PROCESSING_FAILED: failed to normalize audio for Vosk",
          {
            status: 502,
            details: stderr.trim().slice(0, 400),
          },
        ),
      );
    });
  });
}

export async function normalizeAudioForVosk(
  file: File,
  options: NormalizeAudioOptions = {},
): Promise<NormalizedVoskAudio> {
  const normalizedUpload = assertAudioUpload(file);
  const runner = options.runner ?? runFfmpeg;
  const tempDir = await mkdtemp(join(tmpdir(), "quickvoice-vosk-"));
  const extension = extname(normalizedUpload.name) || ".bin";
  const inputPath = join(tempDir, `input${extension}`);
  const outputPath = join(tempDir, "normalized.wav");

  try {
    const buffer = await readUploadBuffer(file);
    await writeFile(inputPath, buffer);

    await runner([
      "-y",
      "-i",
      inputPath,
      "-vn",
      "-acodec",
      "pcm_s16le",
      "-ar",
      String(VOSK_SAMPLE_RATE),
      "-ac",
      "1",
      outputPath,
    ]);

    const wavBuffer = await readFile(outputPath);
    return extractPcmDataFromWav(wavBuffer);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

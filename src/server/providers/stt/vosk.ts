import { loadConfig } from "@/server/platform/env";
import { AppError } from "@/server/platform/errors";
import {
  normalizeAudioForVosk,
  type NormalizedVoskAudio,
} from "@/server/platform/audio";
import type { SttProvider, SttTranscribeInput } from "@/server/providers/types";

type VoskSocketFactory = (url: string) => WebSocket;

type VoskSttOptions = {
  wsUrl?: string;
  chunkSize?: number;
  timeoutMs?: number;
  maxRetries?: number;
  socketFactory?: VoskSocketFactory;
  normalizeAudio?: (file: File) => Promise<NormalizedVoskAudio>;
};

type VoskSocketPayload = {
  text?: string;
  result?: Array<{ word?: string }>;
};

// The official vosk-server websocket handler compares control messages by exact string.
const VOSK_EOF_MESSAGE = '{"eof" : 1}';

function createDefaultSocketFactory(): VoskSocketFactory {
  return (url) => {
    if (typeof WebSocket === "undefined") {
      throw new AppError(
        "PROVIDER_UNAVAILABLE",
        "PROVIDER_UNAVAILABLE: WebSocket support is unavailable in this runtime",
        { status: 503 },
      );
    }

    return new WebSocket(url);
  };
}

async function readSocketMessage(data: unknown) {
  if (typeof data === "string") {
    return data;
  }

  if (data instanceof Blob) {
    return await data.text();
  }

  if (data instanceof ArrayBuffer) {
    return new TextDecoder().decode(data);
  }

  if (ArrayBuffer.isView(data)) {
    return new TextDecoder().decode(data);
  }

  return String(data ?? "");
}

async function transcribeWithSocket(options: {
  wsUrl: string;
  chunkSize: number;
  timeoutMs: number;
  socketFactory: VoskSocketFactory;
  audio: NormalizedVoskAudio;
}) {
  const socket = options.socketFactory(options.wsUrl);

  return await new Promise<string>((resolve, reject) => {
    let settled = false;

    function cleanup() {
      clearTimeout(timeout);

      try {
        socket.close();
      } catch {}
    }

    function resolveOnce(value: string) {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      resolve(value);
    }

    function rejectOnce(error: AppError) {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      reject(error);
    }

    const timeout = setTimeout(() => {
      rejectOnce(
        new AppError(
          "PROVIDER_UNAVAILABLE",
          "PROVIDER_UNAVAILABLE: Vosk transcription timed out",
          { status: 503 },
        ),
      );
    }, options.timeoutMs);

    socket.addEventListener("open", () => {
      try {
        socket.send(
          JSON.stringify({
            config: {
              sample_rate: options.audio.sampleRate,
            },
          }),
        );

        for (
          let offset = 0;
          offset < options.audio.pcmData.byteLength;
          offset += options.chunkSize
        ) {
          socket.send(
            options.audio.pcmData.slice(offset, offset + options.chunkSize),
          );
        }

        socket.send(VOSK_EOF_MESSAGE);
      } catch (error) {
        rejectOnce(
          new AppError(
            "PROCESSING_FAILED",
            "PROCESSING_FAILED: failed to stream audio to Vosk",
            { status: 502, cause: error },
          ),
        );
      }
    });

    socket.addEventListener("message", async (event) => {
      try {
        const rawMessage = await readSocketMessage(event.data);
        const payload = JSON.parse(rawMessage) as VoskSocketPayload;

        if (Object.prototype.hasOwnProperty.call(payload, "text")) {
          resolveOnce((payload.text ?? "").trim());
          return;
        }

        if (Array.isArray(payload.result)) {
          const resultText = payload.result
            .map((item) => item.word?.trim() ?? "")
            .filter(Boolean)
            .join(" ");

          if (resultText) {
            resolveOnce(resultText);
          }
        }
      } catch (error) {
        rejectOnce(
          new AppError(
            "PROCESSING_FAILED",
            "PROCESSING_FAILED: invalid response received from Vosk",
            { status: 502, cause: error },
          ),
        );
      }
    });

    socket.addEventListener("error", () => {
      rejectOnce(
        new AppError(
          "PROVIDER_UNAVAILABLE",
          "PROVIDER_UNAVAILABLE: failed to connect to Vosk",
          { status: 503 },
        ),
      );
    });

    socket.addEventListener("close", (event) => {
      if (!settled) {
        const closeCode =
          typeof event === "object" &&
          event !== null &&
          "code" in event &&
          typeof (event as { code?: unknown }).code === "number"
            ? (event as { code: number }).code
            : null;
        const closeReason =
          typeof event === "object" &&
          event !== null &&
          "reason" in event &&
          typeof (event as { reason?: unknown }).reason === "string"
            ? (event as { reason: string }).reason.trim()
            : "";

        rejectOnce(
          new AppError(
            "PROVIDER_UNAVAILABLE",
            `PROVIDER_UNAVAILABLE: Vosk connection closed before transcription completed${
              closeCode != null ? ` (code=${closeCode}` : ""
            }${closeReason ? `${closeCode != null ? ", " : " ("}reason=${closeReason}` : ""}${
              closeCode != null || closeReason ? ")" : ""
            }`,
            { status: 503 },
          ),
        );
      }
    });
  });
}

function isRetryableUnavailableError(error: unknown) {
  if (!(error instanceof AppError) || error.code !== "PROVIDER_UNAVAILABLE") {
    return false;
  }

  return (
    error.message.includes("failed to connect to Vosk") ||
    error.message.includes("connection closed before transcription completed") ||
    error.message.includes("Vosk transcription timed out")
  );
}

async function wait(ms: number) {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function createVoskSttProvider(options: VoskSttOptions = {}): SttProvider {
  const config = loadConfig();
  const wsUrl = options.wsUrl ?? config.voskWsUrl;
  const socketFactory = options.socketFactory ?? createDefaultSocketFactory();
  const normalizeAudio = options.normalizeAudio ?? normalizeAudioForVosk;
  const chunkSize = Math.max(1, options.chunkSize ?? 4_096);
  const timeoutMs = Math.max(5_000, options.timeoutMs ?? 20_000);
  const maxRetries = Math.max(0, options.maxRetries ?? 1);

  return {
    id: "vosk",
    label: "Vosk CN",
    async transcribe(input: SttTranscribeInput) {
      const audio = await normalizeAudio(input.file);
      let lastError: unknown = null;
      const totalAttempts = maxRetries + 1;

      for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
        try {
          const text = await transcribeWithSocket({
            wsUrl,
            chunkSize,
            timeoutMs,
            socketFactory,
            audio,
          });

          if (!text) {
            throw new AppError(
              "PROCESSING_FAILED",
              "PROCESSING_FAILED: empty transcription result from Vosk",
              { status: 502 },
            );
          }

          return {
            text,
            raw: {
              provider: "vosk",
              sampleRate: audio.sampleRate,
            },
          };
        } catch (error) {
          lastError = error;
          if (!isRetryableUnavailableError(error) || attempt >= totalAttempts) {
            throw error;
          }

          await wait(150);
        }
      }

      throw lastError;
    },
  };
}


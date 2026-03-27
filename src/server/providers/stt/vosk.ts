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
  socketFactory?: VoskSocketFactory;
  normalizeAudio?: (file: File) => Promise<NormalizedVoskAudio>;
};

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

        socket.send(JSON.stringify({ eof: 1 }));
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
        const payload = JSON.parse(rawMessage) as { text?: string };

        if (Object.prototype.hasOwnProperty.call(payload, "text")) {
          resolveOnce((payload.text ?? "").trim());
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

    socket.addEventListener("close", () => {
      if (!settled) {
        rejectOnce(
          new AppError(
            "PROVIDER_UNAVAILABLE",
            "PROVIDER_UNAVAILABLE: Vosk connection closed before transcription completed",
            { status: 503 },
          ),
        );
      }
    });
  });
}

export function createVoskSttProvider(options: VoskSttOptions = {}): SttProvider {
  const config = loadConfig();
  const wsUrl = options.wsUrl ?? config.voskWsUrl;
  const socketFactory = options.socketFactory ?? createDefaultSocketFactory();
  const normalizeAudio = options.normalizeAudio ?? normalizeAudioForVosk;
  const chunkSize = Math.max(1, options.chunkSize ?? 4_096);
  const timeoutMs = Math.max(5_000, options.timeoutMs ?? 20_000);

  return {
    id: "vosk",
    label: "Vosk CN",
    async transcribe(input: SttTranscribeInput) {
      const audio = await normalizeAudio(input.file);
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
    },
  };
}


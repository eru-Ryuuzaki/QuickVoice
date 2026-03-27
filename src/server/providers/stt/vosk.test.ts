import {
  createVoskSttProvider,
} from "@/server/providers/stt/vosk";

class FakeSocket {
  public readonly sent: Array<string | Uint8Array> = [];
  private readonly listeners = new Map<string, Array<(event?: unknown) => void>>();
  private readonly onSend?: (socket: FakeSocket, data: string | Uint8Array) => void;

  constructor(onSend?: (socket: FakeSocket, data: string | Uint8Array) => void) {
    this.onSend = onSend;
  }

  addEventListener(type: string, listener: (event?: unknown) => void) {
    const current = this.listeners.get(type) ?? [];
    current.push(listener);
    this.listeners.set(type, current);
  }

  send(data: string | Uint8Array) {
    this.sent.push(data);
    this.onSend?.(this, data);
  }

  close() {
    this.emit("close", {});
  }

  emit(type: string, event?: unknown) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

test("streams normalized audio to Vosk and returns the final transcript", async () => {
  const normalizeAudio = vi.fn(async () => ({
    pcmData: new Uint8Array([1, 2, 3, 4]),
    sampleRate: 16_000,
    channels: 1,
    bitsPerSample: 16,
  }));

  let socket: FakeSocket | null = null;
  const provider = createVoskSttProvider({
    wsUrl: "ws://vosk-cn:2700",
    chunkSize: 2,
    timeoutMs: 5_000,
    normalizeAudio,
    socketFactory: () => {
      socket = new FakeSocket((currentSocket, data) => {
        if (typeof data === "string" && data.includes('"eof":1')) {
          queueMicrotask(() => {
            currentSocket.emit("message", {
              data: JSON.stringify({ text: "hello from vosk" }),
            });
          });
        }
      });

      queueMicrotask(() => {
        socket?.emit("open", {});
      });

      return socket as unknown as WebSocket;
    },
  });

  const result = await provider.transcribe({
    file: new File([new Uint8Array([1, 2])], "voice.mp3", {
      type: "audio/mpeg",
    }),
  });

  expect(result.text).toBe("hello from vosk");
  expect(normalizeAudio).toHaveBeenCalled();
  expect(socket?.sent[0]).toBe(JSON.stringify({ config: { sample_rate: 16_000 } }));
  expect(socket?.sent[1]).toEqual(new Uint8Array([1, 2]));
  expect(socket?.sent[2]).toEqual(new Uint8Array([3, 4]));
  expect(socket?.sent[3]).toBe(JSON.stringify({ eof: 1 }));
});

test("rejects empty final transcripts from Vosk", async () => {
  const normalizeAudio = vi.fn(async () => ({
    pcmData: new Uint8Array([1, 2]),
    sampleRate: 16_000,
    channels: 1,
    bitsPerSample: 16,
  }));

  const provider = createVoskSttProvider({
    wsUrl: "ws://vosk-cn:2700",
    timeoutMs: 5_000,
    normalizeAudio,
    socketFactory: () => {
      const socket = new FakeSocket((currentSocket, data) => {
        if (typeof data === "string" && data.includes('"eof":1')) {
          queueMicrotask(() => {
            currentSocket.emit("message", {
              data: JSON.stringify({ text: "" }),
            });
          });
        }
      });

      queueMicrotask(() => {
        socket.emit("open", {});
      });

      return socket as unknown as WebSocket;
    },
  });

  await expect(
    provider.transcribe({
      file: new File([new Uint8Array([1, 2])], "voice.mp3", {
        type: "audio/mpeg",
      }),
    }),
  ).rejects.toThrow("PROCESSING_FAILED");
});

import { createVolcengineSttProvider } from "@/server/providers/stt/volcengine";
import type { AudioObjectStorage } from "@/server/storage/audio-object-storage";

function createAudioFile(bytes: Uint8Array) {
  const file = new File([bytes], "voice.mp3", {
    type: "audio/mpeg",
  });
  Object.defineProperty(file, "arrayBuffer", {
    value: async () =>
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  });
  return file;
}

function createStorage(url = "https://cos.example.test/voice.mp3") {
  return {
    uploadAudio: vi.fn(async () => ({
      key: "quickvoice/stt/voice.mp3",
      url,
    })),
  } satisfies AudioObjectStorage;
}

test("uploads audio to COS and submits the audio URL to Volcengine", async () => {
  const storage = createStorage();
  const fetchImpl = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ result: { text: "hello volcengine" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ) as unknown as typeof fetch;

  const provider = createVolcengineSttProvider({
    apiKey: "api-key",
    resourceId: "volc.seedasr.auc",
    submitEndpoint: "https://example.test/submit",
    queryEndpoint: "https://example.test/query",
    storage,
    fetchImpl,
    sleep: async () => undefined,
  });

  const result = await provider.transcribe({
    file: createAudioFile(new Uint8Array([1, 2, 3])),
    model: "",
  });

  expect(result.text).toBe("hello volcengine");
  expect(storage.uploadAudio).toHaveBeenCalledWith(expect.any(File));
  expect(fetchImpl).toHaveBeenNthCalledWith(
    1,
    "https://example.test/submit",
    expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        "X-Api-Key": "api-key",
        "X-Api-Request-Id": expect.any(String),
        "X-Api-Resource-Id": "volc.seedasr.auc",
        "X-Api-Sequence": "-1",
      }),
      body: expect.stringContaining('"audio"'),
    }),
  );
  const [, requestOptions] = fetchImpl.mock.calls[0] ?? [];
  const body = JSON.parse(String(requestOptions?.body));
  expect(body.audio.url).toBe("https://cos.example.test/voice.mp3");
  expect(body.audio.data).toBeUndefined();
  expect(fetchImpl).toHaveBeenNthCalledWith(
    2,
    "https://example.test/query",
    expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        "X-Api-Key": "api-key",
        "X-Api-Resource-Id": "volc.seedasr.auc",
        "X-Api-Sequence": "-1",
      }),
    }),
  );
});

test("uses request model as Volcengine resource id when supplied", async () => {
  const fetchImpl = vi
    .fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ result: { text: "hello volcengine" } }), {
        status: 200,
      }),
    ) as unknown as typeof fetch;

  const provider = createVolcengineSttProvider({
    apiKey: "api-key",
    resourceId: "volc.seedasr.auc",
    submitEndpoint: "https://example.test/submit",
    queryEndpoint: "https://example.test/query",
    storage: createStorage(),
    fetchImpl,
    sleep: async () => undefined,
  });

  await provider.transcribe({
    file: createAudioFile(new Uint8Array([1, 2, 3])),
    model: "custom-resource",
  });

  expect(fetchImpl).toHaveBeenNthCalledWith(
    1,
    "https://example.test/submit",
    expect.objectContaining({
      headers: expect.objectContaining({
        "X-Api-Resource-Id": "custom-resource",
      }),
    }),
  );
});

test("maps Volcengine submit failures", async () => {
  const fetchImpl = vi.fn(
    async () => new Response("bad", { status: 503 }),
  ) as typeof fetch;
  const provider = createVolcengineSttProvider({
    apiKey: "api-key",
    resourceId: "volc.seedasr.auc",
    submitEndpoint: "https://example.test/submit",
    queryEndpoint: "https://example.test/query",
    storage: createStorage(),
    fetchImpl,
    sleep: async () => undefined,
  });

  await expect(
    provider.transcribe({
      file: createAudioFile(new Uint8Array([1])),
      model: "",
    }),
  ).rejects.toMatchObject({
    code: "PROVIDER_UNAVAILABLE",
  });
});

test("maps empty final transcript to processing failure", async () => {
  const fetchImpl = vi
    .fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ result: { text: "" } }), { status: 200 }),
    ) as unknown as typeof fetch;
  const provider = createVolcengineSttProvider({
    apiKey: "api-key",
    resourceId: "volc.seedasr.auc",
    submitEndpoint: "https://example.test/submit",
    queryEndpoint: "https://example.test/query",
    storage: createStorage(),
    fetchImpl,
    sleep: async () => undefined,
  });

  await expect(
    provider.transcribe({
      file: createAudioFile(new Uint8Array([1])),
      model: "",
    }),
  ).rejects.toMatchObject({
    code: "PROCESSING_FAILED",
  });
});

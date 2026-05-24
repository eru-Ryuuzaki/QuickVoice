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
  const [, queryOptions] = fetchImpl.mock.calls[1] ?? [];
  expect(JSON.parse(String(queryOptions?.body))).toEqual({});
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

test("maps Volcengine submit task status failures", async () => {
  const fetchImpl = vi.fn(
    async () =>
      new Response(JSON.stringify({}), {
        status: 200,
        headers: {
          "X-Api-Status-Code": "45000001",
          "X-Api-Message": "bad request",
        },
      }),
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
  expect(fetchImpl).toHaveBeenCalledTimes(1);
});

test("continues polling Volcengine pending and queued task statuses", async () => {
  const fetchImpl = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { "X-Api-Status-Code": "20000000" },
      }),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { "X-Api-Status-Code": "20000001" },
      }),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { "X-Api-Status-Code": "20000002" },
      }),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ result: { text: "done" } }), {
        status: 200,
        headers: { "X-Api-Status-Code": "20000000" },
      }),
    ) as unknown as typeof fetch;
  const sleep = vi.fn(async () => undefined);
  const provider = createVolcengineSttProvider({
    apiKey: "api-key",
    resourceId: "volc.seedasr.auc",
    submitEndpoint: "https://example.test/submit",
    queryEndpoint: "https://example.test/query",
    storage: createStorage(),
    fetchImpl,
    sleep,
    maxPollAttempts: 3,
  });

  const result = await provider.transcribe({
    file: createAudioFile(new Uint8Array([1])),
    model: "",
  });

  expect(result.text).toBe("done");
  expect(fetchImpl).toHaveBeenCalledTimes(4);
  expect(sleep).toHaveBeenCalledTimes(2);
});

test("maps Volcengine query task status failures", async () => {
  const fetchImpl = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { "X-Api-Status-Code": "20000000" },
      }),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: {
          "X-Api-Status-Code": "45000151",
          "X-Api-Message": "format error",
        },
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
    maxPollAttempts: 1,
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

test("continues polling when an intermediate query result is empty", async () => {
  const fetchImpl = vi
    .fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ result: { text: "" } }), { status: 200 }),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ result: { text: "final transcript" } }), {
        status: 200,
      }),
    ) as unknown as typeof fetch;
  const sleep = vi.fn(async () => undefined);
  const provider = createVolcengineSttProvider({
    apiKey: "api-key",
    resourceId: "volc.seedasr.auc",
    submitEndpoint: "https://example.test/submit",
    queryEndpoint: "https://example.test/query",
    storage: createStorage(),
    fetchImpl,
    sleep,
    maxPollAttempts: 2,
  });

  const result = await provider.transcribe({
    file: createAudioFile(new Uint8Array([1])),
    model: "",
  });

  expect(result.text).toBe("final transcript");
  expect(fetchImpl).toHaveBeenCalledTimes(3);
  expect(sleep).toHaveBeenCalledTimes(1);
});

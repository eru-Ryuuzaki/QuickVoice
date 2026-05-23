import { createVolcengineSttProvider } from "@/server/providers/stt/volcengine";

function createAudioFile(bytes: Uint8Array) {
  const file = new File([bytes], "voice.mp3", {
    type: "audio/mpeg",
  });
  Object.defineProperty(file, "arrayBuffer", {
    value: async () => bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ),
  });
  return file;
}

test("posts audio to Volcengine and returns transcript text", async () => {
  const fetchImpl = vi.fn(async () =>
    new Response(JSON.stringify({ result: { text: "hello volcengine" } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  ) as typeof fetch;

  const provider = createVolcengineSttProvider({
    accessKeyId: "ak",
    secretAccessKey: "sk",
    appId: "app",
    resourceId: "resource",
    endpoint: "https://example.test/recognize",
    fetchImpl,
  });

  const result = await provider.transcribe({
    file: createAudioFile(new Uint8Array([1, 2, 3])),
    model: "",
  });

  expect(result.text).toBe("hello volcengine");
  expect(fetchImpl).toHaveBeenCalledWith(
    "https://example.test/recognize",
    expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        "X-Api-Access-Key": "ak",
        "X-Api-App-Key": "app",
        "X-Api-Request-Id": expect.any(String),
        "X-Api-Resource-Id": "resource",
        "X-Api-Sequence": "-1",
      }),
      body: expect.stringContaining('"audio"'),
    }),
  );
  const [, requestOptions] = fetchImpl.mock.calls[0] ?? [];
  const body = JSON.parse(String(requestOptions?.body));
  expect(body.user.uid).toBe("app");
  expect(body.audio.data).toBe(Buffer.from([1, 2, 3]).toString("base64"));
});

test("uses request model as Volcengine resource id when supplied", async () => {
  const fetchImpl = vi.fn(async () =>
    new Response(JSON.stringify({ result: { text: "hello volcengine" } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  ) as typeof fetch;

  const provider = createVolcengineSttProvider({
    accessKeyId: "ak",
    secretAccessKey: "sk",
    appId: "app",
    resourceId: "resource",
    endpoint: "https://example.test/recognize",
    fetchImpl,
  });

  await provider.transcribe({
    file: createAudioFile(new Uint8Array([1, 2, 3])),
    model: "custom-resource",
  });

  expect(fetchImpl).toHaveBeenCalledWith(
    "https://example.test/recognize",
    expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        "X-Api-Resource-Id": "custom-resource",
      }),
    }),
  );
});

test("maps Volcengine failures", async () => {
  const fetchImpl = vi.fn(async () => new Response("bad", { status: 503 })) as typeof fetch;
  const provider = createVolcengineSttProvider({
    accessKeyId: "ak",
    secretAccessKey: "sk",
    appId: "app",
    resourceId: "resource",
    endpoint: "https://example.test/recognize",
    fetchImpl,
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

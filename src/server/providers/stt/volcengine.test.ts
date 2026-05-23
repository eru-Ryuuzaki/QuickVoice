import { createVolcengineSttProvider } from "@/server/providers/stt/volcengine";

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
    file: new File([new Uint8Array([1, 2, 3])], "voice.mp3", {
      type: "audio/mpeg",
    }),
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
        "X-Api-Resource-Id": "resource",
      }),
    }),
  );
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
    file: new File([new Uint8Array([1, 2, 3])], "voice.mp3", {
      type: "audio/mpeg",
    }),
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
      file: new File([new Uint8Array([1])], "voice.mp3", {
        type: "audio/mpeg",
      }),
      model: "",
    }),
  ).rejects.toMatchObject({
    code: "PROVIDER_UNAVAILABLE",
  });
});

import { createMiniMaxTtsProvider } from "@/server/providers/tts/minimax";

test("sends text to MiniMax and returns audio bytes", async () => {
  const audio = Buffer.from("audio").toString("base64");
  const fetchImpl = vi.fn(async () =>
    new Response(JSON.stringify({ data: { audio } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  ) as typeof fetch;

  const provider = createMiniMaxTtsProvider({
    apiKey: "key",
    groupId: "group",
    model: "speech-2.8-turbo",
    defaultVoiceId: "voice",
    endpoint: "https://example.test/v1/t2a_v2",
    fetchImpl,
  });

  const result = await provider.synthesize({
    text: "hello",
    voice: "voice",
    rate: "1.2",
    pitch: "3",
    style: "general",
  });

  expect(new TextDecoder().decode(result)).toBe("audio");
  expect(fetchImpl).toHaveBeenCalledWith(
    "https://example.test/v1/t2a_v2?GroupId=group",
    expect.objectContaining({
      body: expect.stringContaining('"model":"speech-2.8-turbo"'),
    }),
  );
});

test("uses request model when MiniMax input supplies one", async () => {
  const audio = Buffer.from("audio").toString("base64");
  const fetchImpl = vi.fn(async () =>
    new Response(JSON.stringify({ data: { audio } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  ) as typeof fetch;

  const provider = createMiniMaxTtsProvider({
    apiKey: "key",
    groupId: "group",
    model: "speech-2.8-turbo",
    endpoint: "https://example.test/v1/t2a_v2",
    fetchImpl,
  });

  await provider.synthesize({
    text: "hello",
    voice: "voice",
    model: "speech-custom",
    rate: "1.2",
    pitch: "3",
    style: "general",
  });

  expect(fetchImpl).toHaveBeenCalledWith(
    "https://example.test/v1/t2a_v2?GroupId=group",
    expect.objectContaining({
      body: expect.stringContaining('"model":"speech-custom"'),
    }),
  );
});

test("maps MiniMax failures", async () => {
  const fetchImpl = vi.fn(async () => new Response("bad", { status: 500 })) as typeof fetch;
  const provider = createMiniMaxTtsProvider({
    apiKey: "key",
    groupId: "group",
    fetchImpl,
  });

  await expect(
    provider.synthesize({
      text: "hello",
      voice: "voice",
      rate: "1.0",
      pitch: "0",
      style: "general",
    }),
  ).rejects.toMatchObject({
    code: "PROVIDER_UNAVAILABLE",
  });
});

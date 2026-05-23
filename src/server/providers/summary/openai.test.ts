import { createOpenAiSummaryProvider } from "@/server/providers/summary/openai";

test("parses OpenAI output_text JSON into a summary", async () => {
  const fetchImpl = vi.fn(async () =>
    new Response(
      JSON.stringify({
        output_text: JSON.stringify({
          title: "Meeting",
          summary: "Discussed launch",
          keyPoints: ["Launch next week"],
          actionItems: ["Send notes"],
          keywords: ["launch"],
          cleanTranscript: "clean text",
        }),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    ),
  ) as typeof fetch;

  const provider = createOpenAiSummaryProvider({
    apiKey: "key",
    endpoint: "https://example.test/responses",
    fetchImpl,
  });

  const result = await provider.summarize({
    transcript: "raw text",
    model: "gpt-5.5",
  });

  expect(result).toEqual({
    title: "Meeting",
    summary: "Discussed launch",
    keyPoints: ["Launch next week"],
    actionItems: ["Send notes"],
    keywords: ["launch"],
    cleanTranscript: "clean text",
    model: "gpt-5.5",
  });
  expect(fetchImpl).toHaveBeenCalledWith(
    "https://example.test/responses",
    expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        Authorization: "Bearer key",
      }),
    }),
  );
});

test("uses configured OpenAI summary endpoint from env", async () => {
  const previousEndpoint = process.env.OPENAI_SUMMARY_ENDPOINT;
  const previousApiKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_SUMMARY_ENDPOINT = "https://env.example.test/responses";
  process.env.OPENAI_API_KEY = "env-key";

  const fetchImpl = vi.fn(async () =>
    new Response(
      JSON.stringify({
        output_text: JSON.stringify({
          title: "Meeting",
          summary: "Discussed launch",
          keyPoints: [],
          actionItems: [],
          keywords: [],
          cleanTranscript: "clean text",
        }),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    ),
  ) as typeof fetch;

  try {
    const provider = createOpenAiSummaryProvider({
      fetchImpl,
    });

    await provider.summarize({
      transcript: "raw text",
      model: "gpt-5.5",
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://env.example.test/responses",
      expect.any(Object),
    );
  } finally {
    if (previousEndpoint == null) {
      delete process.env.OPENAI_SUMMARY_ENDPOINT;
    } else {
      process.env.OPENAI_SUMMARY_ENDPOINT = previousEndpoint;
    }

    if (previousApiKey == null) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = previousApiKey;
    }
  }
});

test("parses Responses API output array content", async () => {
  const fetchImpl = vi.fn(async () =>
    new Response(
      JSON.stringify({
        output: [
          { type: "reasoning" },
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  title: "Responses",
                  summary: "Parsed nested output",
                  keyPoints: ["Nested content"],
                  actionItems: [],
                  keywords: ["responses"],
                  cleanTranscript: "clean",
                }),
              },
            ],
          },
        ],
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    ),
  ) as typeof fetch;

  const provider = createOpenAiSummaryProvider({
    apiKey: "key",
    endpoint: "https://example.test/responses",
    fetchImpl,
  });

  const result = await provider.summarize({
    transcript: "raw text",
    model: "gpt-5.5",
  });

  expect(result.title).toBe("Responses");
  expect(result.keyPoints).toEqual(["Nested content"]);
});

test("maps OpenAI failures", async () => {
  const fetchImpl = vi.fn(async () => new Response("bad", { status: 503 })) as typeof fetch;
  const provider = createOpenAiSummaryProvider({
    apiKey: "key",
    endpoint: "https://example.test/responses",
    fetchImpl,
  });

  await expect(
    provider.summarize({
      transcript: "raw text",
      model: "gpt-5.5",
    }),
  ).rejects.toMatchObject({
    code: "PROVIDER_UNAVAILABLE",
  });
});

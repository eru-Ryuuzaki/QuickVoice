import { createSummaryRouteHandler } from "@/app/api/summary/route";
import type { RateLimiter } from "@/server/platform/rate-limit";
import type { SummaryProvider } from "@/server/providers/types";

function createAllowedLimiter(): RateLimiter {
  return {
    consume() {
      return {
        allowed: true,
        remaining: 4,
        resetAt: Date.now() + 60_000,
      };
    },
    reset() {},
  };
}

function createRequest(body: unknown) {
  return new Request("http://localhost/api/summary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const provider: SummaryProvider = {
  id: "openai",
  async summarize(input) {
    return {
      title: "Title",
      summary: "Summary",
      keyPoints: ["Point"],
      actionItems: [],
      keywords: [],
      cleanTranscript: input.transcript,
      model: input.model,
    };
  },
};

test("summarizes transcript with selected allowed model", async () => {
  const POST = createSummaryRouteHandler({
    provider,
    limiter: createAllowedLimiter(),
    getClientIp: () => "127.0.0.1",
    config: {
      openaiSummaryModel: "gpt-5.5",
      openaiSummaryModels: ["gpt-5.5", "gpt-5.4-mini"],
    },
  });

  const response = await POST(
    createRequest({
      transcript: " hello transcript ",
      model: "gpt-5.4-mini",
    }),
  );
  const payload = await response.json();

  expect(response.status).toBe(200);
  expect(payload.model).toBe("gpt-5.4-mini");
  expect(payload.cleanTranscript).toBe("hello transcript");
});

test("returns validation error for disallowed summary model", async () => {
  const POST = createSummaryRouteHandler({
    provider,
    limiter: createAllowedLimiter(),
    getClientIp: () => "127.0.0.1",
    config: {
      openaiSummaryModel: "gpt-5.5",
      openaiSummaryModels: ["gpt-5.5"],
    },
  });

  const response = await POST(
    createRequest({
      transcript: "hello transcript",
      model: "not-allowed",
    }),
  );
  const payload = await response.json();

  expect(response.status).toBe(400);
  expect(payload.error.code).toBe("VALIDATION_ERROR");
});

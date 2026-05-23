import { loadConfig } from "@/server/platform/env";
import { AppError } from "@/server/platform/errors";
import type { SummaryProvider, SummaryResult } from "@/server/providers/types";

const OPENAI_RESPONSES_ENDPOINT = "https://api.openai.com/v1/responses";

type OpenAiSummaryOptions = {
  apiKey?: string;
  endpoint?: string;
  fetchImpl?: typeof fetch;
};

type OpenAiPayload = {
  output_text?: string;
};

function parseStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : [];
}

function parseSummary(text: string, model: string): SummaryResult {
  const parsed = JSON.parse(text) as Partial<SummaryResult>;
  return {
    title: String(parsed.title ?? "").trim(),
    summary: String(parsed.summary ?? "").trim(),
    keyPoints: parseStringArray(parsed.keyPoints),
    actionItems: parseStringArray(parsed.actionItems),
    keywords: parseStringArray(parsed.keywords),
    cleanTranscript: String(parsed.cleanTranscript ?? "").trim(),
    model,
  };
}

export function createOpenAiSummaryProvider(
  options: OpenAiSummaryOptions = {},
): SummaryProvider {
  const config = loadConfig();
  const apiKey = options.apiKey ?? config.openaiApiKey;
  const endpoint = options.endpoint ?? OPENAI_RESPONSES_ENDPOINT;
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    id: "openai",
    async summarize(input) {
      if (!apiKey) {
        throw new AppError(
          "PROVIDER_UNAVAILABLE",
          "PROVIDER_UNAVAILABLE: OpenAI summary is not configured",
          { status: 503 },
        );
      }

      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: input.model,
          input: [
            {
              role: "system",
              content:
                "Return strict JSON with title, summary, keyPoints, actionItems, keywords, and cleanTranscript.",
            },
            { role: "user", content: input.transcript },
          ],
          text: { format: { type: "json_object" } },
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new AppError(
          response.status === 429 ? "RATE_LIMITED" : "PROVIDER_UNAVAILABLE",
          `PROVIDER_UNAVAILABLE: OpenAI summary returned ${response.status}`,
          { status: response.status === 429 ? 429 : 503, details: body },
        );
      }

      const payload = (await response.json()) as OpenAiPayload;
      if (!payload.output_text) {
        throw new AppError(
          "PROCESSING_FAILED",
          "PROCESSING_FAILED: OpenAI summary returned empty output",
          { status: 502 },
        );
      }

      return parseSummary(payload.output_text, input.model);
    },
  };
}

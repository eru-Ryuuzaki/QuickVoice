import { loadConfig } from "@/server/platform/env";
import { AppError } from "@/server/platform/errors";
import type { SummaryProvider, SummaryResult } from "@/server/providers/types";

type OpenAiSummaryOptions = {
  apiKey?: string;
  endpoint?: string;
  fetchImpl?: typeof fetch;
};

type OpenAiPayload = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
      type?: string;
    }>;
    type?: string;
  }>;
  choices?: Array<{
    message?: {
      content?: string | Array<{ text?: string; type?: string }>;
    };
  }>;
};

function parseStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : [];
}

function parseSummary(text: string, model: string): SummaryResult {
  let parsed: Partial<SummaryResult>;
  try {
    parsed = JSON.parse(text) as Partial<SummaryResult>;
  } catch {
    throw new AppError(
      "PROCESSING_FAILED",
      "PROCESSING_FAILED: OpenAI summary returned invalid JSON",
      { status: 502 },
    );
  }

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

function readOutputText(payload: OpenAiPayload) {
  if (typeof payload.output_text === "string") {
    return payload.output_text;
  }

  for (const output of payload.output ?? []) {
    for (const content of output.content ?? []) {
      if (typeof content.text === "string" && content.text.trim()) {
        return content.text;
      }
    }
  }

  for (const choice of payload.choices ?? []) {
    const content = choice.message?.content;
    if (typeof content === "string" && content.trim()) {
      return content;
    }

    if (Array.isArray(content)) {
      for (const part of content) {
        if (typeof part.text === "string" && part.text.trim()) {
          return part.text;
        }
      }
    }
  }

  return "";
}

function isChatCompletionsEndpoint(endpoint: string) {
  return /\/chat\/completions\/?$/.test(endpoint);
}

function isChatCompletionsModel(model: string) {
  return model.trim().toLowerCase().startsWith("deepseek-");
}

function createRequestEndpoint(endpoint: string, model: string) {
  if (isChatCompletionsEndpoint(endpoint) || !isChatCompletionsModel(model)) {
    return endpoint;
  }

  return endpoint.replace(/\/responses\/?$/, "/chat/completions");
}

function createSummaryRequestBody(input: { transcript: string; model: string }) {
  const messages = [
    {
      role: "system",
      content:
        "Return strict json only. Use this shape: {\"title\":\"\",\"summary\":\"\",\"keyPoints\":[],\"actionItems\":[],\"keywords\":[],\"cleanTranscript\":\"\"}.",
    },
    { role: "user", content: input.transcript },
  ];

  return { messages, response_format: { type: "json_object" } };
}

export function createOpenAiSummaryProvider(
  options: OpenAiSummaryOptions = {},
): SummaryProvider {
  const config = loadConfig();
  const apiKey = options.apiKey ?? config.openaiApiKey;
  const endpoint = options.endpoint ?? config.openaiSummaryEndpoint;
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

      const requestEndpoint = createRequestEndpoint(endpoint, input.model);
      const response = await fetchImpl(requestEndpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: input.model,
          ...(isChatCompletionsEndpoint(requestEndpoint)
            ? createSummaryRequestBody(input)
            : {
                input: createSummaryRequestBody(input).messages,
                text: { format: { type: "json_object" } },
              }),
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
      const outputText = readOutputText(payload);
      if (!outputText) {
        throw new AppError(
          "PROCESSING_FAILED",
          "PROCESSING_FAILED: OpenAI summary returned empty output",
          { status: 502 },
        );
      }

      return parseSummary(outputText, input.model);
    },
  };
}

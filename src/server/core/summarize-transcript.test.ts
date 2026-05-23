import { summarizeTranscript } from "@/server/core/summarize-transcript";
import type { SummaryProvider } from "@/server/providers/types";

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

test("summarizes transcript with a manually supplied model", async () => {
  const result = await summarizeTranscript(
    { transcript: " hello ", model: "gpt-custom" },
    {
      provider,
      defaultModel: "gpt-5.5",
    },
  );

  expect(result.model).toBe("gpt-custom");
  expect(result.cleanTranscript).toBe("hello");
});

test("uses default model when the summary model is blank", async () => {
  const result = await summarizeTranscript(
    { transcript: "hello", model: "   " },
    {
      provider,
      defaultModel: "gpt-5.5",
    },
  );

  expect(result.model).toBe("gpt-5.5");
});

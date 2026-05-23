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

test("summarizes transcript with an allowed model", async () => {
  const result = await summarizeTranscript(
    { transcript: " hello ", model: "gpt-5.4-mini" },
    {
      provider,
      allowedModels: ["gpt-5.5", "gpt-5.4-mini"],
      defaultModel: "gpt-5.5",
    },
  );

  expect(result.model).toBe("gpt-5.4-mini");
  expect(result.cleanTranscript).toBe("hello");
});

test("rejects model outside allowlist", async () => {
  await expect(
    summarizeTranscript(
      { transcript: "hello", model: "not-allowed" },
      {
        provider,
        allowedModels: ["gpt-5.5"],
        defaultModel: "gpt-5.5",
      },
    ),
  ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
});

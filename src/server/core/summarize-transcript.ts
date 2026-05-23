import { AppError } from "@/server/platform/errors";
import type { SummaryProvider, SummaryResult } from "@/server/providers/types";

export type SummarizeTranscriptInput = {
  transcript: string;
  model: string;
};

type SummarizeTranscriptDeps = {
  provider: SummaryProvider;
  allowedModels: string[];
  defaultModel: string;
  maxTranscriptLength?: number;
};

export async function summarizeTranscript(
  input: SummarizeTranscriptInput,
  deps: SummarizeTranscriptDeps,
): Promise<SummaryResult> {
  const transcript = input.transcript.trim();
  if (!transcript) {
    throw new AppError(
      "VALIDATION_ERROR",
      "VALIDATION_ERROR: transcript is required",
      { status: 400 },
    );
  }

  const maxLength = deps.maxTranscriptLength ?? 40_000;
  if (transcript.length > maxLength) {
    throw new AppError(
      "VALIDATION_ERROR",
      `VALIDATION_ERROR: transcript exceeds ${maxLength} characters`,
      { status: 400 },
    );
  }

  const model = input.model.trim() || deps.defaultModel;
  if (!deps.allowedModels.includes(model)) {
    throw new AppError(
      "VALIDATION_ERROR",
      `VALIDATION_ERROR: summary model "${model}" is not allowed`,
      { status: 400 },
    );
  }

  return deps.provider.summarize({ transcript, model });
}

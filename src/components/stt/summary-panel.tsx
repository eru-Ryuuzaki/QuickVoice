"use client";

import { useEffect, useState } from "react";

import { ModelInput } from "@/components/model-input";
import type {
  PublicProviderStatus,
  SummaryResult,
} from "@/server/providers/types";

type SummaryPanelProps = {
  transcript: string;
  summaryStatus: PublicProviderStatus["summary"];
};

const EMPTY_SUMMARY = {
  loading: false,
  error: null as string | null,
  result: null as SummaryResult | null,
};

export function SummaryPanel({
  transcript,
  summaryStatus,
}: SummaryPanelProps) {
  const [model, setModel] = useState(summaryStatus.defaultModel);
  const [state, setState] = useState(EMPTY_SUMMARY);

  useEffect(() => {
    setModel(summaryStatus.defaultModel);
  }, [summaryStatus.defaultModel]);

  async function handleSummarize() {
    setState({ loading: true, error: null, result: null });

    try {
      const response = await fetch("/api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript,
          model,
        }),
      });

      const payload = (await response.json()) as
        | SummaryResult
        | { error?: { message?: string; code?: string } };

      if (!response.ok) {
        const errorPayload = payload as {
          error?: { message?: string; code?: string };
        };
        const code = errorPayload.error?.code
          ? `${errorPayload.error.code}: `
          : "";
        const message =
          errorPayload.error?.message ?? "Failed to summarize transcript";
        throw new Error(`${code}${message}`);
      }

      setState({
        loading: false,
        error: null,
        result: payload as SummaryResult,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to summarize transcript";
      setState({ loading: false, error: message, result: null });
    }
  }

  if (!summaryStatus.available) {
    return (
      <div className="rounded-md border border-[var(--line)] bg-[var(--surface-2)] p-4 text-sm text-[var(--muted)]">
        Summary unavailable
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
        <ModelInput
          disabled={state.loading}
          label="Summary Model"
          onModelChange={setModel}
          options={summaryStatus.modelOptions}
          value={model}
        />

        <button
          className="self-end rounded-md border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 text-sm text-[var(--accent-contrast)] transition-all duration-200 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-px hover:border-[var(--accent-hover)] hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={state.loading || !transcript.trim()}
          onClick={handleSummarize}
          type="button"
        >
          {state.loading ? "Summarizing..." : "Summarize"}
        </button>
      </div>

      {state.error ? (
        <div className="rounded-md border border-[var(--danger-line)] bg-[var(--danger-surface)] p-4 text-sm text-[var(--danger-text)]">
          {state.error}
        </div>
      ) : null}

      {state.result ? (
        <div className="space-y-2 rounded-md border border-[var(--line)] bg-[var(--surface-2)] p-4">
          <h3 className="text-base">{state.result.title || "Summary"}</h3>
          <p className="text-sm leading-[1.6] text-[var(--text)]">
            {state.result.summary}
          </p>
          {state.result.keyPoints.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
              {state.result.keyPoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

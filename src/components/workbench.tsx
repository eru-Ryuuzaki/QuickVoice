"use client";

import { useState } from "react";

import { ModeSwitch } from "@/components/mode-switch";
import { SummaryPanel } from "@/components/stt/summary-panel";
import { SttPanel } from "@/components/stt/stt-panel";
import {
  TranscriptionResult,
  type SttResultState,
} from "@/components/stt/transcription-result";
import { SystemStatus } from "@/components/system-status";
import { AudioResult, type TtsResultState } from "@/components/tts/audio-result";
import { TtsForm } from "@/components/tts/tts-form";
import type { PublicProviderStatus } from "@/server/providers/types";

const DEFAULT_TTS_RESULT: TtsResultState = {
  loading: false,
  audioUrl: null,
  error: null,
  fileName: "quickvoice.mp3",
  details: null,
};

const DEFAULT_STT_RESULT: SttResultState = {
  loading: false,
  error: null,
  text: "",
  provider: null,
};

type WorkbenchProps = {
  status: PublicProviderStatus;
};

export function Workbench({ status }: WorkbenchProps) {
  const [mode, setMode] = useState<"tts" | "stt">("tts");
  const [ttsResult, setTtsResult] = useState<TtsResultState>(DEFAULT_TTS_RESULT);
  const [sttResult, setSttResult] = useState<SttResultState>(DEFAULT_STT_RESULT);

  const activeBusy = mode === "tts" ? ttsResult.loading : sttResult.loading;

  return (
    <main
      className="mx-auto min-h-screen w-full max-w-[1280px] bg-[var(--bg)] px-4 py-6 text-[var(--text)] md:px-8"
      data-testid="quickvoice-shell"
    >
      <header
        className="mb-5 flex flex-col gap-4 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-4 shadow-[0_1px_0_rgba(66,55,43,0.06)] md:flex-row md:items-end md:justify-between"
        data-testid="quickvoice-header"
      >
        <div className="flex flex-col">
          <span className="text-[0.65rem] uppercase tracking-[0.18em] text-[var(--muted)]">
            Speech Console
          </span>
          <h1 className="mt-1 text-2xl">QuickVoice</h1>
        </div>
        <div className="flex flex-col items-start gap-2 md:items-end">
          <ModeSwitch
            activeMode={mode}
            onModeChange={setMode}
            sttAvailable={status.stt.available}
          />
          <SystemStatus status={status} />
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_2px_1fr]">
        <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[0_1px_0_rgba(66,55,43,0.04)]">
          {mode === "tts" ? (
            <TtsForm
              onResultChange={setTtsResult}
              seedText=""
              ttsStatus={status.tts}
            />
          ) : (
            <SttPanel
              onResultChange={setSttResult}
              sttStatus={status.stt}
            />
          )}
        </div>

        <div
          aria-hidden="true"
          className={`hidden rounded-full md:block ${activeBusy ? "bg-[var(--accent)]" : "bg-[var(--line-strong)]"} transition-colors duration-200 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]`}
          data-testid="activity-rail"
        />

        <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[0_1px_0_rgba(66,55,43,0.04)]">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-sans text-xl">
              {mode === "tts" ? "Audio Output" : "Transcript"}
            </h2>
          </div>

          {mode === "tts" ? (
            <AudioResult result={ttsResult} />
          ) : (
            <div className="space-y-4">
              <TranscriptionResult
                onTextChange={(nextText) => {
                  setSttResult((previous) => ({
                    ...previous,
                    text: nextText,
                  }));
                }}
                result={sttResult}
                sttAvailable={status.stt.available}
              />
              {sttResult.text ? (
                <SummaryPanel
                  summaryStatus={status.summary}
                  transcript={sttResult.text}
                />
              ) : null}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

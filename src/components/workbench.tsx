"use client";

import { useState } from "react";

import { ModeSwitch } from "@/components/mode-switch";
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
  const [ttsSeedText, setTtsSeedText] = useState("");
  const [ttsResult, setTtsResult] = useState<TtsResultState>(DEFAULT_TTS_RESULT);
  const [sttResult, setSttResult] = useState<SttResultState>(DEFAULT_STT_RESULT);

  const activeBusy = mode === "tts" ? ttsResult.loading : sttResult.loading;

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1280px] px-4 py-6 md:px-8">
      <header className="mb-5 flex flex-col gap-4 border border-[var(--line)] bg-[var(--surface)] px-4 py-3 md:flex-row md:items-end md:justify-between">
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
        <div className="border border-[var(--line)] bg-[var(--surface)] p-4">
          {mode === "tts" ? (
            <TtsForm onResultChange={setTtsResult} seedText={ttsSeedText} />
          ) : (
            <SttPanel
              onResultChange={setSttResult}
              onSendToTts={() => {
                setMode("tts");
              }}
              sttStatus={status.stt}
            />
          )}
        </div>

        <div
          aria-hidden="true"
          className={`hidden md:block ${activeBusy ? "bg-[var(--accent)]" : "bg-[var(--line)]"} transition-colors duration-200 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]`}
          data-testid="activity-rail"
        />

        <div className="border border-[var(--line)] bg-[var(--surface)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl">{mode === "tts" ? "Audio Output" : "Transcript"}</h2>
            {mode === "stt" && sttResult.text ? (
              <button
                className="rounded border border-[var(--line)] px-2.5 py-1 text-xs tracking-[0.08em] text-[var(--muted)] transition-all duration-200 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-px hover:border-[var(--accent)]/65"
                onClick={() => {
                  setTtsSeedText(sttResult.text);
                  setMode("tts");
                }}
                type="button"
              >
                Send To TTS
              </button>
            ) : null}
          </div>

          {mode === "tts" ? (
            <AudioResult result={ttsResult} />
          ) : (
            <TranscriptionResult
              onSendToTts={() => {
                setTtsSeedText(sttResult.text);
                setMode("tts");
              }}
              onTextChange={(nextText) => {
                setSttResult((previous) => ({
                  ...previous,
                  text: nextText,
                }));
              }}
              result={sttResult}
              sttAvailable={status.stt.available}
            />
          )}
        </div>
      </section>
    </main>
  );
}

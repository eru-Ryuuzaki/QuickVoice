"use client";

import { useState, type FormEvent } from "react";

import type { SttResultState } from "@/components/stt/transcription-result";

type SttPanelProps = {
  sttAvailable: boolean;
  onResultChange: (result: SttResultState) => void;
  onSendToTts: () => void;
};

const DEFAULT_STT_RESULT: SttResultState = {
  loading: false,
  error: null,
  text: "",
  provider: null,
};

export function SttPanel({
  sttAvailable,
  onResultChange,
  onSendToTts,
}: SttPanelProps) {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleTranscribe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!audioFile) {
      onResultChange({
        ...DEFAULT_STT_RESULT,
        error: "Please choose an audio file first.",
      });
      return;
    }

    const formData = new FormData();
    formData.set("file", audioFile);

    setIsSubmitting(true);
    onResultChange({
      ...DEFAULT_STT_RESULT,
      loading: true,
    });

    try {
      const response = await fetch("/api/stt", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as {
        text?: string;
        provider?: string;
        error?: { message?: string; code?: string };
      };

      if (!response.ok) {
        const code = payload.error?.code ? `${payload.error.code}: ` : "";
        const message = payload.error?.message ?? "Failed to transcribe audio";
        throw new Error(`${code}${message}`);
      }

      onResultChange({
        loading: false,
        error: null,
        text: payload.text ?? "",
        provider: payload.provider ?? "siliconflow",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to transcribe audio";
      onResultChange({
        ...DEFAULT_STT_RESULT,
        error: message,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleTranscribe}>
      <header className="space-y-1">
        <h2 className="text-xl">Speech to Text</h2>
        <p className="text-xs text-[var(--muted)]">
          Upload audio and convert speech to editable text.
        </p>
      </header>

      {!sttAvailable ? (
        <div className="rounded border border-[var(--line)] bg-[var(--surface-2)] p-3 text-sm text-[var(--muted)]">
          Temporarily unavailable
        </div>
      ) : null}

      <label className="block">
        <span className="mb-1 block text-[0.68rem] uppercase tracking-[0.12em] text-[var(--muted)]">
          Audio File
        </span>
        <input
          accept=".mp3,.wav,.m4a,.flac,.aac,.ogg,.webm,.amr,.3gp,audio/*"
          className="w-full rounded border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] outline-none file:mr-3 file:rounded file:border file:border-[var(--line)] file:bg-[var(--surface)] file:px-2 file:py-1 file:text-xs file:text-[var(--text)]"
          disabled={!sttAvailable}
          onChange={(event) => setAudioFile(event.target.files?.[0] ?? null)}
          type="file"
        />
      </label>

      <button
        className="rounded border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 text-xs tracking-[0.08em] text-[#121212] transition-transform duration-200 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!sttAvailable || isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Transcribing..." : "Start Transcription"}
      </button>

      <button
        className="rounded border border-[var(--line)] px-3 py-1 text-xs tracking-[0.08em] text-[var(--muted)] transition-all duration-200 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-px hover:border-[var(--accent)]/65"
        onClick={onSendToTts}
        type="button"
      >
        Switch To TTS
      </button>
    </form>
  );
}

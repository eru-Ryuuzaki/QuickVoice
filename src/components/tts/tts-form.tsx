"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import type { VoiceGroup } from "@/server/tts/voices";

import type { TtsResultState } from "@/components/tts/audio-result";

type TtsFormProps = {
  seedText: string;
  onResultChange: (result: TtsResultState) => void;
};

const DEFAULT_TTS_RESULT: TtsResultState = {
  loading: false,
  audioUrl: null,
  error: null,
  fileName: "quickvoice.mp3",
  details: null,
};

const FALLBACK_GROUPS: VoiceGroup[] = [
  {
    id: "zh-cn",
    label: "Mandarin (zh-CN)",
    voices: [
      { id: "zh-CN-XiaoxiaoNeural", label: "Xiaoxiao", locale: "zh-CN" },
      { id: "zh-CN-YunxiNeural", label: "Yunxi", locale: "zh-CN" },
    ],
  },
];

type VoiceStatus = "loading" | "loaded" | "error";

export function TtsForm({ seedText, onResultChange }: TtsFormProps) {
  const [inputMode, setInputMode] = useState<"text" | "file">("text");
  const [text, setText] = useState(seedText);
  const [file, setFile] = useState<File | null>(null);
  const [voiceGroups, setVoiceGroups] = useState<VoiceGroup[]>(FALLBACK_GROUPS);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>("loading");
  const [voiceId, setVoiceId] = useState("zh-CN-XiaoxiaoNeural");
  const [rate, setRate] = useState("1.0");
  const [pitch, setPitch] = useState("0");
  const [style, setStyle] = useState("general");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const currentAudioUrl = useRef<string | null>(null);

  const voiceOptions = useMemo(() => {
    return voiceGroups.flatMap((group) => {
      return group.voices.map((voice) => ({
        id: voice.id,
        label: `${voice.label} · ${voice.locale}`,
      }));
    });
  }, [voiceGroups]);

  useEffect(() => {
    setText(seedText);
    setInputMode("text");
  }, [seedText]);

  useEffect(() => {
    let cancelled = false;

    async function loadVoices() {
      setVoiceStatus("loading");
      try {
        const response = await fetch("/api/voices");
        if (!response.ok) {
          throw new Error(`Failed to load voices (${response.status})`);
        }

        const payload = (await response.json()) as { groups?: VoiceGroup[] };
        if (!cancelled && payload.groups && payload.groups.length > 0) {
          setVoiceGroups(payload.groups);
          const firstVoice = payload.groups[0]?.voices[0];
          if (firstVoice) {
            setVoiceId(firstVoice.id);
          }
          setVoiceStatus("loaded");
        } else if (!cancelled) {
          setVoiceStatus("error");
        }
      } catch {
        if (!cancelled) {
          setVoiceGroups(FALLBACK_GROUPS);
          setVoiceStatus("error");
        }
      }
    }

    void loadVoices();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (currentAudioUrl.current) {
        URL.revokeObjectURL(currentAudioUrl.current);
      }
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData();
    if (inputMode === "file") {
      if (!file) {
        onResultChange({
          ...DEFAULT_TTS_RESULT,
          error: "Please select a .txt file first.",
        });
        return;
      }

      formData.set("file", file);
    } else {
      formData.set("text", text);
    }

    formData.set("voice", voiceId);
    formData.set("rate", rate);
    formData.set("pitch", pitch);
    formData.set("style", style);

    setIsSubmitting(true);
    onResultChange({
      ...DEFAULT_TTS_RESULT,
      loading: true,
    });

    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = (await response.json()) as {
          error?: { message?: string; code?: string };
        };
        const code = payload.error?.code ? `${payload.error.code}: ` : "";
        const message = payload.error?.message ?? "Failed to generate audio";
        throw new Error(`${code}${message}`);
      }

      const blob = await response.blob();
      const nextAudioUrl = URL.createObjectURL(blob);
      if (currentAudioUrl.current) {
        URL.revokeObjectURL(currentAudioUrl.current);
      }
      currentAudioUrl.current = nextAudioUrl;

      onResultChange({
        loading: false,
        audioUrl: nextAudioUrl,
        error: null,
        fileName: "quickvoice.mp3",
        details: `Voice: ${voiceId} · Rate: ${rate} · Pitch: ${pitch}`,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to generate audio";
      onResultChange({
        ...DEFAULT_TTS_RESULT,
        error: message,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <header className="space-y-1">
        <h2 className="text-xl">Text to Speech</h2>
        <p className="text-xs text-[var(--muted)]">
          Generate speech from text input or a plain text file.
        </p>
      </header>

      <div className="flex items-center gap-2">
        <button
          className={`rounded border px-2.5 py-1 text-xs tracking-[0.08em] transition-all duration-200 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] ${
            inputMode === "text"
              ? "border-[var(--accent)] bg-[var(--accent)] text-[#121212]"
              : "border-[var(--line)] text-[var(--muted)] hover:-translate-y-px hover:border-[var(--accent)]/65"
          }`}
          onClick={() => setInputMode("text")}
          type="button"
        >
          Type Text
        </button>
        <button
          className={`rounded border px-2.5 py-1 text-xs tracking-[0.08em] transition-all duration-200 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] ${
            inputMode === "file"
              ? "border-[var(--accent)] bg-[var(--accent)] text-[#121212]"
              : "border-[var(--line)] text-[var(--muted)] hover:-translate-y-px hover:border-[var(--accent)]/65"
          }`}
          onClick={() => setInputMode("file")}
          type="button"
        >
          Upload .txt
        </button>
      </div>

      {inputMode === "text" ? (
        <label className="block">
          <span className="mb-1 block text-[0.68rem] uppercase tracking-[0.12em] text-[var(--muted)]">
            Input Text
          </span>
          <textarea
            className="h-36 w-full resize-y rounded border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm leading-[1.6] text-[var(--text)] outline-none transition-colors duration-200 [transition-timing-function:cubic-bezier(0.4,0,0.2,1)] focus-visible:border-[var(--accent)]"
            onChange={(event) => setText(event.target.value)}
            placeholder="Type text for speech synthesis..."
            value={text}
          />
        </label>
      ) : (
        <label className="block">
          <span className="mb-1 block text-[0.68rem] uppercase tracking-[0.12em] text-[var(--muted)]">
            TXT File
          </span>
          <input
            accept=".txt,text/plain"
            className="w-full rounded border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] outline-none file:mr-3 file:rounded file:border file:border-[var(--line)] file:bg-[var(--surface)] file:px-2 file:py-1 file:text-xs file:text-[var(--text)]"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
            }}
            type="file"
          />
        </label>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[0.68rem] uppercase tracking-[0.12em] text-[var(--muted)]">
            Voice
          </span>
          <select
            className="w-full rounded border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] outline-none focus-visible:border-[var(--accent)]"
            onChange={(event) => setVoiceId(event.target.value)}
            value={voiceId}
          >
            {voiceOptions.map((voice) => {
              return (
                <option key={voice.id} value={voice.id}>
                  {voice.label}
                </option>
              );
            })}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-[0.68rem] uppercase tracking-[0.12em] text-[var(--muted)]">
            Style
          </span>
          <select
            className="w-full rounded border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] outline-none focus-visible:border-[var(--accent)]"
            onChange={(event) => setStyle(event.target.value)}
            value={style}
          >
            <option value="general">General</option>
            <option value="assistant">Assistant</option>
            <option value="chat">Chat</option>
            <option value="newscast">Newscast</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-[0.68rem] uppercase tracking-[0.12em] text-[var(--muted)]">
            Rate ({rate})
          </span>
          <input
            className="w-full accent-[var(--accent)]"
            max="2"
            min="0.5"
            onChange={(event) => setRate(event.target.value)}
            step="0.1"
            type="range"
            value={rate}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[0.68rem] uppercase tracking-[0.12em] text-[var(--muted)]">
            Pitch ({pitch})
          </span>
          <input
            className="w-full accent-[var(--accent)]"
            max="20"
            min="-20"
            onChange={(event) => setPitch(event.target.value)}
            step="1"
            type="range"
            value={pitch}
          />
        </label>
      </div>

      <button
        className="rounded border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 text-xs tracking-[0.08em] text-[#121212] transition-transform duration-200 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isSubmitting || voiceStatus === "loading"}
        type="submit"
      >
        {isSubmitting ? "Generating..." : "Generate Audio"}
      </button>

      {voiceStatus === "error" ? (
        <p className="text-xs text-[var(--muted)]">
          Voice catalog fallback is active.
        </p>
      ) : null}
    </form>
  );
}

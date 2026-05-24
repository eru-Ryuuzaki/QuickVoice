"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { ModelInput } from "@/components/model-input";
import type { VoiceGroup } from "@/server/tts/voices";

import type { TtsResultState } from "@/components/tts/audio-result";
import type {
  PublicProviderStatus,
  TtsProviderId,
} from "@/server/providers/types";

type TtsFormProps = {
  seedText: string;
  ttsStatus: PublicProviderStatus["tts"];
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

export function TtsForm({
  seedText,
  ttsStatus,
  onResultChange,
}: TtsFormProps) {
  const [text, setText] = useState(seedText);
  const [file, setFile] = useState<File | null>(null);
  const [voiceGroups, setVoiceGroups] = useState<VoiceGroup[]>(FALLBACK_GROUPS);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>("loading");
  const [voiceId, setVoiceId] = useState(ttsStatus.defaultVoice);
  const [model, setModel] = useState(ttsStatus.defaultModel);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const currentAudioUrl = useRef<string | null>(null);

  const selectableProviders = ttsStatus.providers;
  const availableProviders = useMemo(() => {
    return selectableProviders.filter((provider) => provider.available);
  }, [selectableProviders]);

  const resolvedProvider = useMemo(() => {
    return (
      availableProviders.find(
        (provider) =>
          provider.id === ttsStatus.defaultProvider,
      )?.id ??
      availableProviders[0]?.id ??
      ttsStatus.defaultProvider
    );
  }, [availableProviders, ttsStatus.defaultProvider]);

  const [providerId, setProviderId] =
    useState<TtsProviderId>(resolvedProvider);

  useEffect(() => {
    setProviderId(resolvedProvider);
  }, [resolvedProvider]);

  const selectedProvider =
    availableProviders.find((provider) => provider.id === providerId) ??
    availableProviders[0] ??
    ttsStatus.providers.find((provider) => provider.id === providerId) ??
    ttsStatus.providers[0];
  const selectedProviderSettings =
    ttsStatus.providerSettings?.[providerId] ?? {
      defaultModel: ttsStatus.defaultModel,
      modelOptions: ttsStatus.modelOptions ?? [],
      defaultVoice: ttsStatus.defaultVoice,
      voiceOptions: ttsStatus.voiceOptions ?? [],
    };

  useEffect(() => {
    setModel(selectedProviderSettings.defaultModel);
  }, [selectedProviderSettings.defaultModel]);

  useEffect(() => {
    setVoiceId(selectedProviderSettings.defaultVoice);
  }, [selectedProviderSettings.defaultVoice]);

  const voiceOptions = useMemo(() => {
    const catalogOptions =
      providerId === "microsoft_unofficial"
        ? voiceGroups.flatMap((group) => {
            return group.voices.map((voice) => ({
              id: voice.id,
              label: `${voice.label} (${voice.locale})`,
            }));
          })
        : [];

    const configuredOptions = selectedProviderSettings.voiceOptions.map(
      (voice) => ({
        id: voice,
        label: voice,
      }),
    );
    const options = [...catalogOptions, ...configuredOptions];
    const seen = new Set<string>();

    return options.filter((voice) => {
      if (!voice.id || seen.has(voice.id)) {
        return false;
      }

      seen.add(voice.id);
      return true;
    });
  }, [providerId, selectedProviderSettings.voiceOptions, voiceGroups]);

  const showModel = providerId === "minimax";
  const showVoice =
    providerId === "minimax" || providerId === "microsoft_unofficial";

  useEffect(() => {
    setText(seedText);
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
    if (text.trim()) {
      formData.set("text", text);
    } else {
      if (!file) {
        onResultChange({
          ...DEFAULT_TTS_RESULT,
          error: "Please type text or select a .txt file first.",
        });
        return;
      }

      formData.set("file", file);
    }

    formData.set("voice", voiceId);
    if (model) {
      formData.set("model", model);
    }
    formData.set("provider", providerId);

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
        details: `Voice: ${voiceId}`,
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

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[0.68rem] uppercase tracking-[0.12em] text-[var(--muted)]">
            TTS Provider
          </span>
          <select
            className="w-full rounded border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] outline-none focus-visible:border-[var(--accent)]"
            disabled={!ttsStatus.available || isSubmitting}
            onChange={(event) =>
              setProviderId(event.target.value as TtsProviderId)
            }
            value={providerId}
          >
            {selectableProviders.map((provider) => (
              <option
                disabled={!provider.available}
                key={provider.id}
                value={provider.id}
              >
                {provider.label}
                {provider.id === ttsStatus.defaultProvider ? " (Default)" : ""}
              </option>
            ))}
          </select>
        </label>

        {showModel ? (
          <ModelInput
            disabled={!ttsStatus.available || isSubmitting}
            label="TTS Model"
            onModelChange={setModel}
            options={selectedProviderSettings.modelOptions}
            value={model}
          />
        ) : null}

        {showVoice ? (
          <ModelInput
            disabled={!ttsStatus.available || isSubmitting}
            label="Voice"
            onModelChange={setVoiceId}
            options={voiceOptions.map((voice) => ({
              value: voice.id,
              label: voice.label,
            }))}
            value={voiceId}
          />
        ) : null}
      </div>

      <button
        className="rounded border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 text-xs tracking-[0.08em] text-[#121212] transition-transform duration-200 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
        disabled={
          isSubmitting ||
          voiceStatus === "loading" ||
          !ttsStatus.available ||
          !selectedProvider?.available
        }
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

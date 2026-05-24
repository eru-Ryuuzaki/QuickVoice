"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

import { ModelInput } from "@/components/model-input";
import type { SttResultState } from "@/components/stt/transcription-result";
import type {
  PublicProviderStatus,
  SttProviderId,
} from "@/server/providers/types";

type SttPanelProps = {
  sttStatus: PublicProviderStatus["stt"];
  onResultChange: (result: SttResultState) => void;
};

const DEFAULT_STT_RESULT: SttResultState = {
  loading: false,
  error: null,
  text: "",
  provider: null,
  statusText: undefined,
};

const STT_JOB_POLL_INTERVAL_MS = 3000;
const STT_JOB_MAX_POLLS = 60;

async function uploadAudioToCos(uploadUrl: string, audioFile: File) {
  try {
    return await fetch(uploadUrl, {
      method: "PUT",
      mode: "cors",
      body: audioFile,
      headers: {
        "Content-Type": audioFile.type || "application/octet-stream",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? ` Original browser error: ${error.message}`
        : "";
    throw new Error(
      `COS direct upload failed. Check the COS bucket CORS policy allows PUT from this app origin and allows the Content-Type header.${message}`,
    );
  }
}

export function SttPanel({
  sttStatus,
  onResultChange,
}: SttPanelProps) {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [model, setModel] = useState(sttStatus.defaultModel);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectableProviders = sttStatus.providers;
  const availableProviders = useMemo(() => {
    return selectableProviders.filter((provider) => provider.available);
  }, [selectableProviders]);

  const resolvedProvider = useMemo(() => {
    return (
      availableProviders.find(
        (provider) =>
          provider.id === sttStatus.defaultProvider,
      )?.id ??
      availableProviders[0]?.id ??
      sttStatus.defaultProvider
    );
  }, [availableProviders, sttStatus.defaultProvider]);

  const [providerId, setProviderId] = useState<SttProviderId>(resolvedProvider);

  useEffect(() => {
    setModel(sttStatus.defaultModel);
  }, [sttStatus.defaultModel]);

  useEffect(() => {
    setProviderId(resolvedProvider);
  }, [resolvedProvider]);

  const selectedProvider =
    availableProviders.find((provider) => provider.id === providerId) ??
    availableProviders[0] ??
    sttStatus.providers.find((provider) => provider.id === providerId) ??
    sttStatus.providers[0];
  const showModel = providerId === "volcengine";

  async function pollSttJob(jobId: string, provider: string) {
    for (let attempt = 0; attempt < STT_JOB_MAX_POLLS; attempt++) {
      await new Promise((resolve) =>
        setTimeout(resolve, STT_JOB_POLL_INTERVAL_MS),
      );

      const formData = new FormData();
      formData.set("provider", provider);
      formData.set("jobId", jobId);

      const response = await fetch("/api/stt", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as {
        status?: string;
        text?: string;
        provider?: string;
        jobId?: string;
        error?: { message?: string; code?: string };
      };

      if (response.status === 202) {
        const statusText =
          payload.status === "queued"
            ? "Audio submitted. Waiting in queue..."
            : "Audio submitted. Checking transcription status...";
        onResultChange({
          ...DEFAULT_STT_RESULT,
          loading: true,
          provider,
          statusText,
        });
        continue;
      }

      if (!response.ok) {
        const code = payload.error?.code ? `${payload.error.code}: ` : "";
        const message = payload.error?.message ?? "Failed to transcribe audio";
        throw new Error(`${code}${message}`);
      }

      return {
        text: payload.text ?? "",
        provider: payload.provider ?? provider,
      };
    }

    throw new Error("PROCESSING_FAILED: STT job timed out");
  }

  async function handleTranscribe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!audioFile) {
      onResultChange({
        ...DEFAULT_STT_RESULT,
        error: "Please choose an audio file first.",
      });
      return;
    }

    if (!selectedProvider?.available) {
      onResultChange({
        ...DEFAULT_STT_RESULT,
        error: "Selected STT provider is unavailable.",
      });
      return;
    }

    setIsSubmitting(true);
    onResultChange({
      ...DEFAULT_STT_RESULT,
      loading: true,
      provider: providerId,
      statusText: "Preparing audio upload...",
    });

    try {
      let response: Response;

      if (providerId === "volcengine") {
        const uploadFormData = new FormData();
        uploadFormData.set("provider", providerId);
        uploadFormData.set("intent", "upload");
        uploadFormData.set("fileName", audioFile.name);
        uploadFormData.set(
          "contentType",
          audioFile.type || "application/octet-stream",
        );
        uploadFormData.set("size", String(audioFile.size));
        if (model) {
          uploadFormData.set("model", model);
        }

        const uploadResponse = await fetch("/api/stt", {
          method: "POST",
          body: uploadFormData,
        });
        const uploadPayload = (await uploadResponse.json()) as {
          uploadUrl?: string;
          audioUrl?: string;
          error?: { message?: string; code?: string };
        };

        if (!uploadResponse.ok || !uploadPayload.uploadUrl || !uploadPayload.audioUrl) {
          const code = uploadPayload.error?.code
            ? `${uploadPayload.error.code}: `
            : "";
          const message =
            uploadPayload.error?.message ?? "Failed to prepare audio upload";
          throw new Error(`${code}${message}`);
        }

        onResultChange({
          ...DEFAULT_STT_RESULT,
          loading: true,
          provider: providerId,
          statusText: "Uploading audio to COS...",
        });

        const cosResponse = await uploadAudioToCos(
          uploadPayload.uploadUrl,
          audioFile,
        );
        if (!cosResponse.ok) {
          throw new Error(`Failed to upload audio to COS (${cosResponse.status})`);
        }

        const submitFormData = new FormData();
        submitFormData.set("provider", providerId);
        submitFormData.set("intent", "submit");
        submitFormData.set("audioUrl", uploadPayload.audioUrl);
        if (model) {
          submitFormData.set("model", model);
        }

        response = await fetch("/api/stt", {
          method: "POST",
          body: submitFormData,
        });
      } else {
        const formData = new FormData();
        formData.set("file", audioFile);
        formData.set("provider", providerId);
        if (showModel && model) {
          formData.set("model", model);
        }

        response = await fetch("/api/stt", {
          method: "POST",
          body: formData,
        });
      }

      const payload = (await response.json()) as {
        status?: string;
        jobId?: string;
        text?: string;
        provider?: string;
        error?: { message?: string; code?: string };
      };

      if (response.status === 202 && payload.jobId) {
        onResultChange({
          ...DEFAULT_STT_RESULT,
          loading: true,
          provider: payload.provider ?? providerId,
          statusText: "Audio submitted. Checking transcription status...",
        });
        const result = await pollSttJob(
          payload.jobId,
          payload.provider ?? providerId,
        );
        onResultChange({
          loading: false,
          error: null,
          text: result.text,
          provider: result.provider,
        });
        return;
      }

      if (!response.ok) {
        const code = payload.error?.code ? `${payload.error.code}: ` : "";
        const message = payload.error?.message ?? "Failed to transcribe audio";
        throw new Error(`${code}${message}`);
      }

      onResultChange({
        loading: false,
        error: null,
        text: payload.text ?? "",
        provider: payload.provider ?? providerId,
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

      {!sttStatus.available ? (
        <div className="rounded border border-[var(--line)] bg-[var(--surface-2)] p-3 text-sm text-[var(--muted)]">
          Temporarily unavailable
        </div>
      ) : null}

      <label className="block">
        <span className="mb-1 block text-[0.68rem] uppercase tracking-[0.12em] text-[var(--muted)]">
          STT Provider
        </span>
        <select
          className="w-full rounded border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] outline-none focus-visible:border-[var(--accent)]"
          disabled={!sttStatus.available || isSubmitting}
          onChange={(event) => setProviderId(event.target.value as SttProviderId)}
          value={providerId}
        >
          {selectableProviders.map((provider) => (
            <option
              disabled={!provider.available}
              key={provider.id}
              value={provider.id}
            >
              {provider.label}
              {provider.id === sttStatus.defaultProvider ? " (Default)" : ""}
            </option>
          ))}
        </select>
      </label>

      {showModel ? (
        <ModelInput
          disabled={!sttStatus.available || isSubmitting}
          label="STT Model"
          onModelChange={setModel}
          options={sttStatus.modelOptions ?? []}
          value={model}
        />
      ) : null}

      <label className="block">
        <span className="mb-1 block text-[0.68rem] uppercase tracking-[0.12em] text-[var(--muted)]">
          Audio File
        </span>
        <input
          accept=".mp3,.wav,.m4a,.flac,.aac,.ogg,.webm,.amr,.3gp,audio/*"
          className="w-full rounded border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] outline-none file:mr-3 file:rounded file:border file:border-[var(--line)] file:bg-[var(--surface)] file:px-2 file:py-1 file:text-xs file:text-[var(--text)]"
          disabled={!sttStatus.available}
          onChange={(event) => setAudioFile(event.target.files?.[0] ?? null)}
          type="file"
        />
      </label>

      <button
        className="rounded border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 text-xs tracking-[0.08em] text-[#121212] transition-transform duration-200 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!sttStatus.available || !selectedProvider?.available || isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Transcribing..." : "Start Transcription"}
      </button>

    </form>
  );
}

import type { PublicProviderStatus } from "@/server/providers/types";

type SystemStatusProps = {
  status: PublicProviderStatus;
};

function formatState(available: boolean) {
  return available ? "AVAILABLE" : "UNAVAILABLE";
}

export function SystemStatus({ status }: SystemStatusProps) {
  const defaultSttProviderLabel = status.stt.defaultProvider.toUpperCase();
  const defaultTtsProviderLabel = status.tts.defaultProvider.toUpperCase();
  const defaultSummaryModelLabel = status.summary.defaultModel.toUpperCase();

  return (
    <div className="flex flex-wrap gap-2 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--muted)]">
      <span>TTS {formatState(status.tts.available)}</span>
      <span>STT {formatState(status.stt.available)}</span>
      <span>SUMMARY {formatState(status.summary.available)}</span>
      <span>TTS DEFAULT {defaultTtsProviderLabel}</span>
      <span>STT DEFAULT {defaultSttProviderLabel}</span>
      <span>SUMMARY DEFAULT {defaultSummaryModelLabel}</span>
      {status.stt.providers.map((provider) => (
        <span key={provider.id}>
          {provider.label.toUpperCase()} {formatState(provider.available)}
        </span>
      ))}
    </div>
  );
}

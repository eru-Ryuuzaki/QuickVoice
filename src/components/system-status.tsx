import type { PublicProviderStatus } from "@/server/providers/types";

type SystemStatusProps = {
  status: PublicProviderStatus;
};

function formatState(available: boolean) {
  return available ? "AVAILABLE" : "UNAVAILABLE";
}

export function SystemStatus({ status }: SystemStatusProps) {
  const defaultProviderLabel = status.stt.defaultProvider.toUpperCase();

  return (
    <div className="flex flex-wrap gap-2 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--muted)]">
      <span>TTS {formatState(status.tts.available)}</span>
      <span>STT {formatState(status.stt.available)}</span>
      <span>DEFAULT {defaultProviderLabel}</span>
      {status.stt.providers.map((provider) => (
        <span key={provider.id}>
          {provider.label.toUpperCase()} {formatState(provider.available)}
        </span>
      ))}
    </div>
  );
}

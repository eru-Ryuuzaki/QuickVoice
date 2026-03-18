import type { PublicProviderStatus } from "@/server/providers/types";

type SystemStatusProps = {
  status: PublicProviderStatus;
};

function formatState(available: boolean) {
  return available ? "AVAILABLE" : "UNAVAILABLE";
}

export function SystemStatus({ status }: SystemStatusProps) {
  const statusText = `TTS ${formatState(status.tts.available)} / STT ${formatState(status.stt.available)}`;

  return (
    <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--muted)]">
      {statusText}
    </div>
  );
}

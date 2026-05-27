import {
  STT_PROVIDER_LABELS,
  TTS_PROVIDER_LABELS,
  type PublicProviderStatus,
} from "@/server/providers/types";

type SystemStatusProps = {
  status: PublicProviderStatus;
};

function withAvailability(label: string, available: boolean) {
  return available ? label : `${label} Unavailable`;
}

export function SystemStatus({ status }: SystemStatusProps) {
  const defaultSttProviderLabel = STT_PROVIDER_LABELS[status.stt.defaultProvider];
  const defaultTtsProviderLabel = TTS_PROVIDER_LABELS[status.tts.defaultProvider];
  const defaultSummaryModelLabel = status.summary.defaultModel;

  return (
    <div className="flex flex-wrap gap-2 rounded-md border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--muted)]">
      <span>
        TTS: {withAvailability(defaultTtsProviderLabel, status.tts.available)}
      </span>
      <span>
        STT: {withAvailability(defaultSttProviderLabel, status.stt.available)}
      </span>
      <span>
        Summary:{" "}
        {withAvailability(defaultSummaryModelLabel, status.summary.available)}
      </span>
    </div>
  );
}

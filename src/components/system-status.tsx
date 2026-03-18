type SystemStatusProps = {
  tts: "available" | "degraded";
  stt: "available" | "unavailable";
};

export function SystemStatus({ tts, stt }: SystemStatusProps) {
  const statusText = `TTS ${tts.toUpperCase()} / STT ${stt.toUpperCase()}`;

  return (
    <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--muted)]">
      {statusText}
    </div>
  );
}

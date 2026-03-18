type ModeSwitchProps = {
  activeMode: "tts" | "stt";
  sttAvailable: boolean;
};

export function ModeSwitch({ activeMode, sttAvailable }: ModeSwitchProps) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--surface)] p-1">
      <button
        className={`rounded px-3 py-1 text-xs transition-transform duration-150 ${
          activeMode === "tts" ? "bg-[var(--accent)] text-[#121212]" : "text-[var(--muted)]"
        }`}
        type="button"
      >
        文字转语音
      </button>
      <button
        className={`rounded border px-3 py-1 text-xs ${
          sttAvailable ? "border-[var(--line)] text-[var(--muted)]" : "border-[var(--line)]/60 text-[var(--muted)]/70"
        }`}
        type="button"
      >
        语音转文字{sttAvailable ? "" : "（暂不可用）"}
      </button>
    </div>
  );
}

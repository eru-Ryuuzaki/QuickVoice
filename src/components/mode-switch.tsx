"use client";

type ModeSwitchProps = {
  activeMode: "tts" | "stt";
  sttAvailable: boolean;
  onModeChange: (mode: "tts" | "stt") => void;
};

function tabClassName(active: boolean) {
  if (active) {
    return "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)]";
  }

  return "border-[var(--line)] bg-[var(--surface-2)] text-[var(--muted)] hover:-translate-y-px hover:border-[var(--accent)] hover:text-[var(--text)]";
}

export function ModeSwitch({
  activeMode,
  sttAvailable,
  onModeChange,
}: ModeSwitchProps) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--surface-2)] p-1.5">
      <button
        aria-pressed={activeMode === "tts"}
        className={`rounded-md border px-3 py-1 text-sm transition-all duration-200 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] ${tabClassName(activeMode === "tts")}`}
        onClick={() => onModeChange("tts")}
        type="button"
      >
        Text to Speech
      </button>

      <button
        aria-pressed={activeMode === "stt"}
        className={`rounded-md border px-3 py-1 text-sm transition-all duration-200 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] ${tabClassName(activeMode === "stt")}`}
        onClick={() => onModeChange("stt")}
        type="button"
      >
        Speech to Text{sttAvailable ? "" : " (Disabled)"}
      </button>
    </div>
  );
}

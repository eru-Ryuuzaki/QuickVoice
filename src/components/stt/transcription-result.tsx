export type SttResultState = {
  loading: boolean;
  error: string | null;
  text: string;
  provider: string | null;
  statusText?: string;
};

type TranscriptionResultProps = {
  result: SttResultState;
  sttAvailable: boolean;
  onTextChange: (nextText: string) => void;
};

export function TranscriptionResult({
  result,
  sttAvailable,
  onTextChange,
}: TranscriptionResultProps) {
  if (!sttAvailable) {
    return (
      <div className="rounded border border-[var(--line)] bg-[var(--surface-2)] p-4 text-sm text-[var(--muted)]">
        STT is currently disabled for public access. Keep the entry point visible
        so switching providers later does not change the product structure.
      </div>
    );
  }

  if (result.loading) {
    return (
      <div className="rounded border border-[var(--line)] bg-[var(--surface-2)] p-4 text-sm text-[var(--muted)]">
        {result.statusText ?? "Transcribing audio..."}
      </div>
    );
  }

  if (result.error) {
    return (
      <div className="rounded border border-[#7c2a2a] bg-[#2a1717] p-4 text-sm text-[#ffb4b4]">
        {result.error}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-[0.68rem] uppercase tracking-[0.12em] text-[var(--muted)]">
          Transcript
        </span>
        <textarea
          className="h-44 w-full resize-y rounded border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm leading-[1.6] text-[var(--text)] outline-none transition-colors duration-200 [transition-timing-function:cubic-bezier(0.4,0,0.2,1)] focus-visible:border-[var(--accent)]"
          onChange={(event) => onTextChange(event.target.value)}
          placeholder="Enter transcript text or transcribe an audio file."
          value={result.text}
        />
      </label>

      {result.text ? (
        <div className="flex items-center gap-2">
          <button
            className="rounded border border-[var(--line)] px-3 py-1.5 text-xs tracking-[0.08em] text-[var(--text)] transition-all duration-200 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-px hover:border-[var(--accent)]/65"
            onClick={() => {
              void navigator.clipboard.writeText(result.text);
            }}
            type="button"
          >
            Copy
          </button>
        </div>
      ) : null}
    </div>
  );
}

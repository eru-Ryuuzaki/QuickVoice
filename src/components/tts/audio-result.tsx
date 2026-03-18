export type TtsResultState = {
  loading: boolean;
  audioUrl: string | null;
  error: string | null;
  fileName: string;
  details: string | null;
};

type AudioResultProps = {
  result: TtsResultState;
};

export function AudioResult({ result }: AudioResultProps) {
  if (result.loading) {
    return (
      <div className="rounded border border-[var(--line)] bg-[var(--surface-2)] p-4 text-sm text-[var(--muted)]">
        Synthesizing audio...
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

  if (!result.audioUrl) {
    return (
      <div className="rounded border border-[var(--line)] bg-[var(--surface-2)] p-4 text-sm text-[var(--muted)]">
        Generate audio to preview and download.
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded border border-[var(--line)] bg-[var(--surface-2)] p-4">
      <audio className="w-full" controls src={result.audioUrl} />

      <a
        className="inline-flex items-center rounded border border-[var(--line)] px-3 py-1.5 text-xs tracking-[0.08em] text-[var(--text)] transition-all duration-200 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-px hover:border-[var(--accent)]/65"
        download={result.fileName}
        href={result.audioUrl}
      >
        Download Audio
      </a>

      {result.details ? (
        <p className="text-xs text-[var(--muted)]">{result.details}</p>
      ) : null}
    </div>
  );
}

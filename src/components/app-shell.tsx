import { ModeSwitch } from "@/components/mode-switch";
import { SystemStatus } from "@/components/system-status";
import type { PublicProviderStatus } from "@/server/providers/types";

type AppShellProps = {
  status: PublicProviderStatus;
};

export function AppShell({ status }: AppShellProps) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-[1280px] px-4 py-6 md:px-8">
      <header className="mb-5 flex items-center justify-between border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
        <div className="flex flex-col">
          <span className="text-[0.65rem] uppercase tracking-[0.18em] text-[var(--muted)]">Speech Console</span>
          <h1 className="mt-1 text-2xl">QuickVoice</h1>
        </div>
        <div className="flex items-center gap-3">
          <ModeSwitch activeMode="tts" sttAvailable={status.stt.available} />
          <SystemStatus status={status} />
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_2px_1fr]">
        <div className="border border-[var(--line)] bg-[var(--surface)] p-4">
          <p className="mb-3 text-xs uppercase tracking-[0.14em] text-[var(--muted)]">输入与参数</p>
          <div className="rounded border border-[var(--line)] bg-[var(--surface-2)] p-3 text-sm text-[var(--muted)]">
            文字转语音
          </div>
        </div>

        <div aria-hidden="true" className="hidden bg-[var(--accent)]/70 md:block" data-testid="activity-rail" />

        <div className="border border-[var(--line)] bg-[var(--surface)] p-4">
          <p className="mb-3 text-xs uppercase tracking-[0.14em] text-[var(--muted)]">结果与状态</p>
          <div className="rounded border border-[var(--line)] bg-[var(--surface-2)] p-3 text-sm text-[var(--muted)]">
            {status.stt.available ? "语音转文字" : "语音转文字（暂不可用）"}
          </div>
        </div>
      </section>
    </main>
  );
}

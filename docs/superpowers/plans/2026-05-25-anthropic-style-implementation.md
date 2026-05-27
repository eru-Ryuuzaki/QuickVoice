# Anthropic Style Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle QuickVoice to the approved warm Anthropic-inspired product console without changing TTS, STT, or summary behavior.

**Architecture:** The visual system already flows through CSS variables and Tailwind arbitrary values, so the implementation will update theme tokens first, then adjust component classes where dark-console assumptions remain. A narrow style contract test will assert the approved tokens and key shell classes so the visual direction has regression coverage.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, Vitest, Testing Library.

---

## File Structure

- Modify `src/app/globals.css`: warm paper theme tokens, global background, typography, selection, form color scheme.
- Modify `src/components/workbench.tsx`: warm shell spacing, panel radius, subtle activity rail, no behavior changes.
- Modify `src/components/mode-switch.tsx`: terracotta active tab and paper inactive tabs.
- Modify `src/components/system-status.tsx`: warm status pill treatment.
- Modify `src/components/model-input.tsx`: shared select styling with warm focus and surface tokens.
- Modify `src/components/tts/tts-form.tsx`: warm input/file/button styling.
- Modify `src/components/tts/audio-result.tsx`: warm result and error panels.
- Modify `src/components/stt/stt-panel.tsx`: warm input/file/button/unavailable styling.
- Modify `src/components/stt/transcription-result.tsx`: warm transcript/result/error styling.
- Modify `src/components/stt/summary-panel.tsx`: warm summary controls and result panels.
- Modify `src/components/app-shell.test.tsx`: add style contract expectations for the approved visual direction.

---

### Task 1: Add Style Contract Test

**Files:**
- Modify: `src/components/app-shell.test.tsx`

- [ ] **Step 1: Write the failing test**

Append this test to `src/components/app-shell.test.tsx`:

```tsx
test("uses the warm Anthropic-inspired visual shell", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ groups: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );

  render(<AppShell status={baseStatus} />);

  const shell = screen.getByTestId("quickvoice-shell");
  const header = screen.getByRole("banner");
  const activeTab = screen.getByRole("button", { name: "Text to Speech" });
  const activityRail = screen.getByTestId("activity-rail");

  expect(shell).toHaveClass("bg-[var(--bg)]");
  expect(header).toHaveClass("rounded-md", "bg-[var(--surface)]");
  expect(activeTab).toHaveClass("bg-[var(--accent)]", "text-[var(--accent-contrast)]");
  expect(activityRail.className).toContain("bg-[var(--line-strong)]");

  await waitFor(() => {
    expect(fetch).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/components/app-shell.test.tsx
```

Expected: FAIL because `quickvoice-shell` does not exist yet and the header/tab classes still reflect the dark console.

- [ ] **Step 3: Commit the failing test**

Do not commit while failing. Proceed to Task 2.

---

### Task 2: Apply Warm Global Theme

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Replace global theme tokens and base styles**

Change `src/app/globals.css` to use these token values and global styles:

```css
@import "tailwindcss";

:root {
  --bg: #f4efe5;
  --surface: #fffaf0;
  --surface-2: #fbf6ec;
  --surface-3: #f0e8da;
  --text: #231f1a;
  --muted: #746b5f;
  --line: rgba(66, 55, 43, 0.16);
  --line-strong: rgba(66, 55, 43, 0.28);
  --accent: #8f4f34;
  --accent-hover: #78412a;
  --accent-contrast: #fffaf0;
  --danger-surface: #fff0ec;
  --danger-line: #e0a091;
  --danger-text: #8a2d1f;
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
  background: var(--bg);
  color: var(--text);
  color-scheme: light;
  font-family: var(--font-body), monospace;
}

h1,
h2,
h3 {
  font-family: var(--font-display), serif;
  letter-spacing: 0;
  line-height: 1.1;
}

a {
  color: inherit;
  text-decoration: none;
}

button,
input,
select,
textarea {
  font: inherit;
}

::selection {
  background: color-mix(in oklab, var(--accent) 24%, white);
}
```

- [ ] **Step 2: Run app shell test**

Run:

```bash
npm test -- src/components/app-shell.test.tsx
```

Expected: still FAIL because component classes have not been updated yet.

---

### Task 3: Restyle Shell, Tabs, Status, And Model Select

**Files:**
- Modify: `src/components/workbench.tsx`
- Modify: `src/components/mode-switch.tsx`
- Modify: `src/components/system-status.tsx`
- Modify: `src/components/model-input.tsx`

- [ ] **Step 1: Update `Workbench` shell and panels**

In `src/components/workbench.tsx`, update the rendered shell structure classes:

```tsx
return (
  <main
    className="mx-auto min-h-screen w-full max-w-[1280px] bg-[var(--bg)] px-4 py-6 text-[var(--text)] md:px-8"
    data-testid="quickvoice-shell"
  >
    <header
      className="mb-5 flex flex-col gap-4 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-4 shadow-[0_1px_0_rgba(66,55,43,0.06)] md:flex-row md:items-end md:justify-between"
      role="banner"
    >
      ...
    </header>

    <section className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_2px_1fr]">
      <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[0_1px_0_rgba(66,55,43,0.04)]">
        ...
      </div>

      <div
        aria-hidden="true"
        className={`hidden rounded-full md:block ${activeBusy ? "bg-[var(--accent)]" : "bg-[var(--line-strong)]"} transition-colors duration-200 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]`}
        data-testid="activity-rail"
      />

      <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[0_1px_0_rgba(66,55,43,0.04)]">
        ...
      </div>
    </section>
  </main>
);
```

Keep all existing conditional rendering and props unchanged.

- [ ] **Step 2: Update `ModeSwitch` tab classes**

In `src/components/mode-switch.tsx`, change `tabClassName` and wrapper classes:

```tsx
function tabClassName(active: boolean) {
  if (active) {
    return "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)]";
  }

  return "border-[var(--line)] bg-[var(--surface-2)] text-[var(--muted)] hover:-translate-y-px hover:border-[var(--accent)] hover:text-[var(--text)]";
}
```

Wrapper:

```tsx
<div className="flex items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--surface-2)] p-1.5">
```

- [ ] **Step 3: Update `SystemStatus` wrapper**

In `src/components/system-status.tsx`, change the wrapper class to:

```tsx
<div className="flex flex-wrap gap-2 rounded-md border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--muted)]">
```

- [ ] **Step 4: Update `ModelInput` select styling**

In `src/components/model-input.tsx`, change the select class to:

```tsx
className="w-full rounded-md border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] outline-none transition-colors duration-200 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] focus-visible:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
```

- [ ] **Step 5: Run app shell test**

Run:

```bash
npm test -- src/components/app-shell.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit shell theme changes**

Run:

```bash
git add src/app/globals.css src/components/workbench.tsx src/components/mode-switch.tsx src/components/system-status.tsx src/components/model-input.tsx src/components/app-shell.test.tsx
git commit -m "style: apply warm quickvoice shell"
```

---

### Task 4: Restyle Forms And Result States

**Files:**
- Modify: `src/components/tts/tts-form.tsx`
- Modify: `src/components/tts/audio-result.tsx`
- Modify: `src/components/stt/stt-panel.tsx`
- Modify: `src/components/stt/transcription-result.tsx`
- Modify: `src/components/stt/summary-panel.tsx`

- [ ] **Step 1: Update common form control classes**

In `src/components/tts/tts-form.tsx` and `src/components/stt/stt-panel.tsx`:

Use this class for textareas:

```tsx
className="h-36 w-full resize-y rounded-md border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm leading-[1.6] text-[var(--text)] outline-none transition-colors duration-200 [transition-timing-function:cubic-bezier(0.4,0,0.2,1)] placeholder:text-[var(--muted)] focus-visible:border-[var(--accent)]"
```

Use this class for file inputs:

```tsx
className="w-full rounded-md border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] outline-none file:mr-3 file:rounded-md file:border file:border-[var(--line)] file:bg-[var(--surface)] file:px-2 file:py-1 file:text-xs file:text-[var(--text)] focus-visible:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
```

Use this class for provider selects in both files:

```tsx
className="w-full rounded-md border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] outline-none transition-colors duration-200 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] focus-visible:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
```

Use this class for primary buttons:

```tsx
className="rounded-md border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 text-xs tracking-[0.08em] text-[var(--accent-contrast)] transition-all duration-200 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-px hover:border-[var(--accent-hover)] hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
```

- [ ] **Step 2: Update result and error panels**

In `src/components/tts/audio-result.tsx`, `src/components/stt/transcription-result.tsx`, and `src/components/stt/summary-panel.tsx`:

Use warm neutral panels:

```tsx
className="rounded-md border border-[var(--line)] bg-[var(--surface-2)] p-4 text-sm text-[var(--muted)]"
```

Use warm error panels:

```tsx
className="rounded-md border border-[var(--danger-line)] bg-[var(--danger-surface)] p-4 text-sm text-[var(--danger-text)]"
```

Use secondary action buttons:

```tsx
className="inline-flex items-center rounded-md border border-[var(--line)] bg-[var(--surface-2)] px-3 py-1.5 text-xs tracking-[0.08em] text-[var(--text)] transition-all duration-200 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-px hover:border-[var(--accent)]"
```

Use this transcript textarea class in `transcription-result.tsx`:

```tsx
className="h-44 w-full resize-y rounded-md border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm leading-[1.6] text-[var(--text)] outline-none transition-colors duration-200 [transition-timing-function:cubic-bezier(0.4,0,0.2,1)] placeholder:text-[var(--muted)] focus-visible:border-[var(--accent)]"
```

Use this summary primary button class in `summary-panel.tsx`:

```tsx
className="self-end rounded-md border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 text-xs tracking-[0.08em] text-[var(--accent-contrast)] transition-all duration-200 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-px hover:border-[var(--accent-hover)] hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
```

- [ ] **Step 3: Run focused component tests**

Run:

```bash
npm test -- src/components/app-shell.test.tsx src/components/tts/tts-form.test.tsx src/components/stt/stt-panel.test.tsx src/components/stt/transcription-result.test.tsx src/components/stt/summary-panel.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Commit form and result styling**

Run:

```bash
git add src/components/tts/tts-form.tsx src/components/tts/audio-result.tsx src/components/stt/stt-panel.tsx src/components/stt/transcription-result.tsx src/components/stt/summary-panel.tsx
git commit -m "style: restyle quickvoice forms and results"
```

---

### Task 5: Verify Build And Browser Rendering

**Files:**
- No planned source changes unless verification reveals a visual issue.

- [ ] **Step 1: Run full automated checks**

Run:

```bash
npm test
npm run lint
```

Expected: PASS.

- [ ] **Step 2: Start the development server**

Run:

```bash
npm run dev
```

Expected: Next.js starts and prints a local URL, usually `http://localhost:3000`.

- [ ] **Step 3: Inspect the page in a browser**

Open the local URL. Confirm:

- Page background is warm off-white.
- Main panels are warm paper surfaces with light rounded corners.
- Active mode tab and primary buttons are terracotta.
- Text remains readable in TTS and STT modes.
- No header, control, or result text overlaps on desktop width.

- [ ] **Step 4: Final commit if verification required small fixes**

If Step 3 required fixes, run the focused tests again and commit the fixes with:

```bash
git add src
git commit -m "style: polish quickvoice warm theme"
```

If no fixes were needed, do not create an empty commit.

---

## Self-Review

- Spec coverage: global theme, shell, tabs, status, forms, results, error states, and testing are covered.
- Placeholder scan: no placeholder tasks or ambiguous "add appropriate" steps remain.
- Type consistency: no new public types or data flow changes are introduced.

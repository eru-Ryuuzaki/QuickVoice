"use client";

import { useEffect, useState } from "react";

type ModelInputProps = {
  label: string;
  storageKey: string;
  defaultModel: string;
  disabled?: boolean;
  onModelChange: (model: string) => void;
};

export function ModelInput({
  label,
  storageKey,
  defaultModel,
  disabled = false,
  onModelChange,
}: ModelInputProps) {
  const [model, setModel] = useState(() => {
    if (typeof window === "undefined") {
      return defaultModel;
    }

    const savedModel = window.localStorage.getItem(storageKey);
    return savedModel?.trim() || defaultModel;
  });

  useEffect(() => {
    onModelChange(model);
  }, [model, onModelChange]);

  function handleChange(nextModel: string) {
    setModel(nextModel);
    onModelChange(nextModel);

    if (nextModel.trim()) {
      window.localStorage.setItem(storageKey, nextModel.trim());
    } else {
      window.localStorage.removeItem(storageKey);
    }
  }

  function handleClear() {
    window.localStorage.removeItem(storageKey);
    setModel(defaultModel);
    onModelChange(defaultModel);
  }

  return (
    <div className="grid grid-cols-[1fr_auto] items-end gap-2">
      <label className="block">
        <span className="mb-1 block text-[0.68rem] uppercase tracking-[0.12em] text-[var(--muted)]">
          {label}
        </span>
        <input
          className="w-full rounded border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] outline-none focus-visible:border-[var(--accent)]"
          disabled={disabled}
          onChange={(event) => handleChange(event.target.value)}
          value={model}
        />
      </label>

      <button
        aria-label={`Clear ${label}`}
        className="rounded border border-[var(--line)] px-3 py-2 text-xs tracking-[0.08em] text-[var(--muted)] transition-all duration-200 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-px hover:border-[var(--accent)]/65 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled}
        onClick={handleClear}
        type="button"
      >
        Clear
      </button>
    </div>
  );
}

"use client";

import { useId, useMemo } from "react";

export type ModelInputOption = string | { value: string; label: string };

type ModelInputProps = {
  label: string;
  value: string;
  options?: ModelInputOption[];
  disabled?: boolean;
  onModelChange: (model: string) => void;
};

type NormalizedModelOption = {
  value: string;
  label: string;
};

function normalizeOption(option: ModelInputOption): NormalizedModelOption {
  if (typeof option === "string") {
    const value = option.trim();
    return { value, label: value };
  }

  const value = option.value.trim();
  const label = option.label.trim() || value;
  return { value, label };
}

function buildOptions(currentValue: string, options: ModelInputOption[]) {
  const seen = new Set<string>();
  const values = options
    .map(normalizeOption)
    .filter((option) => {
      if (!option.value || seen.has(option.value)) {
        return false;
      }

      seen.add(option.value);
      return true;
    });

  const normalizedValue = currentValue.trim();
  if (!normalizedValue) {
    return [{ value: "", label: "Default" }, ...values];
  }

  if (!seen.has(normalizedValue)) {
    return [{ value: normalizedValue, label: normalizedValue }, ...values];
  }

  return values.length > 0 ? values : [{ value: "", label: "Default" }];
}

export function ModelInput({
  label,
  value,
  options = [],
  disabled = false,
  onModelChange,
}: ModelInputProps) {
  const inputId = useId();
  const selectOptions = useMemo(
    () => buildOptions(value, options),
    [value, options],
  );

  function handleChange(nextModel: string) {
    onModelChange(nextModel);
  }

  return (
    <label className="block">
      <span className="mb-1 block text-[0.68rem] uppercase tracking-[0.12em] text-[var(--muted)]">
        {label}
      </span>
      <select
        className="w-full rounded border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] outline-none focus-visible:border-[var(--accent)]"
        disabled={disabled}
        id={inputId}
        onChange={(event) => handleChange(event.target.value)}
        value={value}
      >
        {selectOptions.map((option) => (
          <option key={option.value || "__blank"} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

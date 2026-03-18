type NormalizeTtsParamsInput = {
  rate?: string;
  pitch?: string;
  style?: string;
};

export type NormalizedTtsParams = {
  rate: string;
  pitch: string;
  style: string;
};

const DEFAULT_STYLE = "general";
const SUPPORTED_STYLES = new Set([
  "general",
  "assistant",
  "chat",
  "customerservice",
  "newscast",
]);

function toSignedValue(value: number, suffix: string) {
  const rounded = Math.round(value);
  const sign = rounded >= 0 ? "+" : "";
  return `${sign}${rounded}${suffix}`;
}

function normalizeRate(rate: string | undefined) {
  const parsed = Number.parseFloat(rate ?? "");
  if (!Number.isFinite(parsed)) {
    return "+0%";
  }

  return toSignedValue((parsed - 1) * 100, "%");
}

function normalizePitch(pitch: string | undefined) {
  const parsed = Number.parseFloat(pitch ?? "");
  if (!Number.isFinite(parsed)) {
    return "+0Hz";
  }

  return toSignedValue(parsed, "Hz");
}

function normalizeStyle(style: string | undefined) {
  const candidate = style?.trim().toLowerCase();
  if (!candidate || !SUPPORTED_STYLES.has(candidate)) {
    return DEFAULT_STYLE;
  }

  return candidate;
}

export function normalizeTtsParams(
  input: NormalizeTtsParamsInput,
): NormalizedTtsParams {
  return {
    rate: normalizeRate(input.rate),
    pitch: normalizePitch(input.pitch),
    style: normalizeStyle(input.style),
  };
}

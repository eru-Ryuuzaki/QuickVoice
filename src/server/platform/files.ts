import { AppError } from "@/server/platform/errors";
import {
  isSupportedAudioFileName,
  isSupportedAudioMimeType,
  isSupportedTextFileName,
  isTextMimeType,
} from "@/server/platform/mime";

export type UploadFileMeta = {
  name: string;
  type: string;
  size: number;
};

const MAX_TEXT_UPLOAD_BYTES = 256 * 1024;
const MAX_AUDIO_UPLOAD_BYTES = 25 * 1024 * 1024;

function throwValidation(message: string) {
  throw new AppError("VALIDATION_ERROR", `VALIDATION_ERROR: ${message}`);
}

function isUploadMeta(value: unknown): value is UploadFileMeta {
  if (!value || typeof value !== "object") {
    return false;
  }

  const input = value as Record<string, unknown>;
  return (
    typeof input.name === "string" &&
    typeof input.type === "string" &&
    typeof input.size === "number"
  );
}

function ensureUploadMeta(file: unknown, param: string): UploadFileMeta {
  if (!isUploadMeta(file)) {
    throwValidation(`${param} is required`);
  }

  const upload = file as UploadFileMeta;
  const normalized: UploadFileMeta = {
    name: upload.name.trim(),
    type: upload.type.trim().toLowerCase(),
    size: upload.size,
  };

  if (!normalized.name) {
    throwValidation(`${param} has no name`);
  }

  if (!Number.isFinite(normalized.size) || normalized.size <= 0) {
    throwValidation(`${param} has invalid size`);
  }

  return normalized;
}

export function assertTextUpload(file: unknown) {
  const normalized = ensureUploadMeta(file, "file");

  if (normalized.size > MAX_TEXT_UPLOAD_BYTES) {
    throwValidation(
      `text upload exceeds ${MAX_TEXT_UPLOAD_BYTES} bytes limit (${normalized.size})`,
    );
  }

  if (
    !isTextMimeType(normalized.type) &&
    !isSupportedTextFileName(normalized.name)
  ) {
    throwValidation("text upload must be a .txt file");
  }

  return normalized;
}

export function assertAudioUpload(file: unknown) {
  const normalized = ensureUploadMeta(file, "audio");

  if (normalized.size > MAX_AUDIO_UPLOAD_BYTES) {
    throwValidation(
      `audio upload exceeds ${MAX_AUDIO_UPLOAD_BYTES} bytes limit (${normalized.size})`,
    );
  }

  if (
    !isSupportedAudioMimeType(normalized.type) &&
    !isSupportedAudioFileName(normalized.name)
  ) {
    throwValidation("audio upload format is not supported");
  }

  return normalized;
}

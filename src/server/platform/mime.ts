const TEXT_EXTENSIONS = new Set(["txt"]);

const AUDIO_EXTENSIONS = new Set([
  "mp3",
  "wav",
  "m4a",
  "ogg",
  "webm",
  "flac",
  "aac",
]);

const AUDIO_MIME_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/x-m4a",
  "audio/ogg",
  "audio/webm",
  "audio/flac",
  "audio/aac",
]);

function getExtension(fileName: string) {
  const trimmed = fileName.trim();
  const separatorIndex = trimmed.lastIndexOf(".");
  if (separatorIndex <= 0 || separatorIndex === trimmed.length - 1) {
    return "";
  }

  return trimmed.slice(separatorIndex + 1).toLowerCase();
}

export function isTextMimeType(mimeType: string) {
  return mimeType.toLowerCase().startsWith("text/");
}

export function isSupportedTextFileName(fileName: string) {
  return TEXT_EXTENSIONS.has(getExtension(fileName));
}

export function isSupportedAudioMimeType(mimeType: string) {
  return AUDIO_MIME_TYPES.has(mimeType.toLowerCase());
}

export function isSupportedAudioFileName(fileName: string) {
  return AUDIO_EXTENSIONS.has(getExtension(fileName));
}

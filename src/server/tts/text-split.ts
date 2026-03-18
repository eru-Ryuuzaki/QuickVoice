const DEFAULT_CHUNK_LENGTH = 1500;

function toSafeChunkLength(value: number) {
  if (!Number.isFinite(value)) {
    return DEFAULT_CHUNK_LENGTH;
  }

  const rounded = Math.floor(value);
  return rounded > 0 ? rounded : DEFAULT_CHUNK_LENGTH;
}

export function splitTextForTts(text: string, maxChunkLength: number) {
  const safeChunkLength = toSafeChunkLength(maxChunkLength);
  if (text.length <= safeChunkLength) {
    return [text];
  }

  const chunks: string[] = [];

  for (let index = 0; index < text.length; index += safeChunkLength) {
    chunks.push(text.slice(index, index + safeChunkLength));
  }

  return chunks;
}

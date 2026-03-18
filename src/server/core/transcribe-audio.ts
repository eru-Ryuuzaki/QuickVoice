import { assertAudioUpload } from "@/server/platform/files";
import { AppError } from "@/server/platform/errors";
import type {
  SttProvider,
  SttTranscribeResult,
} from "@/server/providers/types";

type TranscribeAudioInput = {
  file: File;
};

type TranscribeAudioDeps = {
  provider: SttProvider;
  enabled: boolean;
};

export async function transcribeAudio(
  input: TranscribeAudioInput,
  deps: TranscribeAudioDeps,
): Promise<SttTranscribeResult> {
  if (!deps.enabled) {
    throw new AppError(
      "PROVIDER_UNAVAILABLE",
      "PROVIDER_UNAVAILABLE: stt is disabled",
      { status: 503 },
    );
  }

  assertAudioUpload(input.file);
  return deps.provider.transcribe({ file: input.file });
}

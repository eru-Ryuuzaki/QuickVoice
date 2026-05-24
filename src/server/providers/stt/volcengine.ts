import { randomUUID } from "node:crypto";

import { loadConfig } from "@/server/platform/env";
import { AppError } from "@/server/platform/errors";
import type {
  SttJobStatus,
  SttProvider,
  SttSubmitUrlInput,
  SttSubmitResult,
  SttTranscribeInput,
} from "@/server/providers/types";
import { createCosS3AudioStorage } from "@/server/storage/cos-s3";
import type { AudioObjectStorage } from "@/server/storage/audio-object-storage";

type VolcengineSttOptions = {
  apiKey?: string;
  resourceId?: string;
  submitEndpoint?: string;
  queryEndpoint?: string;
  storage?: AudioObjectStorage;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  maxPollAttempts?: number;
  pollIntervalMs?: number;
};

type VolcenginePayload = {
  result?: { text?: string };
  text?: string;
};

const DEFAULT_MAX_POLL_ATTEMPTS = 120;
const DEFAULT_POLL_INTERVAL_MS = 5000;
const VOLCENGINE_STATUS_SUCCESS = "20000000";
const VOLCENGINE_STATUS_PROCESSING = "20000001";
const VOLCENGINE_STATUS_QUEUED = "20000002";
const VOLCENGINE_PENDING_STATUSES = new Set([
  VOLCENGINE_STATUS_PROCESSING,
  VOLCENGINE_STATUS_QUEUED,
]);

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

function getDefaults() {
  const config = loadConfig();
  return {
    apiKey: config.volcengineSttApiKey,
    resourceId: config.volcengineSttModel,
    submitEndpoint: config.volcengineSttEndpoint,
  };
}

function deriveQueryEndpoint(submitEndpoint: string) {
  return submitEndpoint.replace(/\/submit$/, "/query");
}

function encodeJobId(value: {
  requestId: string;
  resourceId: string;
  queryEndpoint: string;
}) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decodeJobId(jobId: string) {
  try {
    const parsed = JSON.parse(
      Buffer.from(jobId, "base64url").toString("utf8"),
    ) as Partial<{
      requestId: string;
      resourceId: string;
      queryEndpoint: string;
    }>;

    if (!parsed.requestId || !parsed.resourceId || !parsed.queryEndpoint) {
      return null;
    }

    return {
      requestId: parsed.requestId,
      resourceId: parsed.resourceId,
      queryEndpoint: parsed.queryEndpoint,
    };
  } catch {
    return null;
  }
}

async function readJsonPayload(response: Response): Promise<VolcenginePayload> {
  try {
    return (await response.json()) as VolcenginePayload;
  } catch {
    return {};
  }
}

async function throwResponseError(response: Response) {
  const body = await response.text();
  const code = response.status === 429 ? "RATE_LIMITED" : "PROVIDER_UNAVAILABLE";
  const message = body
    ? `PROVIDER_UNAVAILABLE: Volcengine STT returned ${response.status} ${body.slice(0, 180)}`
    : `PROVIDER_UNAVAILABLE: Volcengine STT returned ${response.status}`;
  throw new AppError(code, message, {
    status: response.status === 429 ? 429 : 503,
    details: body,
  });
}

function getTaskStatus(response: Response) {
  const statusCode = response.headers.get("X-Api-Status-Code")?.trim() || "";
  const statusMessage = response.headers.get("X-Api-Message")?.trim() || "";
  return { statusCode, statusMessage };
}

function throwTaskStatusError(
  statusCode: string,
  statusMessage: string,
): never {
  const message = statusMessage
    ? `PROVIDER_UNAVAILABLE: Volcengine STT task failed (${statusCode}) ${statusMessage}`
    : `PROVIDER_UNAVAILABLE: Volcengine STT task failed (${statusCode})`;
  throw new AppError("PROVIDER_UNAVAILABLE", message, {
    status: 503,
    details: { statusCode, statusMessage },
  });
}

function getTranscriptText(payload: VolcenginePayload) {
  const transcript = payload.result?.text ?? payload.text;
  if (transcript == null) {
    return undefined;
  }

  return transcript.trim();
}

function getAudioFormat(audioUrl: string) {
  try {
    const extension = new URL(audioUrl).pathname
      .split("/")
      .pop()
      ?.split(".")
      .pop()
      ?.toLowerCase();

    return extension || "mp3";
  } catch {
    return "mp3";
  }
}

function isSubmitUrlInput(
  input: SttTranscribeInput | SttSubmitUrlInput,
): input is SttSubmitUrlInput {
  return "audioUrl" in input;
}

export function createVolcengineSttProvider(
  options: VolcengineSttOptions = {},
): SttProvider {
  const defaults = getDefaults();
  const apiKey = options.apiKey ?? defaults.apiKey;
  const resourceId = options.resourceId ?? defaults.resourceId;
  const submitEndpoint = options.submitEndpoint ?? defaults.submitEndpoint;
  const queryEndpoint =
    options.queryEndpoint ?? deriveQueryEndpoint(submitEndpoint);
  const storage = options.storage ?? createCosS3AudioStorage();
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const maxPollAttempts = options.maxPollAttempts ?? DEFAULT_MAX_POLL_ATTEMPTS;
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;

  const provider: SttProvider = {
    id: "volcengine",
    label: "Volcengine",
    async submit(
      input: SttTranscribeInput | SttSubmitUrlInput,
    ): Promise<SttSubmitResult> {
      if (!apiKey) {
        throw new AppError(
          "PROVIDER_UNAVAILABLE",
          "PROVIDER_UNAVAILABLE: Volcengine STT is not configured",
          { status: 503 },
        );
      }

      const requestResourceId = input.model.trim() || resourceId;
      const requestId = randomUUID();
      const audioUrl = isSubmitUrlInput(input)
        ? input.audioUrl
        : (await storage.uploadAudio(input.file)).url;

      const submitResponse = await fetchImpl(submitEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": apiKey,
          "X-Api-Resource-Id": requestResourceId,
          "X-Api-Request-Id": requestId,
          "X-Api-Sequence": "-1",
        },
        body: JSON.stringify({
          user: {
            uid: apiKey,
          },
          audio: {
            url: audioUrl,
            format: getAudioFormat(audioUrl),
          },
          request: {
            model_name: "bigmodel",
          },
        }),
      });

      if (!submitResponse.ok) {
        await throwResponseError(submitResponse);
      }
      const submitStatus = getTaskStatus(submitResponse);
      if (
        submitStatus.statusCode &&
        submitStatus.statusCode !== VOLCENGINE_STATUS_SUCCESS &&
        !VOLCENGINE_PENDING_STATUSES.has(submitStatus.statusCode)
      ) {
        throwTaskStatusError(
          submitStatus.statusCode,
          submitStatus.statusMessage,
        );
      }

      return {
        jobId: encodeJobId({
          requestId,
          resourceId: requestResourceId,
          queryEndpoint,
        }),
        provider: "volcengine",
      };
    },
    async query(jobId: string): Promise<SttJobStatus> {
      if (!apiKey) {
        throw new AppError(
          "PROVIDER_UNAVAILABLE",
          "PROVIDER_UNAVAILABLE: Volcengine STT is not configured",
          { status: 503 },
        );
      }

      const job = decodeJobId(jobId);
      if (!job) {
        throw new AppError(
          "VALIDATION_ERROR",
          "VALIDATION_ERROR: invalid Volcengine STT job id",
          { status: 400 },
        );
      }

      const queryResponse = await fetchImpl(job.queryEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": apiKey,
          "X-Api-Resource-Id": job.resourceId,
          "X-Api-Request-Id": job.requestId,
          "X-Api-Sequence": "-1",
        },
        body: JSON.stringify({}),
      });

      if (!queryResponse.ok) {
        await throwResponseError(queryResponse);
      }
      const queryStatus = getTaskStatus(queryResponse);
      if (queryStatus.statusCode === VOLCENGINE_STATUS_PROCESSING) {
        return { status: "processing" };
      }
      if (queryStatus.statusCode === VOLCENGINE_STATUS_QUEUED) {
        return { status: "queued" };
      }
      if (
        queryStatus.statusCode &&
        queryStatus.statusCode !== VOLCENGINE_STATUS_SUCCESS
      ) {
        throwTaskStatusError(
          queryStatus.statusCode,
          queryStatus.statusMessage,
        );
      }

      const payload = await readJsonPayload(queryResponse);
      const text = getTranscriptText(payload);
      if (text) {
        return { status: "completed", text, raw: payload };
      }

      if (queryStatus.statusCode === VOLCENGINE_STATUS_SUCCESS) {
        throw new AppError(
          "PROCESSING_FAILED",
          "PROCESSING_FAILED: empty transcription result from Volcengine",
          { status: 502, details: payload },
        );
      }

      return { status: "processing" };
    },
    async transcribe(input) {
      const submitted = await provider.submit?.(input);
      if (!submitted || !provider.query) {
        throw new AppError(
          "PROCESSING_FAILED",
          "PROCESSING_FAILED: Volcengine STT submit is unavailable",
          { status: 502 },
        );
      }

      let lastPayload: VolcenginePayload = {};
      let lastTaskStatus = "";
      for (let attempt = 0; attempt < maxPollAttempts; attempt++) {
        if (attempt > 0) {
          await sleep(pollIntervalMs);
        }

        const status = await provider.query(submitted.jobId);
        if (status.status === "queued" || status.status === "processing") {
          lastTaskStatus =
            status.status === "queued"
              ? VOLCENGINE_STATUS_QUEUED
              : VOLCENGINE_STATUS_PROCESSING;
          continue;
        }

        if (status.status === "completed") {
          lastPayload = (status.raw ?? {}) as VolcenginePayload;
          return { text: status.text, raw: status.raw };
        }
      }

      if (VOLCENGINE_PENDING_STATUSES.has(lastTaskStatus)) {
        throw new AppError(
          "PROCESSING_FAILED",
          "PROCESSING_FAILED: Volcengine STT timed out while processing audio",
          { status: 504, details: { statusCode: lastTaskStatus } },
        );
      }

      throw new AppError(
        "PROCESSING_FAILED",
        "PROCESSING_FAILED: empty transcription result from Volcengine",
        { status: 502, details: lastPayload },
      );
    },
  };

  return provider;
}

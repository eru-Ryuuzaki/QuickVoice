import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { loadConfig, type AppConfig } from "@/server/platform/env";
import { AppError } from "@/server/platform/errors";
import type {
  AudioObjectStorage,
  AudioUploadObjectMeta,
} from "@/server/storage/audio-object-storage";

type CosS3AudioStorageOptions = {
  config?: Pick<
    AppConfig,
    | "cosSecretId"
    | "cosSecretKey"
    | "cosEndpoint"
    | "cosPublicBaseUrl"
    | "cosSttPrefix"
    | "cosSttUrlTtlSeconds"
    | "cosConfigured"
  >;
  createKey?: (file: AudioUploadObjectMeta) => string;
  putObject?: (input: PutObjectCommandInput) => Promise<unknown>;
  createPresignedUrl?: (key: string) => Promise<string>;
  createPresignedPutUrl?: (
    key: string,
    contentType: string,
  ) => Promise<string>;
};

function getExtension(fileName: string) {
  const extension = path.extname(fileName).replace(/^\./, "").toLowerCase();
  return extension || "bin";
}

function toAudioObjectMeta(file: File): AudioUploadObjectMeta {
  return {
    name: file.name,
    type: file.type,
  };
}

function encodeObjectKey(key: string) {
  return key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function parseCosEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint);
    const [bucket, marker, region] = url.hostname.split(".");
    if (!bucket || marker !== "cos" || !region) {
      return { bucket: "", region: "auto" };
    }

    return {
      bucket,
      region,
      serviceEndpoint: `${url.protocol}//cos.${region}.myqcloud.com`,
    };
  } catch {
    return { bucket: "", region: "auto", serviceEndpoint: endpoint };
  }
}

async function readFileBuffer(file: File) {
  if (typeof file.arrayBuffer === "function") {
    return Buffer.from(await file.arrayBuffer());
  }

  return Buffer.from(await file.text());
}

export function createCosS3AudioStorage(
  options: CosS3AudioStorageOptions = {},
): AudioObjectStorage {
  const config = options.config ?? loadConfig();
  const cosEndpoint = parseCosEndpoint(config.cosEndpoint);
  let client: S3Client | undefined;
  const getClient = () => {
    client ??= new S3Client({
      region: cosEndpoint.region,
      endpoint: cosEndpoint.serviceEndpoint,
      forcePathStyle: false,
      credentials: {
        accessKeyId: config.cosSecretId,
        secretAccessKey: config.cosSecretKey,
      },
    });
    return client;
  };
  const putObject =
    options.putObject ??
    ((input: PutObjectCommandInput) =>
      getClient().send(new PutObjectCommand(input)));
  const createPresignedUrl =
    options.createPresignedUrl ??
    ((key: string) =>
      getSignedUrl(
        getClient(),
        new GetObjectCommand({
          Bucket: cosEndpoint.bucket,
          Key: key,
        }),
        { expiresIn: config.cosSttUrlTtlSeconds },
      ));
  const createPresignedPutUrl =
    options.createPresignedPutUrl ??
    ((key: string, contentType: string) =>
      getSignedUrl(
        getClient(),
        new PutObjectCommand({
          Bucket: cosEndpoint.bucket,
          Key: key,
          ContentType: contentType,
        }),
        { expiresIn: config.cosSttUrlTtlSeconds },
      ));
  const createKey =
    options.createKey ??
    ((file: AudioUploadObjectMeta) =>
      `${config.cosSttPrefix}/${randomUUID()}.${getExtension(file.name)}`);

  return {
    async createUploadUrl(file) {
      if (!config.cosConfigured) {
        throw new AppError(
          "PROVIDER_UNAVAILABLE",
          "COS object storage is not configured.",
          { status: 503 },
        );
      }

      const key = createKey(file);
      const uploadUrl = await createPresignedPutUrl(
        key,
        file.type || "application/octet-stream",
      );
      const url = config.cosPublicBaseUrl
        ? `${config.cosPublicBaseUrl}/${encodeObjectKey(key)}`
        : await createPresignedUrl(key);

      return { key, uploadUrl, url };
    },
    async uploadAudio(file) {
      if (!config.cosConfigured) {
        throw new AppError(
          "PROVIDER_UNAVAILABLE",
          "COS object storage is not configured.",
          { status: 503 },
        );
      }

      const fileMeta = toAudioObjectMeta(file);
      const key = createKey(fileMeta);
      await putObject({
        Bucket: cosEndpoint.bucket,
        Key: key,
        Body: await readFileBuffer(file),
        ContentType: fileMeta.type || "application/octet-stream",
      });

      if (config.cosPublicBaseUrl) {
        return {
          key,
          url: `${config.cosPublicBaseUrl}/${encodeObjectKey(key)}`,
        };
      }

      return {
        key,
        url: await createPresignedUrl(key),
      };
    },
  };
}

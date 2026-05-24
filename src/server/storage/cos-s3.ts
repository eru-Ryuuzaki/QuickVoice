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
import type { AudioObjectStorage } from "@/server/storage/audio-object-storage";

type CosS3AudioStorageOptions = {
  config?: Pick<
    AppConfig,
    | "cosSecretId"
    | "cosSecretKey"
    | "cosBucket"
    | "cosRegion"
    | "cosPublicBaseUrl"
    | "cosSttPrefix"
    | "cosSttUrlTtlSeconds"
    | "cosConfigured"
  >;
  createKey?: (file: File) => string;
  putObject?: (input: PutObjectCommandInput) => Promise<unknown>;
  createPresignedUrl?: (key: string) => Promise<string>;
};

function getExtension(fileName: string) {
  const extension = path.extname(fileName).replace(/^\./, "").toLowerCase();
  return extension || "bin";
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
  let client: S3Client | undefined;
  const getClient = () => {
    client ??= new S3Client({
      region: config.cosRegion,
      endpoint: `https://cos.${config.cosRegion}.myqcloud.com`,
      forcePathStyle: true,
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
          Bucket: config.cosBucket,
          Key: key,
        }),
        { expiresIn: config.cosSttUrlTtlSeconds },
      ));
  const createKey =
    options.createKey ??
    ((file: File) =>
      `${config.cosSttPrefix}/${randomUUID()}.${getExtension(file.name)}`);

  return {
    async uploadAudio(file) {
      if (!config.cosConfigured) {
        throw new AppError(
          "PROVIDER_UNAVAILABLE",
          "COS object storage is not configured.",
          { status: 503 },
        );
      }

      const key = createKey(file);
      await putObject({
        Bucket: config.cosBucket,
        Key: key,
        Body: await readFileBuffer(file),
        ContentType: file.type || "application/octet-stream",
      });

      if (config.cosPublicBaseUrl) {
        return {
          key,
          url: `${config.cosPublicBaseUrl}/${encodeURI(key)}`,
        };
      }

      return {
        key,
        url: await createPresignedUrl(key),
      };
    },
  };
}

import { createCosS3AudioStorage } from "@/server/storage/cos-s3";
import { AppError } from "@/server/platform/errors";

function createAudioFile(name = "voice.mp3") {
  const bytes = new Uint8Array([1, 2, 3]);
  const file = new File([bytes], name, { type: "audio/mpeg" });
  Object.defineProperty(file, "arrayBuffer", {
    value: async () =>
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  });
  return file;
}

test("uploads audio to COS and returns a public base URL when configured", async () => {
  const putObject = vi.fn(async () => undefined);
  const storage = createCosS3AudioStorage({
    config: {
      cosSecretId: "secret-id",
      cosSecretKey: "secret-key",
      cosEndpoint: "https://quickvoice-1250000000.cos.ap-shanghai.myqcloud.com",
      cosPublicBaseUrl: "https://cdn.example.test/audio",
      cosSttPrefix: "quickvoice/stt",
      cosSttUrlTtlSeconds: 3600,
      cosConfigured: true,
    },
    createKey: () => "quickvoice/stt/audio-id.mp3",
    putObject,
  });

  const result = await storage.uploadAudio(createAudioFile());

  expect(result).toEqual({
    key: "quickvoice/stt/audio-id.mp3",
    url: "https://cdn.example.test/audio/quickvoice/stt/audio-id.mp3",
  });
  expect(putObject).toHaveBeenCalledWith(
    expect.objectContaining({
      Bucket: "quickvoice-1250000000",
      Key: "quickvoice/stt/audio-id.mp3",
      Body: Buffer.from([1, 2, 3]),
      ContentType: "audio/mpeg",
    }),
  );
});

test("encodes public URL object key path segments", async () => {
  const storage = createCosS3AudioStorage({
    config: {
      cosSecretId: "secret-id",
      cosSecretKey: "secret-key",
      cosEndpoint: "https://quickvoice-1250000000.cos.ap-shanghai.myqcloud.com",
      cosPublicBaseUrl: "https://cdn.example.test/audio",
      cosSttPrefix: "quickvoice/stt",
      cosSttUrlTtlSeconds: 3600,
      cosConfigured: true,
    },
    createKey: () => "quickvoice/stt/folder name/audio?#.mp3",
    putObject: vi.fn(async () => undefined),
  });

  const result = await storage.uploadAudio(createAudioFile());

  expect(result.url).toBe(
    "https://cdn.example.test/audio/quickvoice/stt/folder%20name/audio%3F%23.mp3",
  );
});

test("falls back to a presigned URL when no public base URL is configured", async () => {
  const storage = createCosS3AudioStorage({
    config: {
      cosSecretId: "secret-id",
      cosSecretKey: "secret-key",
      cosEndpoint: "https://quickvoice-1250000000.cos.ap-shanghai.myqcloud.com",
      cosPublicBaseUrl: "",
      cosSttPrefix: "quickvoice/stt",
      cosSttUrlTtlSeconds: 900,
      cosConfigured: true,
    },
    createKey: () => "quickvoice/stt/audio-id.wav",
    putObject: vi.fn(async () => undefined),
    createPresignedUrl: vi.fn(
      async () => "https://signed.example.test/audio-id.wav",
    ),
  });

  const result = await storage.uploadAudio(createAudioFile("voice.wav"));

  expect(result).toEqual({
    key: "quickvoice/stt/audio-id.wav",
    url: "https://signed.example.test/audio-id.wav",
  });
});

test("creates browser upload and provider read URLs", async () => {
  const storage = createCosS3AudioStorage({
    config: {
      cosSecretId: "secret-id",
      cosSecretKey: "secret-key",
      cosEndpoint: "https://quickvoice-1250000000.cos.ap-shanghai.myqcloud.com",
      cosPublicBaseUrl: "",
      cosSttPrefix: "quickvoice/stt",
      cosSttUrlTtlSeconds: 900,
      cosConfigured: true,
    },
    createKey: () => "quickvoice/stt/audio-id.mp3",
    createPresignedPutUrl: vi.fn(
      async () => "https://signed.example.test/upload-audio-id.mp3",
    ),
    createPresignedUrl: vi.fn(
      async () => "https://signed.example.test/read-audio-id.mp3",
    ),
  });

  const result = await storage.createUploadUrl?.(createAudioFile());

  expect(result).toEqual({
    key: "quickvoice/stt/audio-id.mp3",
    uploadUrl: "https://signed.example.test/upload-audio-id.mp3",
    url: "https://signed.example.test/read-audio-id.mp3",
  });
});

test("creates presigned URLs without duplicating the bucket path", async () => {
  const storage = createCosS3AudioStorage({
    config: {
      cosSecretId: "secret-id",
      cosSecretKey: "secret-key",
      cosEndpoint: "https://cos-1306784314.cos.ap-chengdu.myqcloud.com",
      cosPublicBaseUrl: "",
      cosSttPrefix: "quickvoice/stt",
      cosSttUrlTtlSeconds: 900,
      cosConfigured: true,
    },
    createKey: () => "quickvoice/stt/audio-id.wav",
    putObject: vi.fn(async () => undefined),
  });

  const result = await storage.uploadAudio(createAudioFile("voice.wav"));

  expect(new URL(result.url).origin).toBe(
    "https://cos-1306784314.cos.ap-chengdu.myqcloud.com",
  );
  expect(new URL(result.url).pathname).toBe("/quickvoice/stt/audio-id.wav");
});

test("rejects uploads when COS is not configured", async () => {
  const storage = createCosS3AudioStorage({
    config: {
      cosSecretId: "",
      cosSecretKey: "",
      cosEndpoint: "",
      cosPublicBaseUrl: "",
      cosSttPrefix: "quickvoice/stt",
      cosSttUrlTtlSeconds: 3600,
      cosConfigured: false,
    },
    putObject: vi.fn(async () => undefined),
  });

  await expect(storage.uploadAudio(createAudioFile())).rejects.toMatchObject({
    code: "PROVIDER_UNAVAILABLE",
  } satisfies Partial<AppError>);
});

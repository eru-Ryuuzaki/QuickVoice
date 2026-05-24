export type AudioUploadResult = {
  url: string;
  key: string;
};

export type AudioUploadUrlResult = AudioUploadResult & {
  uploadUrl: string;
};

export type AudioUploadObjectMeta = {
  name: string;
  type: string;
};

export type AudioObjectStorage = {
  uploadAudio: (file: File) => Promise<AudioUploadResult>;
  createUploadUrl?: (
    file: AudioUploadObjectMeta,
  ) => Promise<AudioUploadUrlResult>;
};

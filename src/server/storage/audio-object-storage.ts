export type AudioUploadResult = {
  url: string;
  key: string;
};

export type AudioObjectStorage = {
  uploadAudio: (file: File) => Promise<AudioUploadResult>;
};

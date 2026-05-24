import { assertAudioUpload, assertTextUpload } from "@/server/platform/files";

test("rejects unsupported audio uploads", () => {
  expect(() =>
    assertAudioUpload({
      name: "bad.exe",
      type: "application/octet-stream",
      size: 10,
    }),
  ).toThrow("VALIDATION_ERROR");
});

test("accepts COS-backed audio uploads above the old 25MB limit", () => {
  expect(() =>
    assertAudioUpload({
      name: "meeting.mp3",
      type: "audio/mpeg",
      size: 27_048_256,
    }),
  ).not.toThrow();
});

test("accepts COS-backed audio uploads up to the 1GB limit", () => {
  expect(() =>
    assertAudioUpload({
      name: "long-meeting.mp3",
      type: "audio/mpeg",
      size: 1024 * 1024 * 1024,
    }),
  ).not.toThrow();
});

test("rejects audio uploads above the 1GB limit", () => {
  expect(() =>
    assertAudioUpload({
      name: "huge.mp3",
      type: "audio/mpeg",
      size: 1024 * 1024 * 1024 + 1,
    }),
  ).toThrow("VALIDATION_ERROR");
});

test("accepts valid txt uploads", () => {
  expect(() =>
    assertTextUpload({
      name: "script.txt",
      type: "text/plain",
      size: 1024,
    }),
  ).not.toThrow();
});

test("rejects oversized txt uploads", () => {
  expect(() =>
    assertTextUpload({
      name: "large.txt",
      type: "text/plain",
      size: 300 * 1024,
    }),
  ).toThrow("VALIDATION_ERROR");
});

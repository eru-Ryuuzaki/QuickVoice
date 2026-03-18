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

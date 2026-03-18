import { splitTextForTts } from "@/server/tts/text-split";

test("splits long text into provider-safe chunks", () => {
  const text = "A".repeat(3200);
  const chunks = splitTextForTts(text, 1500);

  expect(chunks.length).toBeGreaterThan(1);
  expect(chunks.every((chunk) => chunk.length <= 1500)).toBe(true);
  expect(chunks.join("")).toBe(text);
});

test("returns one chunk for short text", () => {
  const text = "hello quickvoice";
  const chunks = splitTextForTts(text, 1500);

  expect(chunks).toEqual([text]);
});

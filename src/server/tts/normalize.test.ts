import { normalizeTtsParams } from "@/server/tts/normalize";

test("normalizes rate and pitch from UI values", () => {
  const result = normalizeTtsParams({
    rate: "1.2",
    pitch: "8",
    style: "general",
  });

  expect(result.rate).toBe("+20%");
  expect(result.pitch).toBe("+8Hz");
  expect(result.style).toBe("general");
});

test("falls back to defaults on invalid values", () => {
  const result = normalizeTtsParams({
    rate: "invalid",
    pitch: "NaN",
    style: "",
  });

  expect(result.rate).toBe("+0%");
  expect(result.pitch).toBe("+0Hz");
  expect(result.style).toBe("general");
});

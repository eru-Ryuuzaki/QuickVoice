import { createRateLimiter } from "@/server/platform/rate-limit";

test("limits repeated anonymous STT requests by IP", () => {
  const limiter = createRateLimiter({ max: 1, windowMs: 60_000 });

  expect(limiter.consume("127.0.0.1").allowed).toBe(true);
  expect(limiter.consume("127.0.0.1").allowed).toBe(false);
});

test("resets quota once the window expires", () => {
  let now = 1_000;
  const limiter = createRateLimiter({
    max: 1,
    windowMs: 1_000,
    now: () => now,
  });

  expect(limiter.consume("127.0.0.1").allowed).toBe(true);
  expect(limiter.consume("127.0.0.1").allowed).toBe(false);

  now += 1_001;
  expect(limiter.consume("127.0.0.1").allowed).toBe(true);
});

import { createProviderRegistry } from "@/server/providers/provider-registry";

test("marks STT unavailable when public exposure is disabled", async () => {
  const registry = createProviderRegistry({
    ENABLE_STT: "true",
    ENABLE_PUBLIC_STT: "false",
  });

  const status = await registry.getPublicStatus();

  expect(status.tts.available).toBe(true);
  expect(status.stt.available).toBe(false);
  expect(status.stt.reason).toBe("disabled");
});

test("reports STT as unavailable when STT feature is turned off", async () => {
  const registry = createProviderRegistry({
    ENABLE_STT: "false",
    ENABLE_PUBLIC_STT: "true",
  });

  const status = await registry.getPublicStatus();

  expect(status.stt.available).toBe(false);
  expect(status.stt.reason).toBe("disabled");
});

import { GET } from "@/app/api/health/route";

test("returns health status payload", async () => {
  const response = await GET();
  const payload = await response.json();

  expect(response.status).toBe(200);
  expect(payload.ok).toBe(true);
  expect(typeof payload.timestamp).toBe("string");
});

import { GET } from "@/app/api/voices/route";

test("returns grouped voices for the frontend", async () => {
  const response = await GET();
  const payload = await response.json();

  expect(response.status).toBe(200);
  expect(Array.isArray(payload.groups)).toBe(true);
  expect(payload.groups.length).toBeGreaterThan(0);
  expect(payload.groups[0]).toHaveProperty("id");
  expect(payload.groups[0]).toHaveProperty("voices");
});

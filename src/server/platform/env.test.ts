import { loadConfig } from "@/server/platform/env";

test("falls back to default siliconflow token when env value is blank", () => {
  const config = loadConfig({
    SILICONFLOW_API_KEY: "   ",
  });

  expect(config.siliconflowApiKey).toBe(
    "sk-wtldsvuprmwltxpbspbmawtolbacghzawnjhtlzlnujjkfhh",
  );
});

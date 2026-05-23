import { render, screen, waitFor } from "@testing-library/react";

import HomePage from "@/app/page";

test("renders the QuickVoice workbench shell", async () => {
  const previousEnableSttVolcengine = process.env.ENABLE_STT_VOLCENGINE;
  const previousEnableSttVosk = process.env.ENABLE_STT_VOSK;
  const previousVolcengineAccessKeyId = process.env.VOLCENGINE_ACCESS_KEY_ID;
  const previousVolcengineSecretAccessKey = process.env.VOLCENGINE_SECRET_ACCESS_KEY;
  const previousVolcengineSttAppId = process.env.VOLCENGINE_STT_APP_ID;

  process.env.ENABLE_STT_VOLCENGINE = "true";
  process.env.ENABLE_STT_VOSK = "true";
  process.env.VOLCENGINE_ACCESS_KEY_ID = "ak";
  process.env.VOLCENGINE_SECRET_ACCESS_KEY = "sk";
  process.env.VOLCENGINE_STT_APP_ID = "app";
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ groups: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );

  try {
    const page = await HomePage();
    render(page);

    expect(screen.getByText("QuickVoice")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Text to Speech" }),
    ).toBeInTheDocument();
    expect(screen.getByText("STT: Volcengine")).toBeInTheDocument();
    expect(screen.queryByText("STT UNAVAILABLE")).toBeNull();
    expect(screen.queryByText("STT DEFAULT VOLCENGINE")).toBeNull();
    expect(screen.queryByText("VOSK CN UNAVAILABLE")).toBeNull();

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });
  } finally {
    process.env.ENABLE_STT_VOLCENGINE = previousEnableSttVolcengine;
    process.env.ENABLE_STT_VOSK = previousEnableSttVosk;
    process.env.VOLCENGINE_ACCESS_KEY_ID = previousVolcengineAccessKeyId;
    process.env.VOLCENGINE_SECRET_ACCESS_KEY = previousVolcengineSecretAccessKey;
    process.env.VOLCENGINE_STT_APP_ID = previousVolcengineSttAppId;
  }
});

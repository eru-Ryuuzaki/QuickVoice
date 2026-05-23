import { render, screen, waitFor } from "@testing-library/react";

import HomePage from "@/app/page";

test("renders the QuickVoice workbench shell", async () => {
  const previousEnableSttVolcengine = process.env.VOLCENGINE_STT_ENABLED;
  const previousEnableSttVosk = process.env.VOSK_STT_ENABLED;
  const previousVolcengineSttApiKey = process.env.VOLCENGINE_STT_API_KEY;

  process.env.VOLCENGINE_STT_ENABLED = "true";
  process.env.VOSK_STT_ENABLED = "true";
  process.env.VOLCENGINE_STT_API_KEY = "api-key";
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
    process.env.VOLCENGINE_STT_ENABLED = previousEnableSttVolcengine;
    process.env.VOSK_STT_ENABLED = previousEnableSttVosk;
    process.env.VOLCENGINE_STT_API_KEY = previousVolcengineSttApiKey;
  }
});

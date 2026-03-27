import { render, screen, waitFor } from "@testing-library/react";

import HomePage from "@/app/page";

test("renders the QuickVoice workbench shell", async () => {
  const previousEnableStt = process.env.ENABLE_STT;
  const previousEnablePublicStt = process.env.ENABLE_PUBLIC_STT;
  const previousEnableSttSiliconflow = process.env.ENABLE_STT_SILICONFLOW;
  const previousEnableSttVosk = process.env.ENABLE_STT_VOSK;

  process.env.ENABLE_STT = "true";
  process.env.ENABLE_PUBLIC_STT = "false";
  process.env.ENABLE_STT_SILICONFLOW = "true";
  process.env.ENABLE_STT_VOSK = "true";
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
    expect(screen.getByText("STT UNAVAILABLE")).toBeInTheDocument();
    expect(screen.getByText("DEFAULT SILICONFLOW")).toBeInTheDocument();
    expect(screen.getByText("VOSK CN UNAVAILABLE")).toBeInTheDocument();

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });
  } finally {
    process.env.ENABLE_STT = previousEnableStt;
    process.env.ENABLE_PUBLIC_STT = previousEnablePublicStt;
    process.env.ENABLE_STT_SILICONFLOW = previousEnableSttSiliconflow;
    process.env.ENABLE_STT_VOSK = previousEnableSttVosk;
  }
});

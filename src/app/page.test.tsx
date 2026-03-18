import { render, screen } from "@testing-library/react";

import HomePage from "@/app/page";

test("renders the QuickVoice workbench shell", async () => {
  const previousEnableStt = process.env.ENABLE_STT;
  const previousEnablePublicStt = process.env.ENABLE_PUBLIC_STT;
  process.env.ENABLE_STT = "true";
  process.env.ENABLE_PUBLIC_STT = "false";

  try {
    const page = await HomePage();
    render(page);

    expect(screen.getByText("QuickVoice")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "文字转语音" })).toBeInTheDocument();
    expect(screen.getByText("TTS AVAILABLE / STT UNAVAILABLE")).toBeInTheDocument();
  } finally {
    process.env.ENABLE_STT = previousEnableStt;
    process.env.ENABLE_PUBLIC_STT = previousEnablePublicStt;
  }
});

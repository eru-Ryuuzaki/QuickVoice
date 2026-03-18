import { render, screen, waitFor } from "@testing-library/react";

import { AppShell } from "@/components/app-shell";

test("renders top rail, activity rail, and two-pane work area", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ groups: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );

  render(
    <AppShell
      status={{
        tts: { available: true, provider: "microsoft_unofficial" },
        stt: { available: false, provider: "siliconflow", reason: "disabled" },
      }}
    />,
  );

  expect(screen.getByText("QuickVoice")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Text to Speech" })).toBeInTheDocument();
  expect(screen.getByText("Audio Output")).toBeInTheDocument();
  expect(screen.getByTestId("activity-rail")).toBeInTheDocument();

  await waitFor(() => {
    expect(fetch).toHaveBeenCalled();
  });
});

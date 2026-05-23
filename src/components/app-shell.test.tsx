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
        tts: {
          available: true,
          defaultProvider: "minimax",
          defaultModel: "speech-2.8-turbo",
          providers: [
            { id: "minimax", label: "MiniMax", available: true },
            {
              id: "microsoft_unofficial",
              label: "Microsoft Unofficial",
              available: true,
            },
          ],
        },
        stt: {
          available: true,
          defaultProvider: "volcengine",
          defaultModel: "volc.bigasr.auc_turbo",
          providers: [
            { id: "volcengine", label: "Volcengine", available: true },
            {
              id: "vosk",
              label: "Vosk CN",
              available: false,
              reason: "disabled",
            },
          ],
        },
        summary: {
          provider: "openai",
          available: true,
          defaultModel: "gpt-5.5",
        },
      }}
    />,
  );

  expect(screen.getByText("QuickVoice")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Text to Speech" })).toBeInTheDocument();
  expect(screen.getByText("Audio Output")).toBeInTheDocument();
  expect(screen.getByText("STT DEFAULT VOLCENGINE")).toBeInTheDocument();
  expect(screen.getByText("SUMMARY DEFAULT GPT-5.5")).toBeInTheDocument();
  expect(screen.getByTestId("activity-rail")).toBeInTheDocument();

  await waitFor(() => {
    expect(fetch).toHaveBeenCalled();
  });
});

import { render, screen } from "@testing-library/react";

import { SttPanel } from "@/components/stt/stt-panel";

test("keeps STT panel visible when all providers are unavailable", () => {
  render(
    <SttPanel
      sttStatus={{
        available: false,
        reason: "disabled",
        defaultProvider: "volcengine",
        providers: [
          {
            id: "volcengine",
            label: "Volcengine",
            available: false,
            reason: "disabled",
          },
          {
            id: "vosk",
            label: "Vosk CN",
            available: false,
            reason: "disabled",
          },
        ],
      }}
      onResultChange={() => {}}
    />,
  );

  expect(screen.getByText("Speech to Text")).toBeInTheDocument();
  expect(screen.getByText("Temporarily unavailable")).toBeInTheDocument();
  expect(screen.getByLabelText("STT Provider")).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "Start Transcription" }),
  ).toBeDisabled();
  expect(
    screen.queryByRole("button", { name: "Switch To TTS" }),
  ).not.toBeInTheDocument();
});

test("renders a provider selector with unavailable options disabled", () => {
  render(
    <SttPanel
      sttStatus={{
        available: true,
        defaultProvider: "vosk",
        providers: [
          {
            id: "volcengine",
            label: "Volcengine",
            available: false,
            reason: "disabled",
          },
          {
            id: "vosk",
            label: "Vosk CN",
            available: true,
          },
        ],
      }}
      onResultChange={() => {}}
    />,
  );

  expect(screen.getByLabelText("STT Provider")).toHaveValue("vosk");
  expect(screen.getByRole("option", { name: /Volcengine/ })).toBeDisabled();
  expect(screen.getByRole("option", { name: /Vosk CN/ })).not.toBeDisabled();
});

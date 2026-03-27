import { render, screen } from "@testing-library/react";

import { SttPanel } from "@/components/stt/stt-panel";

test("keeps STT panel visible when all providers are unavailable", () => {
  render(
    <SttPanel
      sttStatus={{
        available: false,
        reason: "disabled",
        defaultProvider: "siliconflow",
        providers: [
          {
            id: "siliconflow",
            label: "SiliconFlow",
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
      onSendToTts={() => {}}
    />,
  );

  expect(screen.getByText("Speech to Text")).toBeInTheDocument();
  expect(screen.getByText("Temporarily unavailable")).toBeInTheDocument();
  expect(screen.getByLabelText("STT Provider")).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "Start Transcription" }),
  ).toBeDisabled();
});

test("renders a provider selector with unavailable options disabled", () => {
  render(
    <SttPanel
      sttStatus={{
        available: true,
        defaultProvider: "vosk",
        providers: [
          {
            id: "siliconflow",
            label: "SiliconFlow",
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
      onSendToTts={() => {}}
    />,
  );

  expect(screen.getByLabelText("STT Provider")).toHaveValue("vosk");
  expect(screen.getByRole("option", { name: /SiliconFlow/ })).toBeDisabled();
  expect(screen.getByRole("option", { name: /Vosk CN/ })).not.toBeDisabled();
});

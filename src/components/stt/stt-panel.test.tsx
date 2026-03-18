import { render, screen } from "@testing-library/react";

import { SttPanel } from "@/components/stt/stt-panel";

test("keeps STT panel visible when provider is unavailable", () => {
  render(
    <SttPanel
      sttAvailable={false}
      onResultChange={() => {}}
      onSendToTts={() => {}}
    />,
  );

  expect(screen.getByText("Speech to Text")).toBeInTheDocument();
  expect(screen.getByText("Temporarily unavailable")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Start Transcription" }),
  ).toBeDisabled();
});

import { render, screen } from "@testing-library/react";

import { TranscriptionResult } from "@/components/stt/transcription-result";

test("does not show STT provider metadata in the transcript result", () => {
  render(
    <TranscriptionResult
      onTextChange={() => {}}
      result={{
        loading: false,
        error: null,
        text: "hello transcript",
        provider: "volcengine",
      }}
      sttAvailable={true}
    />,
  );

  expect(screen.getByLabelText("Transcript")).toHaveValue("hello transcript");
  expect(screen.queryByText("Provider: volcengine")).toBeNull();
});

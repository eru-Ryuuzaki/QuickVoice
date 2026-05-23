import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SttPanel } from "@/components/stt/stt-panel";

test("keeps STT panel visible when all providers are unavailable", () => {
  render(
    <SttPanel
      sttStatus={{
        available: false,
        reason: "disabled",
        defaultProvider: "volcengine",
        defaultModel: "volc.bigasr.auc_turbo",
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
        defaultModel: "volc.bigasr.auc_turbo",
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

test("persists manual STT model, submits it, and can clear the saved value", async () => {
  localStorage.setItem("quickvoice.stt.model", "saved-stt-model");
  const user = userEvent.setup();
  const fetchMock = vi.fn(async () =>
    new Response(JSON.stringify({ text: "hello", provider: "volcengine" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);

  render(
    <SttPanel
      sttStatus={{
        available: true,
        defaultProvider: "volcengine",
        defaultModel: "volc.bigasr.auc_turbo",
        providers: [
          { id: "volcengine", label: "Volcengine", available: true },
          { id: "vosk", label: "Vosk CN", available: true },
        ],
      }}
      onResultChange={() => {}}
    />,
  );

  const modelInput = screen.getByLabelText("STT Model");
  expect(modelInput).toHaveValue("saved-stt-model");

  await user.clear(modelInput);
  await user.type(modelInput, "custom-stt-model");
  expect(localStorage.getItem("quickvoice.stt.model")).toBe("custom-stt-model");

  const fileInput = screen.getByLabelText("Audio File");
  await user.upload(
    fileInput,
    new File([new Uint8Array([1, 2, 3])], "voice.mp3", {
      type: "audio/mpeg",
    }),
  );
  await user.click(screen.getByRole("button", { name: "Start Transcription" }));

  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalled();
  });

  const [, requestOptions] = fetchMock.mock.calls[0] ?? [];
  expect((requestOptions?.body as FormData).get("model")).toBe(
    "custom-stt-model",
  );

  await user.click(screen.getByRole("button", { name: "Clear STT Model" }));

  expect(modelInput).toHaveValue("volc.bigasr.auc_turbo");
  expect(localStorage.getItem("quickvoice.stt.model")).toBeNull();
});

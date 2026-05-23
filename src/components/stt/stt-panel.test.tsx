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
        modelOptions: ["volc.bigasr.auc_turbo"],
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

test("renders only available providers in the selector", () => {
  render(
    <SttPanel
      sttStatus={{
        available: true,
        defaultProvider: "vosk",
        defaultModel: "volc.bigasr.auc_turbo",
        modelOptions: ["volc.bigasr.auc_turbo"],
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
  expect(screen.queryByRole("option", { name: /Volcengine/ })).toBeNull();
  expect(screen.getByRole("option", { name: /Vosk CN/ })).not.toBeDisabled();
});

test("hides STT model for Vosk", () => {
  render(
    <SttPanel
      onResultChange={() => {}}
      sttStatus={{
        available: true,
        defaultProvider: "vosk",
        defaultModel: "volc.bigasr.auc_turbo",
        modelOptions: ["volc.bigasr.auc_turbo"],
        providers: [{ id: "vosk", label: "Vosk CN", available: true }],
      }}
    />,
  );

  expect(screen.getByRole("option", { name: /Vosk CN/ })).toBeInTheDocument();
  expect(screen.queryByLabelText("STT Model")).toBeNull();
});

test("does not submit a model for Vosk", async () => {
  const user = userEvent.setup();
  const fetchMock = vi.fn(async () =>
    new Response(JSON.stringify({ text: "hello", provider: "vosk" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);

  render(
    <SttPanel
      onResultChange={() => {}}
      sttStatus={{
        available: true,
        defaultProvider: "vosk",
        defaultModel: "volc.bigasr.auc_turbo",
        modelOptions: ["volc.bigasr.auc_turbo"],
        providers: [{ id: "vosk", label: "Vosk CN", available: true }],
      }}
    />,
  );

  await user.upload(
    screen.getByLabelText("Audio File"),
    new File([new Uint8Array([1, 2, 3])], "voice.mp3", {
      type: "audio/mpeg",
    }),
  );
  await user.click(screen.getByRole("button", { name: "Start Transcription" }));

  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalled();
  });

  const [, requestOptions] = fetchMock.mock.calls[0] ?? [];
  expect((requestOptions?.body as FormData).get("provider")).toBe("vosk");
  expect((requestOptions?.body as FormData).get("model")).toBeNull();
});

test("shows STT model for Volcengine", () => {
  render(
    <SttPanel
      onResultChange={() => {}}
      sttStatus={{
        available: true,
        defaultProvider: "volcengine",
        defaultModel: "volc.bigasr.auc_turbo",
        modelOptions: ["volc.bigasr.auc_turbo", "volc.bigasr.auc"],
        providers: [{ id: "volcengine", label: "Volcengine", available: true }],
      }}
    />,
  );

  expect(screen.getByLabelText("STT Model")).toHaveValue(
    "volc.bigasr.auc_turbo",
  );
  expect(screen.queryByText(/Using Volcengine/)).toBeNull();
  expect(screen.queryByText(/Default provider is/)).toBeNull();
});

test("uses configured STT model options without browser persistence", async () => {
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
        modelOptions: ["volc.bigasr.auc_turbo", "volc.bigasr.auc"],
        providers: [
          { id: "volcengine", label: "Volcengine", available: true },
          { id: "vosk", label: "Vosk CN", available: true },
        ],
      }}
      onResultChange={() => {}}
    />,
  );

  const modelInput = screen.getByLabelText("STT Model");
  expect(modelInput).toHaveValue("volc.bigasr.auc_turbo");
  expect(screen.queryByRole("button", { name: "Clear STT Model" })).toBeNull();
  expect(
    document.querySelector('option[value="volc.bigasr.auc"]'),
  ).toBeInTheDocument();

  await user.selectOptions(modelInput, "volc.bigasr.auc");
  expect(localStorage.getItem("quickvoice.stt.model")).toBe("saved-stt-model");

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
    "volc.bigasr.auc",
  );
});

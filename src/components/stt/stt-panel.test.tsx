import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SttPanel } from "@/components/stt/stt-panel";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

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

test("renders unavailable providers as disabled selector options", () => {
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
  expect(screen.getByRole("option", { name: /Volcengine/ })).toBeDisabled();
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

test("uploads Volcengine audio directly to COS before submitting the audio URL", async () => {
  const user = userEvent.setup();
  const onResultChange = vi.fn();
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          uploadUrl: "https://cos.example.test/upload",
          audioUrl: "https://cos.example.test/read",
          provider: "volcengine",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    )
    .mockResolvedValueOnce(new Response(null, { status: 200 }))
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ text: "done", provider: "volcengine" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  vi.stubGlobal("fetch", fetchMock);

  render(
    <SttPanel
      onResultChange={onResultChange}
      sttStatus={{
        available: true,
        defaultProvider: "volcengine",
        defaultModel: "volc.bigasr.auc_turbo",
        modelOptions: ["volc.bigasr.auc_turbo"],
        providers: [{ id: "volcengine", label: "Volcengine", available: true }],
      }}
    />,
  );

  const audioFile = new File([new Uint8Array([1, 2, 3])], "voice.mp3", {
    type: "audio/mpeg",
  });
  await user.upload(screen.getByLabelText("Audio File"), audioFile);
  await user.click(screen.getByRole("button", { name: "Start Transcription" }));

  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/stt");
  const uploadBody = fetchMock.mock.calls[0]?.[1]?.body as FormData;
  expect(uploadBody.get("intent")).toBe("upload");
  expect(uploadBody.get("file")).toBeNull();
  expect(uploadBody.get("fileName")).toBe("voice.mp3");
  expect(uploadBody.get("contentType")).toBe("audio/mpeg");
  expect(uploadBody.get("size")).toBe(String(audioFile.size));

  expect(fetchMock.mock.calls[1]).toEqual([
    "https://cos.example.test/upload",
    {
      method: "PUT",
      mode: "cors",
      body: audioFile,
      headers: {
        "Content-Type": "audio/mpeg",
      },
    },
  ]);

  expect(fetchMock.mock.calls[2]?.[0]).toBe("/api/stt");
  const submitBody = fetchMock.mock.calls[2]?.[1]?.body as FormData;
  expect(submitBody.get("intent")).toBe("submit");
  expect(submitBody.get("audioUrl")).toBe("https://cos.example.test/read");
  expect(submitBody.get("file")).toBeNull();

  await waitFor(() => {
    expect(onResultChange).toHaveBeenLastCalledWith({
      loading: false,
      error: null,
      text: "done",
      provider: "volcengine",
    });
  });
});

test("shows a COS CORS hint when browser direct upload cannot reach COS", async () => {
  const user = userEvent.setup();
  const onResultChange = vi.fn();
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          uploadUrl: "https://cos.example.test/upload",
          audioUrl: "https://cos.example.test/read",
          provider: "volcengine",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    )
    .mockRejectedValueOnce(new TypeError("Failed to fetch"));
  vi.stubGlobal("fetch", fetchMock);

  render(
    <SttPanel
      onResultChange={onResultChange}
      sttStatus={{
        available: true,
        defaultProvider: "volcengine",
        defaultModel: "volc.bigasr.auc_turbo",
        modelOptions: ["volc.bigasr.auc_turbo"],
        providers: [{ id: "volcengine", label: "Volcengine", available: true }],
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
    expect(onResultChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        error: expect.stringContaining("COS direct upload failed"),
      }),
    );
  });
});

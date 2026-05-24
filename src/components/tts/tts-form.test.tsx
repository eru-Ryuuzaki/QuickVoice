import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { TtsForm } from "@/components/tts/tts-form";
import type { PublicProviderStatus } from "@/server/providers/types";

const voicesPayload = {
  groups: [
    {
      id: "zh-cn",
      label: "Mandarin (zh-CN)",
      voices: [
        {
          id: "zh-CN-XiaoxiaoNeural",
          label: "Xiaoxiao",
          locale: "zh-CN",
        },
        {
          id: "zh-CN-XiaoyiNeural",
          label: "Xiaoyi",
          locale: "zh-CN",
        },
      ],
    },
  ],
};

const ttsStatus: PublicProviderStatus["tts"] = {
  available: true,
  defaultProvider: "minimax",
  defaultModel: "speech-2.8-turbo",
  modelOptions: ["speech-2.8-turbo", "speech-2.8-hd"],
  defaultVoice: "Chinese (Mandarin)_Warm_Girl",
  voiceOptions: [
    "Chinese (Mandarin)_Warm_Girl",
    "Chinese (Mandarin)_News_Anchor",
  ],
  providerSettings: {
    minimax: {
      defaultModel: "speech-2.8-turbo",
      modelOptions: ["speech-2.8-turbo", "speech-2.8-hd"],
      defaultVoice: "Chinese (Mandarin)_Warm_Girl",
      voiceOptions: [
        "Chinese (Mandarin)_Warm_Girl",
        "Chinese (Mandarin)_News_Anchor",
      ],
    },
    microsoft_unofficial: {
      defaultModel: "",
      modelOptions: [],
      defaultVoice: "zh-CN-XiaoxiaoNeural",
      voiceOptions: ["zh-CN-XiaoxiaoNeural", "zh-CN-YunxiNeural"],
    },
  },
  providers: [
    { id: "minimax", label: "MiniMax", available: true },
    {
      id: "microsoft_unofficial",
      label: "Microsoft Unofficial",
      available: true,
    },
  ],
};

test("submits TTS input and reports playable audio result", async () => {
  const user = userEvent.setup();
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify(voicesPayload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
    .mockResolvedValueOnce(
      new Response(new Blob([new Uint8Array([1, 2, 3])], { type: "audio/mpeg" }), {
        status: 200,
        headers: { "Content-Type": "audio/mpeg" },
      }),
    );

  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:quickvoice-result"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });

  const onResultChange = vi.fn();
  render(
    <TtsForm
      onResultChange={onResultChange}
      seedText=""
      ttsStatus={ttsStatus}
    />,
  );

  await waitFor(() => {
    expect(screen.getByLabelText("Input Text")).toBeInTheDocument();
  });

  await user.type(screen.getByLabelText("Input Text"), "hello quickvoice");
  await user.click(screen.getByRole("button", { name: "Generate Audio" }));

  await waitFor(() => {
    expect(onResultChange).toHaveBeenCalledWith(
      expect.objectContaining({
        audioUrl: "blob:quickvoice-result",
        error: null,
      }),
    );
  });

  const [, requestOptions] = fetchMock.mock.calls[1] ?? [];
  expect((requestOptions?.body as FormData).get("provider")).toBe("minimax");
  expect((requestOptions?.body as FormData).get("rate")).toBeNull();
  expect((requestOptions?.body as FormData).get("pitch")).toBeNull();
  expect((requestOptions?.body as FormData).get("model")).toBe(
    "speech-2.8-turbo",
  );
  expect(screen.getByRole("combobox", { name: "TTS Model" })).toHaveValue(
    "speech-2.8-turbo",
  );
  expect(screen.getByRole("combobox", { name: "Voice" })).toHaveValue(
    "Chinese (Mandarin)_Warm_Girl",
  );
  expect(
    document.querySelector('option[value="Chinese (Mandarin)_News_Anchor"]'),
  ).toBeInTheDocument();
  expect(
    document.querySelector('option[value="zh-CN-XiaoxiaoNeural"]'),
  ).not.toBeInTheDocument();
});

test("switches voice options with the selected TTS provider", async () => {
  const user = userEvent.setup();
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify(voicesPayload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
    .mockResolvedValueOnce(
      new Response(new Blob([new Uint8Array([1])], { type: "audio/mpeg" }), {
        status: 200,
        headers: { "Content-Type": "audio/mpeg" },
      }),
    );

  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:quickvoice-result"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });

  render(
    <TtsForm
      onResultChange={() => {}}
      seedText="hello quickvoice"
      ttsStatus={ttsStatus}
    />,
  );

  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  await user.selectOptions(
    screen.getByLabelText("TTS Provider"),
    "microsoft_unofficial",
  );

  expect(screen.getByRole("combobox", { name: "Voice" })).toHaveValue(
    "zh-CN-XiaoxiaoNeural",
  );
  expect(screen.queryByRole("combobox", { name: "TTS Model" })).toBeNull();
  expect(screen.queryByRole("combobox", { name: "Style" })).toBeNull();
  expect(screen.queryByLabelText(/Rate/)).toBeNull();
  expect(screen.queryByLabelText(/Pitch/)).toBeNull();
  expect(
    document.querySelector('option[value="zh-CN-YunxiNeural"]'),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("option", { name: "Xiaoyi (zh-CN)" }),
  ).toBeInTheDocument();
  expect(
    document.querySelector('option[value="Chinese (Mandarin)_Warm_Girl"]'),
  ).not.toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Generate Audio" }));

  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  const [, requestOptions] = fetchMock.mock.calls[1] ?? [];
  expect((requestOptions?.body as FormData).get("provider")).toBe(
    "microsoft_unofficial",
  );
  expect((requestOptions?.body as FormData).get("voice")).toBe(
    "zh-CN-XiaoxiaoNeural",
  );
  expect((requestOptions?.body as FormData).get("model")).toBeNull();
  expect((requestOptions?.body as FormData).get("style")).toBeNull();
  expect((requestOptions?.body as FormData).get("rate")).toBeNull();
  expect((requestOptions?.body as FormData).get("pitch")).toBeNull();
});

test("shows only MiniMax model and voice fields", async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(voicesPayload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );

  vi.stubGlobal("fetch", fetchMock);

  render(
    <TtsForm
      onResultChange={() => {}}
      seedText="hello quickvoice"
      ttsStatus={ttsStatus}
    />,
  );

  expect(await screen.findByLabelText("TTS Model")).toHaveValue(
    "speech-2.8-turbo",
  );
  expect(screen.getByLabelText("Voice")).toHaveValue(
    "Chinese (Mandarin)_Warm_Girl",
  );
  expect(screen.queryByRole("combobox", { name: "Style" })).toBeNull();
  expect(screen.queryByLabelText(/Rate/)).toBeNull();
  expect(screen.queryByLabelText(/Pitch/)).toBeNull();
});

test("places the TXT file input below the input text field", async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(voicesPayload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );

  vi.stubGlobal("fetch", fetchMock);

  render(
    <TtsForm
      onResultChange={() => {}}
      seedText=""
      ttsStatus={ttsStatus}
    />,
  );

  const inputText = await screen.findByLabelText("Input Text");
  const txtFile = screen.getByLabelText("TXT File");

  expect(
    inputText.compareDocumentPosition(txtFile) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Upload .txt" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Type Text" })).toBeNull();
});

test("submits the TXT file when input text is blank", async () => {
  const user = userEvent.setup();
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify(voicesPayload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
    .mockResolvedValueOnce(
      new Response(new Blob([new Uint8Array([1])], { type: "audio/mpeg" }), {
        status: 200,
        headers: { "Content-Type": "audio/mpeg" },
      }),
    );

  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:quickvoice-result"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });

  render(
    <TtsForm
      onResultChange={() => {}}
      seedText=""
      ttsStatus={ttsStatus}
    />,
  );

  await user.upload(
    await screen.findByLabelText("TXT File"),
    new File(["hello from file"], "speech.txt", { type: "text/plain" }),
  );
  await user.click(screen.getByRole("button", { name: "Generate Audio" }));

  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  const [, requestOptions] = fetchMock.mock.calls[1] ?? [];
  expect((requestOptions?.body as FormData).get("file")).toBeInstanceOf(File);
  expect((requestOptions?.body as FormData).get("text")).toBeNull();
});

test("renders unavailable TTS providers as disabled selector options", async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(voicesPayload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );

  vi.stubGlobal("fetch", fetchMock);

  render(
    <TtsForm
      onResultChange={() => {}}
      seedText="hello quickvoice"
      ttsStatus={{
        ...ttsStatus,
        providers: [
          { id: "minimax", label: "MiniMax", available: true },
          {
            id: "microsoft_unofficial",
            label: "Microsoft Unofficial",
            available: false,
            reason: "disabled",
          },
        ],
      }}
    />,
  );

  expect(await screen.findByRole("option", { name: /MiniMax/ })).toBeInTheDocument();
  expect(
    screen.getByRole("option", { name: /Microsoft Unofficial/ }),
  ).toBeDisabled();
});

test("uses configured TTS model options without browser persistence", async () => {
  localStorage.setItem("quickvoice.tts.minimax.model", "saved-tts-model");
  const user = userEvent.setup();
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify(voicesPayload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
    .mockResolvedValueOnce(
      new Response(new Blob([new Uint8Array([1])], { type: "audio/mpeg" }), {
        status: 200,
        headers: { "Content-Type": "audio/mpeg" },
      }),
    );

  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:quickvoice-result"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });

  render(
    <TtsForm
      onResultChange={() => {}}
      seedText="hello quickvoice"
      ttsStatus={ttsStatus}
    />,
  );

  const modelInput = await screen.findByLabelText("TTS Model");
  expect(modelInput).toHaveValue("speech-2.8-turbo");
  expect(screen.queryByRole("button", { name: "Clear TTS Model" })).toBeNull();

  await user.selectOptions(modelInput, "speech-2.8-hd");
  expect(localStorage.getItem("quickvoice.tts.minimax.model")).toBe(
    "saved-tts-model",
  );

  await user.click(screen.getByRole("button", { name: "Generate Audio" }));

  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  const [, requestOptions] = fetchMock.mock.calls[1] ?? [];
  expect((requestOptions?.body as FormData).get("model")).toBe(
    "speech-2.8-hd",
  );
});

test("resets TTS selections from provider env defaults", async () => {
  localStorage.setItem(
    "quickvoice.tts.microsoft_unofficial.voice",
    "zh-CN-YunxiNeural",
  );
  const user = userEvent.setup();
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(voicesPayload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );

  vi.stubGlobal("fetch", fetchMock);

  render(
    <TtsForm
      onResultChange={() => {}}
      seedText="hello quickvoice"
      ttsStatus={ttsStatus}
    />,
  );

  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  expect(screen.getByRole("combobox", { name: "Voice" })).toHaveValue(
    "Chinese (Mandarin)_Warm_Girl",
  );

  await user.selectOptions(
    screen.getByLabelText("TTS Provider"),
    "microsoft_unofficial",
  );

  expect(screen.getByRole("combobox", { name: "Voice" })).toHaveValue(
    "zh-CN-XiaoxiaoNeural",
  );
  expect(
    localStorage.getItem("quickvoice.tts.microsoft_unofficial.voice"),
  ).toBe("zh-CN-YunxiNeural");
});

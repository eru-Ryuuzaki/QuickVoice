import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AppShell } from "@/components/app-shell";
import type { PublicProviderStatus } from "@/server/providers/types";

const baseStatus: PublicProviderStatus = {
  tts: {
    available: true,
    defaultProvider: "minimax",
    defaultModel: "speech-2.8-turbo",
    modelOptions: ["speech-2.8-turbo"],
    defaultVoice: "Chinese (Mandarin)_Warm_Girl",
    voiceOptions: ["Chinese (Mandarin)_Warm_Girl"],
    providerSettings: {
      minimax: {
        defaultModel: "speech-2.8-turbo",
        modelOptions: ["speech-2.8-turbo"],
        defaultVoice: "Chinese (Mandarin)_Warm_Girl",
        voiceOptions: ["Chinese (Mandarin)_Warm_Girl"],
      },
      microsoft_unofficial: {
        defaultModel: "",
        modelOptions: [],
        defaultVoice: "zh-CN-XiaoxiaoNeural",
        voiceOptions: ["zh-CN-XiaoxiaoNeural"],
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
  },
  stt: {
    available: true,
    defaultProvider: "volcengine",
    defaultModel: "volc.bigasr.auc_turbo",
    modelOptions: ["volc.bigasr.auc_turbo"],
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
    modelOptions: ["gpt-5.5"],
  },
};

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

  render(<AppShell status={baseStatus} />);

  expect(screen.getByText("QuickVoice")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Text to Speech" }),
  ).toBeInTheDocument();
  expect(screen.getByText("Audio Output")).toBeInTheDocument();
  expect(screen.getByText("TTS: MiniMax")).toBeInTheDocument();
  expect(screen.getByText("STT: Volcengine")).toBeInTheDocument();
  expect(screen.getByText("Summary: gpt-5.5")).toBeInTheDocument();
  expect(screen.queryByText("TTS AVAILABLE")).toBeNull();
  expect(screen.queryByText("STT DEFAULT VOLCENGINE")).toBeNull();
  expect(screen.queryByText("VOSK CN UNAVAILABLE")).toBeNull();
  expect(screen.getByTestId("activity-rail")).toBeInTheDocument();

  await waitFor(() => {
    expect(fetch).toHaveBeenCalled();
  });
});

test("does not render Send To TTS actions in STT results", async () => {
  const user = userEvent.setup();
  const fetchMock = vi.fn(async (input: unknown) => {
    const url = String(input);
    if (url.endsWith("/api/voices")) {
      return new Response(JSON.stringify({ groups: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ text: "hello transcript", provider: "volcengine" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  });
  vi.stubGlobal("fetch", fetchMock);

  render(<AppShell status={baseStatus} />);

  await user.click(screen.getByRole("button", { name: "Speech to Text" }));
  await user.upload(
    screen.getByLabelText("Audio File"),
    new File([new Uint8Array([1, 2, 3])], "voice.mp3", {
      type: "audio/mpeg",
    }),
  );
  await user.click(screen.getByRole("button", { name: "Start Transcription" }));

  expect(await screen.findByDisplayValue("hello transcript")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Send To TTS" })).toBeNull();
});

test("allows entering transcript text before audio transcription", async () => {
  const user = userEvent.setup();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ groups: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );

  render(<AppShell status={baseStatus} />);

  await user.click(screen.getByRole("button", { name: "Speech to Text" }));
  await user.type(screen.getByLabelText("Transcript"), "manual notes");

  expect(screen.getByLabelText("Transcript")).toHaveValue("manual notes");
  expect(screen.getByRole("button", { name: "Summarize" })).toBeEnabled();
  expect(screen.queryByText("Upload an audio file and start transcription.")).toBeNull();
});

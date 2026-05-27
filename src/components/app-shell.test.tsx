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
  const fetchMock = vi.fn(async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/api/voices")) {
      return new Response(JSON.stringify({ groups: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url === "https://cos.example.test/upload") {
      return new Response(null, { status: 200 });
    }

    const body = init?.body as FormData | undefined;
    if (body?.get("intent") === "upload") {
      expect(body.get("file")).toBeNull();
      expect(body.get("fileName")).toBe("voice.mp3");
      expect(body.get("contentType")).toBe("audio/mpeg");
      expect(body.get("size")).toBe("3");
      return new Response(
        JSON.stringify({
          uploadUrl: "https://cos.example.test/upload",
          audioUrl: "https://cos.example.test/read",
          provider: "volcengine",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (body?.get("intent") === "submit") {
      expect(body.get("file")).toBeNull();
      expect(body.get("audioUrl")).toBe("https://cos.example.test/read");
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

test("uses the warm Anthropic-inspired visual shell", async () => {
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

  const shell = screen.getByTestId("quickvoice-shell");
  const header = screen.getByTestId("quickvoice-header");
  const activeTab = screen.getByRole("button", { name: "Text to Speech" });
  const activityRail = screen.getByTestId("activity-rail");

  expect(shell).toHaveClass("bg-[var(--bg)]");
  expect(header).toHaveClass("rounded-md", "bg-[var(--surface)]");
  expect(screen.getByRole("heading", { name: "QuickVoice" })).not.toHaveClass(
    "font-serif",
  );
  expect(activeTab).toHaveClass(
    "bg-[var(--accent)]",
    "text-[var(--accent-contrast)]",
  );
  expect(activeTab).not.toHaveClass("tracking-[0.08em]");
  expect(screen.getByRole("heading", { name: "Text to Speech" })).toHaveClass(
    "font-sans",
  );
  expect(activityRail.className).toContain("bg-[var(--line-strong)]");

  await waitFor(() => {
    expect(fetch).toHaveBeenCalled();
  });
});

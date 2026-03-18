import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { TtsForm } from "@/components/tts/tts-form";

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
      ],
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
  render(<TtsForm onResultChange={onResultChange} seedText="" />);

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
});

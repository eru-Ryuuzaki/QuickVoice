import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SummaryPanel } from "@/components/stt/summary-panel";
import type { PublicProviderStatus } from "@/server/providers/types";

const summaryStatus: PublicProviderStatus["summary"] = {
  provider: "openai",
  available: true,
  defaultModel: "gpt-5.5",
  models: [
    { id: "gpt-5.5", label: "gpt-5.5", default: true },
    { id: "gpt-5.4-mini", label: "gpt-5.4-mini", default: false },
  ],
};

test("summarizes transcript with the selected model", async () => {
  const user = userEvent.setup();
  const fetchMock = vi.fn(async () =>
    new Response(
      JSON.stringify({
        title: "Title",
        summary: "Summary text",
        keyPoints: ["Point"],
        actionItems: [],
        keywords: [],
        cleanTranscript: "hello transcript",
        model: "gpt-5.4-mini",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    ),
  );

  vi.stubGlobal("fetch", fetchMock);

  render(
    <SummaryPanel
      summaryStatus={summaryStatus}
      transcript="hello transcript"
    />,
  );

  await user.selectOptions(screen.getByLabelText("Summary Model"), "gpt-5.4-mini");
  await user.click(screen.getByRole("button", { name: "Summarize" }));

  await waitFor(() => {
    expect(screen.getByText("Summary text")).toBeInTheDocument();
  });

  expect(fetchMock).toHaveBeenCalledWith(
    "/api/summary",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        transcript: "hello transcript",
        model: "gpt-5.4-mini",
      }),
    }),
  );
});

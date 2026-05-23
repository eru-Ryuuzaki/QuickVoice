import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SummaryPanel } from "@/components/stt/summary-panel";
import type { PublicProviderStatus } from "@/server/providers/types";

const summaryStatus: PublicProviderStatus["summary"] = {
  provider: "openai",
  available: true,
  defaultModel: "gpt-5.5",
  modelOptions: ["gpt-5.5", "gpt-5.5-mini"],
};

test("summarizes transcript with a configured model option", async () => {
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
        model: "gpt-5.5-mini",
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

  await user.selectOptions(screen.getByLabelText("Summary Model"), "gpt-5.5-mini");
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
        model: "gpt-5.5-mini",
      }),
    }),
  );
});

test("uses configured summary model without browser persistence", async () => {
  localStorage.setItem("quickvoice.summary.model", "saved-summary-model");

  render(
    <SummaryPanel
      summaryStatus={summaryStatus}
      transcript="hello transcript"
    />,
  );

  const modelInput = screen.getByLabelText("Summary Model");
  expect(modelInput).toHaveValue("gpt-5.5");
  expect(screen.queryByRole("button", { name: "Clear Summary Model" })).toBeNull();
  expect(localStorage.getItem("quickvoice.summary.model")).toBe(
    "saved-summary-model",
  );
});

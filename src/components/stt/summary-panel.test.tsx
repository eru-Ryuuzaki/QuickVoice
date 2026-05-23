import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SummaryPanel } from "@/components/stt/summary-panel";
import type { PublicProviderStatus } from "@/server/providers/types";

const summaryStatus: PublicProviderStatus["summary"] = {
  provider: "openai",
  available: true,
  defaultModel: "gpt-5.5",
};

test("summarizes transcript with a manual model", async () => {
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
        model: "gpt-custom",
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

  await user.clear(screen.getByLabelText("Summary Model"));
  await user.type(screen.getByLabelText("Summary Model"), "gpt-custom");
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
        model: "gpt-custom",
      }),
    }),
  );
});

test("persists manual summary model and can clear the saved value", async () => {
  localStorage.setItem("quickvoice.summary.model", "saved-summary-model");
  const user = userEvent.setup();

  render(
    <SummaryPanel
      summaryStatus={summaryStatus}
      transcript="hello transcript"
    />,
  );

  const modelInput = screen.getByLabelText("Summary Model");
  expect(modelInput).toHaveValue("saved-summary-model");

  await user.clear(modelInput);
  await user.type(modelInput, "gpt-custom");
  expect(localStorage.getItem("quickvoice.summary.model")).toBe("gpt-custom");

  await user.click(screen.getByRole("button", { name: "Clear Summary Model" }));

  expect(modelInput).toHaveValue("gpt-5.5");
  expect(localStorage.getItem("quickvoice.summary.model")).toBeNull();
});

import { render, screen } from "@testing-library/react";

import HomePage from "@/app/page";

test("renders the QuickVoice workbench shell", () => {
  render(<HomePage />);

  expect(screen.getByText("QuickVoice")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "文字转语音" })).toBeInTheDocument();
});

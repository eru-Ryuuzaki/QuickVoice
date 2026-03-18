import { render, screen } from "@testing-library/react";

import { AppShell } from "@/components/app-shell";

test("renders top rail, activity rail, and two-pane work area", () => {
  render(<AppShell />);

  expect(screen.getByText("QuickVoice")).toBeInTheDocument();
  expect(screen.getByText("输入与参数")).toBeInTheDocument();
  expect(screen.getByText("结果与状态")).toBeInTheDocument();
  expect(screen.getByTestId("activity-rail")).toBeInTheDocument();
});

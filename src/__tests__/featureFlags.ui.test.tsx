import { render, screen } from "@testing-library/react";
import App from "../App";

describe("UI feature flags", () => {
  it("does not render timeline when ENABLE_TIMELINE is false", () => {
    render(<App />);
    expect(screen.queryByText(/timeline/i)).toBeNull();
  });

  it("does not render PDF export button when ENABLE_PDF_EXPORT is false", () => {
    render(<App />);
    expect(
      screen.queryByRole("button", { name: /pdf/i })
    ).toBeNull();
  });
});

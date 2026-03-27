import React from "react";
import { render, screen } from "@testing-library/react";
import { ProgressBar } from "./ProgressBar";

// The fill bar is the first div with an inline width style.
// We grab it by its role-less position; a test-id would be cleaner but
// we avoid modifying the component source.
function getFillBar(container: HTMLElement): HTMLElement {
  return container.querySelector<HTMLElement>("[style]")!;
}

describe("ProgressBar", () => {
  // 1. Negative input is clamped to 0%
  it("clamps width to 0% for negative input", () => {
    const { container } = render(<ProgressBar progress={-20} />);
    expect(getFillBar(container)).toHaveStyle({ width: "0%" });
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  // 2. Input > 100 is clamped to 100%
  it("clamps width to 100% for input greater than 100", () => {
    const { container } = render(<ProgressBar progress={150} />);
    expect(getFillBar(container)).toHaveStyle({ width: "100%" });
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  // 3. Exactly 50% passes through unchanged
  it("sets width to exactly 50% for input 50", () => {
    const { container } = render(<ProgressBar progress={50} />);
    expect(getFillBar(container)).toHaveStyle({ width: "50%" });
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  // 4. Color changes to green at 100% (Issue #37)
  it("uses green color classes when progress reaches 100%", () => {
    const { container } = render(<ProgressBar progress={100} />);
    const fill = getFillBar(container);
    // Fill bar switches from bg-indigo-500 to bg-green-500
    expect(fill.classList).toContain("bg-green-500");
    expect(fill.classList).not.toContain("bg-indigo-500");
    // Percentage label also switches to green
    expect(screen.getByText("100%").classList).toContain("text-green-400");
  });

  // 5. Below 100% uses indigo (guard against regression)
  it("uses indigo color classes when progress is below 100%", () => {
    const { container } = render(<ProgressBar progress={99} />);
    const fill = getFillBar(container);
    expect(fill.classList).toContain("bg-indigo-500");
    expect(fill.classList).not.toContain("bg-green-500");
  });

  // 6. animated=true adds the shimmer class
  it("adds animate-shimmer class when animated is true", () => {
    const { container } = render(<ProgressBar progress={50} animated />);
    expect(getFillBar(container).classList).toContain("animate-shimmer");
  });
});

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

// Trivial smoke test — verifies Vitest + React Testing Library are wired up.
describe("Vitest setup", () => {
  it("renders a React element and finds it in the DOM", () => {
    render(<p>vitest is working</p>);
    expect(screen.getByText("vitest is working")).toBeInTheDocument();
  });
});

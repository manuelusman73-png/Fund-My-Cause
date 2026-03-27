import React from "react";
import { render } from "@testing-library/react";
import { ProgressBar } from "./ProgressBar";

describe("ProgressBar snapshots", () => {
  it("matches snapshot at 0%", () => {
    const { asFragment } = render(<ProgressBar progress={0} />);
    expect(asFragment()).toMatchSnapshot();
  });

  it("matches snapshot at 50%", () => {
    const { asFragment } = render(<ProgressBar progress={50} />);
    expect(asFragment()).toMatchSnapshot();
  });

  it("matches snapshot at 100%", () => {
    const { asFragment } = render(<ProgressBar progress={100} />);
    expect(asFragment()).toMatchSnapshot();
  });
});

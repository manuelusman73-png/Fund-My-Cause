import React from "react";
import { render } from "@testing-library/react";
import { CampaignCard } from "./CampaignCard";
import type { Campaign } from "@/types/campaign";

jest.mock("@/components/ui/CountdownTimer", () => ({
  CountdownTimer: ({ deadline }: { deadline: string }) => (
    <div data-testid="countdown">{deadline}</div>
  ),
}));

const base: Campaign = {
  id: "1",
  title: "Test Campaign",
  description: "A test description",
  raised: 0,
  goal: 1000,
  deadline: "2099-01-01T00:00:00.000Z",
  image: "https://example.com/image.jpg",
};

const mockPledge = jest.fn();

describe("CampaignCard snapshots", () => {
  it("matches snapshot for funded campaign (raised >= goal)", () => {
    const { asFragment } = render(
      <CampaignCard campaign={{ ...base, raised: 1000 }} onPledge={mockPledge} />
    );
    expect(asFragment()).toMatchSnapshot();
  });

  it("matches snapshot for active campaign (raised < goal)", () => {
    const { asFragment } = render(
      <CampaignCard campaign={{ ...base, raised: 500 }} onPledge={mockPledge} />
    );
    expect(asFragment()).toMatchSnapshot();
  });
});

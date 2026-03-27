import React from "react";
import { render, screen, act } from "@testing-library/react";
import { CountdownTimer } from "./CountdownTimer";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns an ISO string that is `ms` milliseconds from the pinned "now". */
function deadlineAt(ms: number): string {
  return new Date(NOW + ms).toISOString();
}

// Pin "now" to a fixed timestamp so all calculations are deterministic.
const NOW = 1_700_000_000_000; // arbitrary fixed epoch ms

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
});

afterEach(() => {
  jest.useRealTimers();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("CountdownTimer", () => {
  // 1. Future deadline shows Xd Xh Xm left
  it("displays days, hours, and minutes for a future deadline over 1 hour away", () => {
    // 2 days + 3 hours + 15 minutes from now
    const ms = 2 * 86_400_000 + 3 * 3_600_000 + 15 * 60_000;
    render(<CountdownTimer deadline={deadlineAt(ms)} />);
    expect(screen.getByText("2d 3h 15m left")).toBeInTheDocument();
  });

  // 2. Past deadline shows "Campaign Ended"
  it("displays 'Campaign Ended' when the deadline has passed", () => {
    render(<CountdownTimer deadline={deadlineAt(-1000)} />);
    expect(screen.getByText("Campaign Ended")).toBeInTheDocument();
  });

  // 3. Interval is cleared on unmount (no memory leak)
  it("clears the interval on unmount", () => {
    const clearSpy = jest.spyOn(global, "clearInterval");
    const { unmount } = render(<CountdownTimer deadline={deadlineAt(5 * 86_400_000)} />);
    unmount();
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  // 4. Seconds display for deadlines under 1 hour (Issue #36)
  it("shows hours, minutes, and seconds when under 1 hour remains", () => {
    // 30 minutes + 45 seconds from now
    const ms = 30 * 60_000 + 45_000;
    render(<CountdownTimer deadline={deadlineAt(ms)} />);
    expect(screen.getByText("0h 30m 45s left")).toBeInTheDocument();
  });

  // 5. Ticks correctly — display updates as time advances
  it("updates the display as time advances past the 1-hour threshold", () => {
    // Start at exactly 1h 1m from now (still in Xd Xh Xm mode)
    const ms = 61 * 60_000; // 61 minutes
    render(<CountdownTimer deadline={deadlineAt(ms)} />);
    expect(screen.getByText("0d 1h 1m left")).toBeInTheDocument();

    // Advance 2 minutes — now 59 minutes left, switches to seconds display
    act(() => { jest.advanceTimersByTime(2 * 60_000); });
    expect(screen.getByText("0h 59m 0s left")).toBeInTheDocument();
  });
});

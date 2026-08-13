// @vitest-environment jsdom
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NotificationTray, type NotificationDisplayItem } from "../../engine/components/NotificationTray";

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("NotificationTray", () => {
  it("renders every notification's message with a tone data attribute", () => {
    const notifications: NotificationDisplayItem[] = [
      { id: "n1", tone: "gain", message: "+3 Silver" },
      { id: "n2", tone: "loss", message: "-1 Rapier" },
      { id: "n3", tone: "info", message: "Completed: A Debt in Steel" },
    ];
    render(<NotificationTray notifications={notifications} onDismiss={() => {}} />);
    expect(screen.getByText("+3 Silver").closest("[data-tone]")).toHaveAttribute("data-tone", "gain");
    expect(screen.getByText("-1 Rapier").closest("[data-tone]")).toHaveAttribute("data-tone", "loss");
    expect(screen.getByText("Completed: A Debt in Steel").closest("[data-tone]")).toHaveAttribute("data-tone", "info");
  });

  it("clicking the dismiss button calls onDismiss with that notification's id", () => {
    const onDismiss = vi.fn();
    render(
      <NotificationTray notifications={[{ id: "n1", tone: "gain", message: "+3 Silver" }]} onDismiss={onDismiss} />
    );
    fireEvent.click(screen.getByLabelText("Dismiss notification"));
    expect(onDismiss).toHaveBeenCalledWith("n1");
  });

  it("auto-dismisses a notification after the configured duration", () => {
    const onDismiss = vi.fn();
    render(
      <NotificationTray notifications={[{ id: "n1", tone: "gain", message: "+3 Silver" }]} onDismiss={onDismiss} />
    );
    advance(4499);
    expect(onDismiss).not.toHaveBeenCalled();
    advance(1);
    expect(onDismiss).toHaveBeenCalledWith("n1");
  });

  it("a later-added notification's timer is independent — still has its own full duration remaining", () => {
    const onDismiss = vi.fn();
    const { rerender } = render(
      <NotificationTray notifications={[{ id: "n1", tone: "gain", message: "+3 Silver" }]} onDismiss={onDismiss} />
    );
    advance(3000);
    rerender(
      <NotificationTray
        notifications={[
          { id: "n1", tone: "gain", message: "+3 Silver" },
          { id: "n2", tone: "gain", message: "+1 Rapier" },
        ]}
        onDismiss={onDismiss}
      />
    );
    advance(1500); // n1 total elapsed 4500 -> dismissed; n2 total elapsed 1500 -> not yet
    expect(onDismiss).toHaveBeenCalledWith("n1");
    expect(onDismiss).not.toHaveBeenCalledWith("n2");
    advance(3000); // n2 total elapsed 4500 -> dismissed
    expect(onDismiss).toHaveBeenCalledWith("n2");
  });
});

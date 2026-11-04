// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LendingWorkspace } from "./lending-workspace";

const mocked = vi.hoisted(() => ({
  day: "2030-01-09",
  mutate: vi.fn(async () => "user-id"),
  query: vi.fn(
    (
      _reference: unknown,
      args: { refreshKey: string; paginationOpts: { cursor: string | null } },
    ) => ({
      page: [
        {
          id: args.paginationOpts.cursor ? "second-tool" : "first-tool",
          name: args.paginationOpts.cursor ? "Second tool" : "First tool",
          category: "Garden",
          condition: "Good",
          description: "A useful tool",
          own: false,
          available: true,
        },
      ],
      isDone: args.paginationOpts.cursor !== null,
      continueCursor: "second-page",
    }),
  ),
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
  useMutation: () => mocked.mutate,
  useQuery: mocked.query,
}));
vi.mock("@/components/lib/use-utc-day", () => ({
  useUtcDay: () => mocked.day,
}));
vi.mock("@clerk/nextjs", () => ({
  Show: ({ when, children }: { when: string; children: React.ReactNode }) =>
    when === "signed-in" ? children : null,
  SignInButton: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));

afterEach(() => {
  cleanup();
  mocked.day = "2030-01-09";
  mocked.query.mockClear();
});

describe("borrow request drafts", () => {
  it("keeps both dates while refreshing availability and returning to page one on a new UTC day", async () => {
    const { rerender } = render(<LendingWorkspace view="tools" />);
    await screen.findByText("First tool");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Second tool");
    fireEvent.click(screen.getByRole("button", { name: "Request to borrow" }));
    const from = screen.getByLabelText("From") as HTMLInputElement;
    const until = screen.getByLabelText("Until") as HTMLInputElement;
    fireEvent.change(from, {
      target: { value: "2030-02-01" },
    });
    fireEvent.change(until, {
      target: { value: "2030-02-03" },
    });
    mocked.day = "2030-01-10";
    rerender(<LendingWorkspace view="tools" />);
    await waitFor(() => expect(screen.getByText("First tool")).toBeTruthy());
    expect(screen.getByLabelText("From")).toBe(from);
    expect(screen.getByLabelText("Until")).toBe(until);
    expect(
      screen.getByRole("heading", { name: "Request Second tool" }),
    ).toBeTruthy();
    expect(from.value).toBe("2030-02-01");
    expect(until.value).toBe("2030-02-03");
    expect(mocked.query).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        refreshKey: "2030-01-10",
        paginationOpts: { numItems: 6, cursor: null },
      }),
    );
  });
});

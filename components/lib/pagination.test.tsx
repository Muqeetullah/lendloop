import { describe, expect, it } from "vitest";
import { pageReducer } from "./pagination";

describe("page navigation", () => {
  it("moves between one page at a time and replaces stale forward cursors", () => {
    const first = { cursors: [null], index: 0 };
    const second = pageReducer(first, { type: "next", cursor: "page-two" });
    expect(pageReducer(second, { type: "next", cursor: "page-two" })).toBe(
      second,
    );
    const third = pageReducer(second, { type: "next", cursor: "page-three" });
    const back = pageReducer(third, { type: "previous" });
    expect(back.index).toBe(1);
    expect(back.cursors[back.index]).toBe("page-two");
    const refreshed = pageReducer(back, {
      type: "next",
      cursor: "new-page-three",
    });
    expect(refreshed).toEqual({
      cursors: [null, "page-two", "new-page-three"],
      index: 2,
    });
    expect(pageReducer(first, { type: "previous" }).index).toBe(0);
  });
});

import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";
import { requestErrorMessage } from "./request-errors";

describe("request error feedback", () => {
  it("explains known request failures and hides unexpected server details", () => {
    expect(
      requestErrorMessage(new ConvexError("Loan dates overlap"), "Try again."),
    ).toBe("These dates overlap an approved loan for this tool.");
    expect(
      requestErrorMessage(
        new ConvexError("You already have a pending request for this tool"),
        "Try again.",
      ),
    ).toBe("You already have a pending request for this tool.");
    expect(
      requestErrorMessage(new ConvexError("internal detail"), "Try again."),
    ).toBe("Try again.");
    expect(
      requestErrorMessage(new Error("private server detail"), "Try again."),
    ).toBe("Try again.");
  });
});

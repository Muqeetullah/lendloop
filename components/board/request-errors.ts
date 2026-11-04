import { ConvexError } from "convex/values";

const messages: Record<string, string> = {
  "Invalid date range":
    "Choose a start date today or later, and an end date on or after it.",
  "Listing unavailable": "This listing is no longer available.",
  "Cannot request your own listing": "You cannot request your own listing.",
  "You already have a pending request for this tool":
    "You already have a pending request for this tool.",
  "You have reached the limit of 10 pending requests":
    "You have reached the limit of 10 pending requests.",
  "Too many requests. Please try again later":
    "You have reached the hourly request limit. Please try again later.",
  "Not authorized": "You no longer have permission to change this request.",
  "Invalid request transition":
    "This request has already changed. Check its current status.",
  "Request start date has passed":
    "The request start date has passed, so it can no longer be approved.",
  "An overdue loan must be returned before another request can be approved":
    "An overdue loan must be returned before another request can be approved.",
  "Too many active reservations to check safely":
    "This tool has too many active reservations to approve safely.",
  "Loan dates overlap": "These dates overlap an approved loan for this tool.",
};

export function requestErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ConvexError && typeof error.data === "string"
    ? (messages[error.data] ?? fallback)
    : fallback;
}

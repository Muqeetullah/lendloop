import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Field } from "./field";
import { StatePanel } from "./state-panel";

describe("accessible interface primitives", () => {
  it("connects the label, hint, and validation error to the input", () => {
    const html = renderToStaticMarkup(
      <Field
        label="Tool name"
        hint="Use a short name"
        error="Enter a name"
        required
      />,
    );
    const inputId = html.match(/<input[^>]*\sid="([^"]+)"/)?.[1];
    expect(inputId).toBeDefined();
    expect(html).toContain(`for="${inputId}"`);
    expect(html).toContain(`id="${inputId}-hint"`);
    expect(html).toContain(`id="${inputId}-error"`);
    expect(html).toContain(
      `aria-describedby="${inputId}-hint ${inputId}-error"`,
    );
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain("required");
  });

  it("announces loading and errors with appropriate roles", () => {
    const loading = renderToStaticMarkup(
      <StatePanel kind="loading" title="Loading" description="Please wait" />,
    );
    const error = renderToStaticMarkup(
      <StatePanel
        kind="error"
        title="Could not load"
        description="Try again"
      />,
    );
    const empty = renderToStaticMarkup(
      <StatePanel title="No tools" description="Check back later" />,
    );
    expect(loading).toContain('role="status"');
    expect(error).toContain('role="alert"');
    expect(empty).not.toContain('role="alert"');
  });
});

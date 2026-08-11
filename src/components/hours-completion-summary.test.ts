import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HoursCompletionSummary } from "@/components/hours-completion-summary";

describe("HoursCompletionSummary", () => {
  it("uses relative hours for estimate, logged, and overrun widths", () => {
    const markup = renderToStaticMarkup(
      createElement(HoursCompletionSummary, {
        rows: [
          {
            label: "Fieldwork",
            values: {
              estimated: 100,
              logged: 50,
            },
          },
          {
            label: "Modeling",
            values: {
              estimated: 50,
              logged: 75,
            },
          },
        ],
      }),
    );

    expect(markup).toContain("--hours-estimate-width:100%");
    expect(markup).toContain("--hours-estimate-width:50%");
    expect(markup).toContain("--hours-overrun-width:25%");
    expect(markup).toContain("shared hours scale");
  });

  it("shows logged hours without a percentage target when no estimate exists", () => {
    const markup = renderToStaticMarkup(
      createElement(HoursCompletionSummary, {
        rows: [
          {
            label: "Admin",
            values: {
              estimated: null,
              logged: 20,
            },
          },
        ],
      }),
    );

    expect(markup).toContain("No estimate");
    expect(markup).toContain("Logged 20 h");
    expect(markup).not.toContain("hours-completion__target");
  });
});

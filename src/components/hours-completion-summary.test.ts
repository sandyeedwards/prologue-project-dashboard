import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  compressedHoursScalePercent,
  HoursCompletionSummary,
} from "@/components/hours-completion-summary";

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

    const compressedHalf = compressedHoursScalePercent(50, 100);
    const compressedLogged75 = compressedHoursScalePercent(75, 100);
    const compressedOverrun = compressedLogged75 - compressedHalf;

    expect(compressedHalf).toBeCloseTo(70.71, 2);
    expect(compressedHoursScalePercent(25, 100)).toBeCloseTo(50, 2);
    expect(markup).toContain("--hours-estimate-width:100%");
    expect(markup).toContain(`--hours-estimate-width:${compressedHalf}%`);
    expect(markup).toContain(`--hours-overrun-width:${compressedOverrun}%`);
    expect(markup).toContain("compressed shared hours scale");
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

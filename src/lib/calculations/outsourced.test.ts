import { describe, expect, it } from "vitest";
import { createOutsourcedBranchResolver } from "./outsourced";

describe("outsourced modeling hierarchy", () => {
  it("treats an estimated child under an outsourced parent as outsourced", () => {
    const resolve = createOutsourcedBranchResolver(
      [
        { id: "parent", parentTaskId: null, name: "Cosmere Modeling" },
        { id: "child", parentTaskId: "parent", name: "Guest room models" },
      ],
      (name) => name.toLowerCase().includes("cosmere modeling"),
    );

    expect(resolve("parent")).toBe(true);
    expect(resolve("child")).toBe(true);
  });

  it("does not cross into unrelated branches", () => {
    const resolve = createOutsourcedBranchResolver(
      [
        { id: "parent", parentTaskId: null, name: "Modeling" },
        { id: "child", parentTaskId: "parent", name: "In-house drafting" },
      ],
      (name) => name.toLowerCase().includes("cosmere modeling"),
    );

    expect(resolve("child")).toBe(false);
  });
});

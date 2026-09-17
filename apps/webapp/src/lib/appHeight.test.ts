import { describe, expect, it } from "vitest";

import { resolveAppHeight } from "./appHeight";

describe("resolveAppHeight", () => {
  it("returns null in a regular browser tab", () => {
    expect(
      resolveAppHeight({
        standalone: false,
        isAppleMobile: true,
        screenHeight: 844,
        screenWidth: 390,
        innerWidth: 390,
        innerHeight: 664
      })
    ).toBeNull();
  });

  it("returns null on non-Apple standalone apps", () => {
    expect(
      resolveAppHeight({
        standalone: true,
        isAppleMobile: false,
        screenHeight: 844,
        screenWidth: 390,
        innerWidth: 390,
        innerHeight: 740
      })
    ).toBeNull();
  });

  it("extends the viewport to full screen height when the top inset is excluded", () => {
    expect(
      resolveAppHeight({
        standalone: true,
        isAppleMobile: true,
        screenHeight: 844,
        screenWidth: 390,
        innerWidth: 390,
        innerHeight: 797
      })
    ).toBe(844);
  });

  it("keeps a correct full-height viewport unchanged", () => {
    expect(
      resolveAppHeight({
        standalone: true,
        isAppleMobile: true,
        screenHeight: 844,
        screenWidth: 390,
        innerWidth: 390,
        innerHeight: 844
      })
    ).toBe(844);
  });

  it("uses the short screen side as height in landscape", () => {
    expect(
      resolveAppHeight({
        standalone: true,
        isAppleMobile: true,
        screenHeight: 844,
        screenWidth: 390,
        innerWidth: 844,
        innerHeight: 390
      })
    ).toBe(390);
  });

  it("handles screen metrics that swap with orientation", () => {
    expect(
      resolveAppHeight({
        standalone: true,
        isAppleMobile: true,
        screenHeight: 390,
        screenWidth: 844,
        innerWidth: 844,
        innerHeight: 390
      })
    ).toBe(390);
  });

  it("returns null for invalid screen metrics", () => {
    expect(
      resolveAppHeight({
        standalone: true,
        isAppleMobile: true,
        screenHeight: 0,
        screenWidth: 0,
        innerWidth: 390,
        innerHeight: 797
      })
    ).toBeNull();
  });
});

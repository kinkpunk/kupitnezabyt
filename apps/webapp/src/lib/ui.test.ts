import { describe, expect, it } from "vitest";

import { itemStatusToUiStatus, nextUiStatus } from "./ui";

describe("itemStatusToUiStatus", () => {
  it("maps IN_STOCK to ok", () => {
    expect(itemStatusToUiStatus("IN_STOCK")).toBe("ok");
  });

  it("maps LOW to warn", () => {
    expect(itemStatusToUiStatus("LOW")).toBe("warn");
  });

  it("maps NEED_BUY and URGENT to bad", () => {
    expect(itemStatusToUiStatus("NEED_BUY")).toBe("bad");
    expect(itemStatusToUiStatus("URGENT")).toBe("bad");
  });

  it("maps PAUSED to null", () => {
    expect(itemStatusToUiStatus("PAUSED")).toBeNull();
  });
});

describe("nextUiStatus", () => {
  it("cycles ok -> warn -> bad -> ok", () => {
    expect(nextUiStatus("ok")).toBe("warn");
    expect(nextUiStatus("warn")).toBe("bad");
    expect(nextUiStatus("bad")).toBe("ok");
  });
});

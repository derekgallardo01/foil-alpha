import { describe, it, expect } from "vitest";
import { ok, fail } from "./api-response";

describe("api-response", () => {
  it("ok wraps the payload with success:true and defaults to 200", async () => {
    const res = ok({ data: [1, 2] });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: [1, 2] });
  });

  it("ok() with no payload is just { success: true }", async () => {
    expect(await ok().json()).toEqual({ success: true });
  });

  it("ok accepts a numeric status", () => {
    expect(ok({ data: {} }, 201).status).toBe(201);
  });

  it("fail sets success:false + error + status (default 400)", async () => {
    expect(fail("bad").status).toBe(400);
    const res = fail("nope", 404);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ success: false, error: "nope" });
  });
});

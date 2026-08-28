import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "./apiClient";

describe("apiRequest", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends the HttpOnly session cookie credentials", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    await apiRequest("/users/me");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ credentials: "include" });
  });
});

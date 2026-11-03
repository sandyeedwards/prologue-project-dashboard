import { afterEach, describe, expect, it, vi } from "vitest";
import { readOnlyFetch } from "./read-only-fetch";

afterEach(() => vi.unstubAllGlobals());

describe("vendor read retries", () => {
  it("recovers from rate limits and transient server errors", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response("busy", { status: 429, headers: { "Retry-After": "2" } }))
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(new Response('{"ok":true}'));
    vi.stubGlobal("fetch", fetcher);
    const pause = vi.fn().mockResolvedValue(undefined);
    const result = await readOnlyFetch("https://vendor.test/read", {}, { pause });
    expect(await result.json()).toEqual({ ok: true });
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(pause.mock.calls).toEqual([[2000], [2000]]);
    expect(fetcher.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it("does not retry authentication errors or shorten a long Retry-After", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response("unauthorized", { status: 401 }))
      .mockResolvedValueOnce(
        new Response("limit", { status: 429, headers: { "Retry-After": "120" } }),
      );
    vi.stubGlobal("fetch", fetcher);
    const pause = vi.fn();
    expect((await readOnlyFetch("https://vendor.test/read", {}, { pause })).status).toBe(401);
    expect((await readOnlyFetch("https://vendor.test/read", {}, { pause })).status).toBe(429);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(pause).not.toHaveBeenCalled();
  });

  it("bounds network retries and respects caller cancellation", async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError("network unavailable"));
    vi.stubGlobal("fetch", fetcher);
    const pause = vi.fn().mockResolvedValue(undefined);
    await expect(readOnlyFetch("https://vendor.test/read", {}, { pause })).rejects.toThrow(
      "network unavailable",
    );
    expect(fetcher).toHaveBeenCalledTimes(4);
    const aborted = AbortSignal.abort();
    await expect(
      readOnlyFetch("https://vendor.test/read", { signal: aborted }, { pause }),
    ).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(5);
  });
});

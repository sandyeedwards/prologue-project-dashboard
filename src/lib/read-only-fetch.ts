type RetryPolicy = {
  attempts?: number;
  timeoutMs?: number;
  pause?: (milliseconds: number) => Promise<void>;
};

// Only for vendor reads, including POST search/batch-read endpoints.
// Never use this helper for writes without an idempotency contract.
export async function readOnlyFetch(
  input: string | URL,
  init: RequestInit = {},
  policy: RetryPolicy = {},
): Promise<Response> {
  const attempts = policy.attempts ?? 4;
  const pause =
    policy.pause ??
    ((milliseconds) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const timeout = AbortSignal.timeout(policy.timeoutMs ?? 30000);
      const response = await fetch(input, {
        ...init,
        signal: init.signal ? AbortSignal.any([init.signal, timeout]) : timeout,
      });
      if (![429, 500, 502, 503, 504].includes(response.status) || attempt === attempts - 1)
        return response;
      const retryAfter = response.headers.get("retry-after");
      const seconds = retryAfter === null ? NaN : Number(retryAfter);
      const requestedDelay = Number.isFinite(seconds)
        ? seconds * 1000
        : retryAfter
          ? Date.parse(retryAfter) - Date.now()
          : 0;
      // Do not retry earlier than a vendor's requested long cooldown. Let the
      // job report the HTTP failure so its scheduler/operator can retry later.
      if (requestedDelay > 30000) return response;
      const delay = Math.min(Math.max(requestedDelay || 0, 1000 * 2 ** attempt), 30000);
      await response.body?.cancel();
      await pause(delay);
    } catch (error) {
      if (init.signal?.aborted || attempt === attempts - 1) throw error;
      await pause(Math.min(1000 * 2 ** attempt, 10000));
    }
  }
  throw new Error("Vendor read exhausted its retry attempts.");
}

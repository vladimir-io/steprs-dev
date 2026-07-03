type IdleDeadline = {
  didTimeout: boolean;
  timeRemaining: () => number;
};

type IdleRequestCallback = (deadline: IdleDeadline) => void;

type IdleRequestOptions = {
  timeout?: number;
};

/** Safari-safe wrapper — defers work without blocking parse startup. */
export function requestIdleCallback(
  callback: IdleRequestCallback,
  options?: IdleRequestOptions,
): number {
  if (typeof globalThis.requestIdleCallback === "function") {
    return globalThis.requestIdleCallback(callback, options);
  }

  let invoked = false;
  const start = Date.now();

  const invoke = (didTimeout: boolean) => {
    if (invoked) return;
    invoked = true;
    callback({
      didTimeout,
      timeRemaining: () => Math.max(0, 50 - (Date.now() - start)),
    });
  };

  const idleId = setTimeout(() => invoke(false), 1);

  if (options?.timeout != null) {
    setTimeout(() => invoke(true), options.timeout);
  }

  return idleId as unknown as number;
}

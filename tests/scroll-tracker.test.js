import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IDLE_TIMEOUT_MS } from '../src/shared/constants.js';

describe('scroll idle timing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('IDLE_TIMEOUT_MS is 60 seconds', () => {
    expect(IDLE_TIMEOUT_MS).toBe(60_000);
  });

  it('timer fires after idle period', () => {
    const callback = vi.fn();
    const timer = setTimeout(callback, IDLE_TIMEOUT_MS);

    // Not called yet
    vi.advanceTimersByTime(59_999);
    expect(callback).not.toHaveBeenCalled();

    // Called at 60s
    vi.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledOnce();

    clearTimeout(timer);
  });

  it('timer resets on new scroll', () => {
    const callback = vi.fn();
    let timer = setTimeout(callback, IDLE_TIMEOUT_MS);

    // Advance 30s, then "scroll" resets the timer
    vi.advanceTimersByTime(30_000);
    clearTimeout(timer);
    timer = setTimeout(callback, IDLE_TIMEOUT_MS);

    // Advance 59s from reset — should not fire
    vi.advanceTimersByTime(59_000);
    expect(callback).not.toHaveBeenCalled();

    // 1 more second — fires
    vi.advanceTimersByTime(1_000);
    expect(callback).toHaveBeenCalledOnce();

    clearTimeout(timer);
  });
});

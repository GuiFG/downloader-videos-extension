/**
 * Fragment Downloader Tests — TDD Phase 4
 * RED → GREEN → REFACTOR
 */

import { downloadFragments } from '../src/utils/fragment-downloader';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeFetchMock(resolveWith = null, rejectWith = null) {
  return jest.fn(() => {
    if (rejectWith) return Promise.reject(rejectWith);
    return Promise.resolve({
      ok: true,
      blob: () => Promise.resolve(resolveWith ?? new Blob(['data'], { type: 'video/mp2t' })),
    });
  });
}

/** Fetch mock that fails `failTimes` times, then succeeds */
function makeRetryFetchMock(failTimes, error = new Error('Network error')) {
  let calls = 0;
  return jest.fn(() => {
    calls++;
    if (calls <= failTimes) return Promise.reject(error);
    return Promise.resolve({
      ok: true,
      blob: () => Promise.resolve(new Blob(['ok'])),
    });
  });
}

/** Fetch mock that tracks max concurrent requests */
function makeConcurrencyTrackingMock(delayMs = 20) {
  let active = 0;
  let maxActive = 0;
  const mock = jest.fn(() => {
    active++;
    maxActive = Math.max(maxActive, active);
    return new Promise(resolve =>
      setTimeout(() => {
        active--;
        resolve({ ok: true, blob: () => Promise.resolve(new Blob(['seg'])) });
      }, delayMs),
    );
  });
  mock.getMaxActive = () => maxActive;
  return mock;
}

/** Fetch mock that never resolves, but respects abort signals */
function makeHangingFetchMock() {
  return jest.fn((_url, options = {}) =>
    new Promise((_resolve, reject) => {
      const signal = options?.signal;
      if (signal) {
        if (signal.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
        signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      }
    }),
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Fragment Downloader', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── 1. Basic: returns Blobs ────────────────────────────────────────────────

  test('returns array of Blobs for successful downloads', async () => {
    global.fetch = makeFetchMock();

    const urls = [
      'https://cdn.example.com/seg0.ts',
      'https://cdn.example.com/seg1.ts',
      'https://cdn.example.com/seg2.ts',
    ];

    const result = await downloadFragments(urls);

    expect(result.blobs).toHaveLength(3);
    result.blobs.forEach(b => expect(b).toBeInstanceOf(Blob));
    expect(result.failedUrls).toHaveLength(0);
    expect(result.errors).toEqual({});
  });

  test('returns empty blobs array when given empty URL list', async () => {
    global.fetch = jest.fn();

    const result = await downloadFragments([]);

    expect(result.blobs).toHaveLength(0);
    expect(result.failedUrls).toHaveLength(0);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  // ── 2. Result shape ────────────────────────────────────────────────────────

  test('returns {blobs, failedUrls, errors} shape', async () => {
    global.fetch = makeFetchMock();

    const result = await downloadFragments(['https://cdn.example.com/seg0.ts']);

    expect(result).toHaveProperty('blobs');
    expect(result).toHaveProperty('failedUrls');
    expect(result).toHaveProperty('errors');
    expect(Array.isArray(result.blobs)).toBe(true);
    expect(Array.isArray(result.failedUrls)).toBe(true);
    expect(typeof result.errors).toBe('object');
  });

  // ── 3. Parallelism ────────────────────────────────────────────────────────

  test('downloads multiple URLs concurrently up to maxParallel limit', async () => {
    const mockFetch = makeConcurrencyTrackingMock(30);
    global.fetch = mockFetch;

    const urls = Array.from({ length: 12 }, (_, i) => `https://cdn.example.com/seg${i}.ts`);
    await downloadFragments(urls, { maxParallel: 4 });

    const maxConcurrent = mockFetch.getMaxActive();
    expect(maxConcurrent).toBeGreaterThan(1);
    expect(maxConcurrent).toBeLessThanOrEqual(4);
  });

  test('dispatches all requests when maxParallel >= url count', async () => {
    const mockFetch = makeConcurrencyTrackingMock(10);
    global.fetch = mockFetch;

    const urls = ['a', 'b', 'c'].map(s => `https://cdn.example.com/${s}.ts`);
    await downloadFragments(urls, { maxParallel: 10 });

    expect(mockFetch.getMaxActive()).toBe(3);
  });

  // ── 4. Retry & exponential backoff ────────────────────────────────────────

  test('retries on failure and succeeds on subsequent attempt', async () => {
    global.fetch = makeRetryFetchMock(2); // fail twice, succeed on 3rd

    const result = await downloadFragments(
      ['https://cdn.example.com/seg0.ts'],
      { maxRetries: 3, retryDelay: 1 },
    );

    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(result.blobs).toHaveLength(1);
    expect(result.failedUrls).toHaveLength(0);
  });

  test('retries exactly maxRetries times before giving up (4 total calls for maxRetries=3)', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Always fails'));

    const result = await downloadFragments(
      ['https://cdn.example.com/seg0.ts'],
      { maxRetries: 3, retryDelay: 1 },
    );

    expect(global.fetch).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    expect(result.failedUrls).toHaveLength(1);
    expect(result.blobs).toHaveLength(0);
  });

  test('does not retry when maxRetries is 0', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('fail'));

    await downloadFragments(
      ['https://cdn.example.com/seg0.ts'],
      { maxRetries: 0, retryDelay: 1 },
    );

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  // ── 5. Timeout ────────────────────────────────────────────────────────────

  test('times out a hanging fragment after configured timeout', async () => {
    global.fetch = makeHangingFetchMock();

    const result = await downloadFragments(
      ['https://cdn.example.com/seg0.ts'],
      { timeout: 30, maxRetries: 0 },
    );

    expect(result.failedUrls).toHaveLength(1);
    expect(result.failedUrls[0]).toBe('https://cdn.example.com/seg0.ts');
  }, 2000);

  // ── 6. Progress callback ──────────────────────────────────────────────────

  test('calls onProgress(current, total, percent) for each completed fragment', async () => {
    global.fetch = makeFetchMock();
    const onProgress = jest.fn();

    const urls = [
      'https://cdn.example.com/seg0.ts',
      'https://cdn.example.com/seg1.ts',
      'https://cdn.example.com/seg2.ts',
    ];

    await downloadFragments(urls, { onProgress });

    expect(onProgress).toHaveBeenCalledTimes(3);
    // last call: current === total, percent === 100
    const lastCall = onProgress.mock.calls[onProgress.mock.calls.length - 1];
    expect(lastCall[0]).toBe(3); // current
    expect(lastCall[1]).toBe(3); // total
    expect(lastCall[2]).toBe(100); // percent
  });

  test('onProgress percent increases monotonically', async () => {
    global.fetch = makeFetchMock();
    const percents = [];
    const onProgress = (_c, _t, pct) => percents.push(pct);

    const urls = Array.from({ length: 5 }, (_, i) => `https://cdn.example.com/seg${i}.ts`);
    await downloadFragments(urls, { onProgress, maxParallel: 1 });

    for (let i = 1; i < percents.length; i++) {
      expect(percents[i]).toBeGreaterThanOrEqual(percents[i - 1]);
    }
    expect(percents[percents.length - 1]).toBe(100);
  });

  // ── 7. Partial failure ────────────────────────────────────────────────────

  test('failure of one fragment does not prevent others from downloading', async () => {
    const urls = [
      'https://cdn.example.com/seg0.ts',
      'https://cdn.example.com/seg1-BAD.ts',
      'https://cdn.example.com/seg2.ts',
    ];

    global.fetch = jest.fn((url) => {
      if (url.includes('BAD')) return Promise.reject(new Error('404'));
      return Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob(['ok'])) });
    });

    const result = await downloadFragments(urls, { maxRetries: 0 });

    expect(result.blobs).toHaveLength(2);
    expect(result.failedUrls).toEqual(['https://cdn.example.com/seg1-BAD.ts']);
    expect(result.errors['https://cdn.example.com/seg1-BAD.ts']).toBeDefined();
  });

  test('records error message for each failed fragment', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Connection refused'));

    const result = await downloadFragments(
      ['https://cdn.example.com/seg0.ts'],
      { maxRetries: 0 },
    );

    expect(result.errors['https://cdn.example.com/seg0.ts']).toBe('Connection refused');
  });

  test('handles non-ok HTTP response as failure', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 });

    const result = await downloadFragments(
      ['https://cdn.example.com/missing.ts'],
      { maxRetries: 0 },
    );

    expect(result.failedUrls).toHaveLength(1);
    expect(result.blobs).toHaveLength(0);
  });

  // ── 8. [REFACTOR] Performance ─────────────────────────────────────────────

  test('handles 1000 fragments without throwing', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['x'])),
    });

    const urls = Array.from({ length: 1000 }, (_, i) => `https://cdn.example.com/seg${i}.ts`);
    const result = await downloadFragments(urls, { maxParallel: 20 });

    expect(result.blobs).toHaveLength(1000);
    expect(result.failedUrls).toHaveLength(0);
  }, 15000);

  // ── 9. [REFACTOR] Fragment integrity ──────────────────────────────────────

  test('rejects fragments with size 0 (empty response)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob([])), // empty
    });

    const result = await downloadFragments(
      ['https://cdn.example.com/seg0.ts'],
      { maxRetries: 0, validateSize: true },
    );

    expect(result.failedUrls).toHaveLength(1);
  });

  test('accepts fragments when validateSize is false (default)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob([])),
    });

    const result = await downloadFragments(
      ['https://cdn.example.com/seg0.ts'],
      { maxRetries: 0, validateSize: false },
    );

    expect(result.blobs).toHaveLength(1);
  });
});

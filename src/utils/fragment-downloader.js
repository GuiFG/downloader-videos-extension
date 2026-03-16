/**
 * Fragment Downloader
 *
 * Downloads HLS/DASH fragments in parallel with retry and timeout support.
 *
 * Public API:
 *   downloadFragments(urls, options) → { blobs, failedUrls, errors }
 */

// ─── Internal helpers ────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Download a single fragment with retry and timeout.
 *
 * @param {string} url
 * @param {object} opts
 * @param {number} opts.maxRetries   - number of retries after initial attempt (default 3)
 * @param {number} opts.timeout      - per-attempt timeout in ms (default 30000)
 * @param {number} opts.retryDelay   - base exponential-backoff delay in ms (default 100)
 * @param {boolean} opts.validateSize - reject empty (0-byte) blobs (default false)
 * @returns {Promise<Blob>}
 */
async function downloadFragment(url, opts = {}) {
  const {
    maxRetries = 3,
    timeout = 30000,
    retryDelay = 100,
    validateSize = false,
  } = opts;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    let timeoutId;

    try {
      timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const blob = await response.blob();

      if (validateSize && blob.size === 0) {
        throw new Error('Empty fragment (0 bytes)');
      }

      return blob;
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err;

      if (attempt < maxRetries) {
        await sleep(Math.pow(2, attempt) * retryDelay);
      }
    }
  }

  throw lastError;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Download a list of fragment URLs in parallel.
 *
 * @param {string[]} urls
 * @param {object}   options
 * @param {number}   [options.maxRetries=3]     - retries per fragment
 * @param {number}   [options.timeout=30000]    - per-attempt timeout (ms)
 * @param {number}   [options.maxParallel=6]    - max concurrent downloads
 * @param {number}   [options.retryDelay=100]   - base backoff delay (ms)
 * @param {boolean}  [options.validateSize=false] - reject 0-byte blobs
 * @param {Function} [options.onProgress]       - (current, total, percent) => void
 * @returns {Promise<{blobs: Blob[], failedUrls: string[], errors: Object}>}
 */
export async function downloadFragments(urls, options = {}) {
  const {
    maxRetries = 3,
    timeout = 30000,
    maxParallel = 6,
    retryDelay = 100,
    validateSize = false,
    onProgress = null,
  } = options;

  if (urls.length === 0) {
    return { blobs: [], failedUrls: [], errors: {} };
  }

  const blobs = new Array(urls.length).fill(null);
  const failedUrls = [];
  const errors = {};
  let completed = 0;

  const fragmentOpts = { maxRetries, timeout, retryDelay, validateSize };

  // ── Pool-based concurrency control ──────────────────────────────────────────
  let nextIndex = 0;
  let activeCount = 0;

  await new Promise((resolve) => {
    const processNext = () => {
      if (nextIndex >= urls.length && activeCount === 0) {
        resolve();
        return;
      }

      while (activeCount < maxParallel && nextIndex < urls.length) {
        const index = nextIndex++;
        const url = urls[index];
        activeCount++;

        downloadFragment(url, fragmentOpts)
          .then((blob) => {
            blobs[index] = blob;
          })
          .catch((err) => {
            failedUrls.push(url);
            errors[url] = err.message || String(err);
          })
          .finally(() => {
            completed++;
            activeCount--;

            if (onProgress) {
              onProgress(
                completed,
                urls.length,
                Math.round((completed / urls.length) * 100),
              );
            }

            processNext();
          });
      }
    };

    processNext();
  });

  return {
    blobs: blobs.filter((b) => b !== null),
    failedUrls,
    errors,
  };
}

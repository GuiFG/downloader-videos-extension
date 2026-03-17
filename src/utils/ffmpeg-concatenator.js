/**
 * FFmpeg Concatenator
 * Concatenates video fragments (TS/M4S) into a single MP4 file using FFmpeg.wasm
 *
 * Features:
 * - Lazy-load FFmpeg.wasm to minimize memory footprint
 * - Support for Web Worker to avoid blocking main thread
 * - Progress callbacks for UI updates
 * - AbortSignal support for cancellation
 * - FFmpeg instance caching for reuse
 * - Support for TS (MPEG-TS) and M4S (ISO-BMFF) fragments
 */

const DEBUG = process.env.DEBUG_FFMPEG_CONCATENATOR === 'true';

let ffmpegInstance = null;
let ffmpegLoaded = false;
const SUPPORTED_OUTPUT_FORMATS = ['mp4', 'webm', 'matroska'];

const log = (message, data) => {
  if (DEBUG) {
    console.log(`[FFmpeg Concatenator] ${message}`, data || '');
  }
};

/**
 * Lazy-load FFmpeg.wasm
 * @returns {Promise<object>} FFmpeg instance
 */
async function loadFFmpeg() {
  if (ffmpegLoaded && ffmpegInstance) {
    log('Using cached FFmpeg instance');
    return ffmpegInstance;
  }

  log('Loading FFmpeg.wasm');

  try {
    const { FFmpeg, toBlobURL } = await import('@ffmpeg/ffmpeg');

    const ffmpeg = new FFmpeg();

    // Set up logging if debug enabled
    if (DEBUG) {
      ffmpeg.on('log', ({ message }) => {
        log('FFmpeg log:', message);
      });
    }

    const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm';

    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    ffmpegInstance = ffmpeg;
    ffmpegLoaded = true;

    log('FFmpeg loaded successfully');
    return ffmpeg;
  } catch (error) {
    log('Error loading FFmpeg:', error);
    throw new Error(`Failed to load FFmpeg: ${error.message}`);
  }
}

/**
 * Validate fragment array
 * @param {Array<Blob>} fragments - Array of blob fragments
 * @returns {boolean} True if valid
 * @throws {Error} If validation fails
 */
export function validateFragments(fragments) {
  if (!Array.isArray(fragments)) {
    throw new Error('Fragments must be an array');
  }

  if (fragments.length === 0) {
    throw new Error('Fragments array cannot be empty');
  }

  for (const fragment of fragments) {
    if (!(fragment instanceof Blob)) {
      throw new Error('All fragments must be Blob instances');
    }
  }

  return true;
}

/**
 * Detect fragment type from MIME type
 * @param {string} mimeType - MIME type of fragment
 * @returns {string} Fragment type: 'ts', 'm4s', 'mp4', etc.
 */
function detectFragmentType(mimeType) {
  if (mimeType.includes('mp2t') || mimeType.includes('mpeg-ts')) {
    return 'ts';
  }
  if (mimeType.includes('iso.segment') || mimeType.includes('m4s')) {
    return 'm4s';
  }
  if (mimeType.includes('mp4')) {
    return 'mp4';
  }
  return 'unknown';
}

/**
 * Concatenate fragments into single output file
 * @param {Array<Blob>} blobs - Array of fragment blobs
 * @param {string} outputFormat - Output format: 'mp4', 'webm', 'matroska'
 * @param {object} options - Options: {onProgress, signal, useWorker, timeout}
 * @returns {Promise<Blob>} Concatenated output blob
 */
export async function concatenateFragments(blobs, outputFormat, options = {}) {
  // Validate inputs
  validateFragments(blobs);

  if (!SUPPORTED_OUTPUT_FORMATS.includes(outputFormat)) {
    throw new Error(
      `Unsupported output format: ${outputFormat}. Supported: ${SUPPORTED_OUTPUT_FORMATS.join(', ')}`
    );
  }

  const {
    onProgress = null,
    signal = null,
    timeout = 120000,
  } = options;

  // Check abort signal
  if (signal?.aborted) {
    throw new Error('Operation aborted');
  }

  log(`Concatenating ${blobs.length} fragments to ${outputFormat}`);

  // Report initial progress
  if (onProgress) {
    onProgress(0);
  }

  try {
    // Load FFmpeg
    const ffmpeg = await loadFFmpeg();

    // Check abort after async operation
    if (signal?.aborted) {
      throw new Error('Operation aborted');
    }

    // Create file list for concatenation
    const inputFiles = [];

    // Write input files to FFmpeg file system
    for (let i = 0; i < blobs.length; i++) {
      let data;
      // Handle both Node.js and browser Blob APIs
      if (blobs[i].arrayBuffer && typeof blobs[i].arrayBuffer === 'function') {
        data = await blobs[i].arrayBuffer();
      } else if (typeof FileReader !== 'undefined') {
        // Fallback for older browser APIs
        data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsArrayBuffer(blobs[i]);
        });
      } else {
        // Direct conversion for testing
        const buffer = await blobs[i].stream();
        data = await buffer;
      }

      const fragType = detectFragmentType(blobs[i].type || '');
      const ext = fragType === 'm4s' ? 'm4s' : 'ts';
      const filename = `input_${i}.${ext}`;
      ffmpeg.writeFile(filename, new Uint8Array(data));
      inputFiles.push(filename);

      if (onProgress) {
        onProgress(Math.round((i / blobs.length) * 50));
      }

      if (signal?.aborted) {
        throw new Error('Operation aborted');
      }
    }

    // Create concat demuxer file
    const concatFile = 'concat.txt';
    const concatContent = inputFiles.map(f => `file '${f}'`).join('\n');
    ffmpeg.writeFile(concatFile, new Uint8Array(new TextEncoder().encode(concatContent)));

    if (onProgress) {
      onProgress(60);
    }

    // Run FFmpeg command
    const outputFile = `output.${outputFormat === 'webm' ? 'webm' : 'mp4'}`;
    const args = [
      '-f', 'concat',
      '-safe', '0',
      '-i', concatFile,
      '-c', 'copy',
      outputFile,
    ];

    log('Executing FFmpeg with args:', args);

    // Execute with timeout
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('FFmpeg operation timeout')), timeout)
    );

    const executePromise = ffmpeg.exec(...args);

    await Promise.race([executePromise, timeoutPromise]);

    if (onProgress) {
      onProgress(90);
    }

    if (signal?.aborted) {
      throw new Error('Operation aborted');
    }

    // Read output file
    const outputData = ffmpeg.readFile(outputFile);

    if (onProgress) {
      onProgress(95);
    }

    // Clean up input files
    for (const file of inputFiles) {
      ffmpeg.deleteFile(file);
    }
    ffmpeg.deleteFile(concatFile);

    // Create output blob
    const outputBlob = new Blob([outputData], { type: `video/${outputFormat}` });

    if (onProgress) {
      onProgress(100);
    }

    log(`Concatenation complete. Output size: ${outputBlob.size} bytes`);

    return outputBlob;
  } catch (error) {
    log('Error during concatenation:', error);

    if (error.message.includes('aborted')) {
      throw new DOMException('The operation was aborted', 'AbortError');
    }

    throw new Error(`Concatenation failed: ${error.message}`);
  }
}

/**
 * Clear FFmpeg instance cache
 * Use when you want to free memory or reset state
 */
export function clearFFmpegCache() {
  ffmpegInstance = null;
  ffmpegLoaded = false;
  log('FFmpeg cache cleared');
}

/**
 * Check if AbortSignal is supported
 * @returns {boolean} True if AbortController/AbortSignal supported
 */
export function supportsAbortSignal() {
  return typeof AbortController !== 'undefined' && typeof AbortSignal !== 'undefined';
}

/**
 * Get FFmpeg instance (for advanced use cases)
 * @returns {Promise<object|null>} FFmpeg instance or null if not loaded
 */
export async function getFFmpegInstance() {
  if (ffmpegLoaded) {
    return ffmpegInstance;
  }
  return null;
}

export default {
  concatenateFragments,
  validateFragments,
  clearFFmpegCache,
  supportsAbortSignal,
  getFFmpegInstance,
};

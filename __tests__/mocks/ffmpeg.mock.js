/**
 * FFmpeg.wasm Mock for testing
 * Provides a mock implementation of @ffmpeg/ffmpeg API
 */

export const createFFmpegMock = () => {
  const fileSystem = new Map();
  let isLoaded = false;

  return {
    FFmpeg: class MockFFmpeg {
      constructor() {
        this.isLoaded = isLoaded;
      }

      async load(_config = {}) {
        isLoaded = true;
        this.isLoaded = true;
        return Promise.resolve();
      }

      async exec(..._args) {
        // Simulate successful FFmpeg execution
        // Returns exit code 0 for success
        return 0;
      }

      writeFile(filename, data) {
        fileSystem.set(filename, data);
      }

      readFile(filename) {
        return fileSystem.get(filename) || new Uint8Array();
      }

      deleteFile(filename) {
        fileSystem.delete(filename);
      }

      listFiles() {
        return Array.from(fileSystem.keys());
      }

      async transcode(input, output, _options = {}) {
        // Simulate transcoding
        const outputData = new Uint8Array(1024); // Mock output
        fileSystem.set(output, outputData);
        return { exitCode: 0 };
      }
    },

    toBlobURL(_data, _mimeType) {
      // Create a mock blob URL
      return `blob:mock-${Math.random().toString(36).substr(2, 9)}`;
    },
  };
};

export const createFFmpegProgressMock = () => {
  const progressCallbacks = [];

  return {
    onProgress: (callback) => {
      progressCallbacks.push(callback);
    },

    triggerProgress: (progress) => {
      progressCallbacks.forEach(cb => cb(progress));
    },

    clearCallbacks: () => {
      progressCallbacks.length = 0;
    },
  };
};

export default createFFmpegMock();

/**
 * Debug Logger Tests
 *
 * Tests for the video detection debug logging utility
 */

describe('Debug Logger', () => {
  // Save original environment
  const originalEnv = process.env.DEBUG_VIDEO_DETECTION;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    console.log.mockRestore();
    process.env.DEBUG_VIDEO_DETECTION = originalEnv;
  });

  describe('isDebugEnabled()', () => {
    test('should return true when DEBUG_VIDEO_DETECTION is "true"', () => {
      process.env.DEBUG_VIDEO_DETECTION = 'true';
      // Re-import to get new value
      jest.resetModules();
      const { isDebugEnabled: newIsDebugEnabled } = require('../src/utils/debug-logger');
      expect(newIsDebugEnabled()).toBe(true);
    });

    test('should return false when DEBUG_VIDEO_DETECTION is not set', () => {
      delete process.env.DEBUG_VIDEO_DETECTION;
      jest.resetModules();
      const { isDebugEnabled: newIsDebugEnabled } = require('../src/utils/debug-logger');
      expect(newIsDebugEnabled()).toBe(false);
    });

    test('should return false when DEBUG_VIDEO_DETECTION is "false"', () => {
      process.env.DEBUG_VIDEO_DETECTION = 'false';
      jest.resetModules();
      const { isDebugEnabled: newIsDebugEnabled } = require('../src/utils/debug-logger');
      expect(newIsDebugEnabled()).toBe(false);
    });
  });

  describe('logDetectionAttempt()', () => {
    beforeEach(() => {
      process.env.DEBUG_VIDEO_DETECTION = 'true';
      jest.resetModules();
    });

    test('should log all detection attempts', () => {
      const { logDetectionAttempt: logAttempt } = require('../src/utils/debug-logger');
      const url = 'https://example.com/video.mp4';
      const attempts = {
        extension: { matched: true },
        pattern: { matched: false, reason: 'no pattern match' },
        contentType: { matched: false, reason: 'not media type' },
      };

      logAttempt(url, 'service-worker', attempts);

      expect(console.log).toHaveBeenCalled();
      const callArgs = console.log.mock.calls[0];
      expect(callArgs[0]).toContain('Video Detection Attempts');
      expect(callArgs[0]).toContain(url);
      expect(callArgs[1]).toContain('extension: ✓ matched');
    });

    test('should not log when DEBUG_VIDEO_DETECTION is false', () => {
      process.env.DEBUG_VIDEO_DETECTION = 'false';
      jest.resetModules();
      const { logDetectionAttempt: logAttempt } = require('../src/utils/debug-logger');

      logAttempt('https://example.com/video.mp4', 'service-worker', {
        extension: { matched: true },
      });

      expect(console.log).not.toHaveBeenCalled();
    });

    test('should include timestamp in log', () => {
      const { logDetectionAttempt: logAttempt } = require('../src/utils/debug-logger');
      const url = 'https://example.com/video.mp4';

      logAttempt(url, 'service-worker', { extension: { matched: true } });

      const callArgs = console.log.mock.calls[0][0];
      // Check for ISO timestamp format
      expect(callArgs).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/);
    });

    test('should include source in log', () => {
      const { logDetectionAttempt: logAttempt } = require('../src/utils/debug-logger');

      logAttempt('https://example.com/video.mp4', 'content-script', {});

      const callArgs = console.log.mock.calls[0][0];
      expect(callArgs).toContain('content-script');
    });
  });

  describe('logDetectionSuccess()', () => {
    beforeEach(() => {
      process.env.DEBUG_VIDEO_DETECTION = 'true';
      jest.resetModules();
    });

    test('should log successful detection with all details', () => {
      const { logDetectionSuccess: logSuccess } = require('../src/utils/debug-logger');
      const url = 'https://example.com/video.mp4';
      const type = 'video';
      const method = 'extension';

      logSuccess(url, type, method, 'service-worker');

      expect(console.log).toHaveBeenCalled();
      const callArgs = console.log.mock.calls[0];
      expect(callArgs[0]).toContain('✓ Video Detected');
      expect(callArgs[0]).toContain(url);
      expect(callArgs[1]).toEqual({ type, method });
    });

    test('should include timestamp in success log', () => {
      const { logDetectionSuccess: logSuccess } = require('../src/utils/debug-logger');

      logSuccess('https://example.com/video.mp4', 'video', 'extension', 'service-worker');

      const callArgs = console.log.mock.calls[0][0];
      expect(callArgs).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/);
    });

    test('should not log when debug is disabled', () => {
      process.env.DEBUG_VIDEO_DETECTION = 'false';
      jest.resetModules();
      const { logDetectionSuccess: logSuccess } = require('../src/utils/debug-logger');

      logSuccess('https://example.com/video.mp4', 'video', 'extension', 'service-worker');

      expect(console.log).not.toHaveBeenCalled();
    });
  });

  describe('logDetectionFailure()', () => {
    beforeEach(() => {
      process.env.DEBUG_VIDEO_DETECTION = 'true';
      jest.resetModules();
    });

    test('should log detection failure', () => {
      const { logDetectionFailure: logFailure } = require('../src/utils/debug-logger');
      const url = 'https://example.com/unknown';

      logFailure(url, 'service-worker', 'no matching method');

      expect(console.log).toHaveBeenCalled();
      const callArgs = console.log.mock.calls[0];
      expect(callArgs[0]).toContain('✗ Detection Failed');
      expect(callArgs[0]).toContain(url);
      expect(callArgs[1]).toEqual({ reason: 'no matching method' });
    });

    test('should use default reason if not provided', () => {
      const { logDetectionFailure: logFailure } = require('../src/utils/debug-logger');

      logFailure('https://example.com/unknown', 'service-worker');

      const callArgs = console.log.mock.calls[0];
      expect(callArgs[1]).toEqual({ reason: 'no matching method' });
    });

    test('should not log when debug is disabled', () => {
      process.env.DEBUG_VIDEO_DETECTION = 'false';
      jest.resetModules();
      const { logDetectionFailure: logFailure } = require('../src/utils/debug-logger');

      logFailure('https://example.com/unknown', 'service-worker');

      expect(console.log).not.toHaveBeenCalled();
    });
  });

  describe('logDebug()', () => {
    beforeEach(() => {
      process.env.DEBUG_VIDEO_DETECTION = 'true';
      jest.resetModules();
    });

    test('should log debug message with data', () => {
      const { logDebug: log } = require('../src/utils/debug-logger');
      const message = 'Test message';
      const data = { key: 'value' };

      log(message, data, 'test-source');

      expect(console.log).toHaveBeenCalled();
      const callArgs = console.log.mock.calls[0];
      expect(callArgs[0]).toContain(message);
      expect(callArgs[0]).toContain('test-source');
      expect(callArgs[1]).toEqual(data);
    });

    test('should use default source if not provided', () => {
      const { logDebug: log } = require('../src/utils/debug-logger');

      log('Test message', { data: 'value' });

      const callArgs = console.log.mock.calls[0][0];
      expect(callArgs).toContain('video-detection');
    });

    test('should handle empty data', () => {
      const { logDebug: log } = require('../src/utils/debug-logger');

      log('Test message', null, 'test-source');

      expect(console.log).toHaveBeenCalled();
      const callArgs = console.log.mock.calls[0];
      expect(callArgs[0]).toContain('Test message');
    });

    test('should not log when debug is disabled', () => {
      process.env.DEBUG_VIDEO_DETECTION = 'false';
      jest.resetModules();
      const { logDebug: log } = require('../src/utils/debug-logger');

      log('Test message', {}, 'test-source');

      expect(console.log).not.toHaveBeenCalled();
    });
  });

  describe('Performance - no impact when disabled', () => {
    beforeEach(() => {
      process.env.DEBUG_VIDEO_DETECTION = 'false';
      jest.resetModules();
    });

    test('should not execute logging code when disabled', () => {
      const { logDetectionAttempt: logAttempt } = require('../src/utils/debug-logger');
      console.log.mockImplementation(() => {
        throw new Error('Should not be called');
      });

      // This should not throw because logging is disabled
      expect(() => {
        logAttempt('https://example.com/video.mp4', 'service-worker', {
          extension: { matched: true },
        });
      }).not.toThrow();
    });
  });
});

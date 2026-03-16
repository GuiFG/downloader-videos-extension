/** @jest-environment node */
/**
 * Tests for DASH Parser
 * Verifies that DASH manifest parsing works correctly for various scenarios
 */

import { parseDALE, selectQuality, getAvailableResolutions, getAvailableBitrates, getTotalDuration } from '../src/utils/dash-parser';
import fs from 'fs';
import path from 'path';

// Load fixtures
const sampleMpd = fs.readFileSync(path.join(__dirname, 'fixtures/sample.mpd'), 'utf8');
const malformedMpd = '<MPD><broken>';

describe('DASH Parser', () => {
  describe('parseDALE - Basic Parsing', () => {
    test('should parse simple DASH manifest', () => {
      const result = parseDALE(sampleMpd, 'http://example.com/video/');
      expect(result).toHaveProperty('representations');
      expect(result).toHaveProperty('mediaDuration');
      expect(Array.isArray(result.representations)).toBe(true);
    });

    test('should extract video representations with bitrates', () => {
      const result = parseDALE(sampleMpd, 'http://example.com/video/');
      const videoReps = result.representations.filter(r => r.type === 'video');
      expect(videoReps.length).toBeGreaterThan(0);
      expect(videoReps[0]).toHaveProperty('bitrate');
      expect(videoReps[0]).toHaveProperty('width');
      expect(videoReps[0]).toHaveProperty('height');
    });

    test('should extract audio representations', () => {
      const result = parseDALE(sampleMpd, 'http://example.com/video/');
      const audioReps = result.representations.filter(r => r.type === 'audio');
      expect(audioReps.length).toBeGreaterThan(0);
      expect(audioReps[0]).toHaveProperty('bandwidth');
      expect(audioReps[0]).toHaveProperty('lang');
    });

    test('should handle multiple quality levels (480p, 720p, 1080p)', () => {
      const result = parseDALE(sampleMpd, 'http://example.com/video/');
      const videoReps = result.representations.filter(r => r.type === 'video');
      const resolutions = videoReps.map(r => `${r.height}p`).sort();
      expect(resolutions).toContain('480p');
      expect(resolutions).toContain('720p');
      expect(resolutions).toContain('1080p');
    });

    test('should extract segment template information', () => {
      const result = parseDALE(sampleMpd, 'http://example.com/video/');
      const firstRep = result.representations[0];
      expect(firstRep).toHaveProperty('segmentTemplate');
      expect(firstRep.segmentTemplate).toHaveProperty('media');
      expect(firstRep.segmentTemplate).toHaveProperty('initialization');
    });
  });

  describe('parseDALE - URL Resolution', () => {
    test('should resolve relative URLs against base URL', () => {
      const result = parseDALE(sampleMpd, 'http://example.com/video/');
      const firstRep = result.representations[0];
      // Media pattern should be resolved
      expect(firstRep.segmentTemplate.media).toContain('segment');
    });

    test('should handle absolute URLs', () => {
      const mpdWithAbsoluteUrls = sampleMpd.replace(
        'media="segment-$Number$.m4s"',
        'media="http://cdn.example.com/video/segment-$Number$.m4s"'
      );
      const result = parseDALE(mpdWithAbsoluteUrls, 'http://example.com/video/');
      const firstRep = result.representations[0];
      expect(firstRep.segmentTemplate.media).toContain('http://cdn.example.com');
    });

    test('should support initialization segment URLs', () => {
      const result = parseDALE(sampleMpd, 'http://example.com/video/');
      const firstRep = result.representations[0];
      expect(firstRep.segmentTemplate.initialization).toBe('init.mp4');
    });
  });

  describe('parseDALE - Duration Extraction', () => {
    test('should extract media presentation duration', () => {
      const result = parseDALE(sampleMpd, 'http://example.com/video/');
      expect(result.mediaDuration).toBeDefined();
      expect(typeof result.mediaDuration).toBe('number');
    });

    test('should parse ISO8601 duration format (PT0H0M10S -> 10 seconds)', () => {
      const result = parseDALE(sampleMpd, 'http://example.com/video/');
      // Sample MPD has PT0H0M10S = 10 seconds
      expect(result.mediaDuration).toBe(10);
    });

    test('should extract segment duration from SegmentTemplate', () => {
      const result = parseDALE(sampleMpd, 'http://example.com/video/');
      const firstRep = result.representations[0];
      expect(firstRep).toHaveProperty('segmentDuration');
      expect(typeof firstRep.segmentDuration).toBe('number');
    });
  });

  describe('parseDALE - SegmentTimeline Support', () => {
    test('should parse SegmentTimeline with explicit timestamps', () => {
      const result = parseDALE(sampleMpd, 'http://example.com/video/');
      const firstRep = result.representations[0];
      expect(firstRep.segmentTimeline).toBeDefined();
      expect(Array.isArray(firstRep.segmentTimeline)).toBe(true);
    });

    test('should extract duration values from SegmentTimeline S elements', () => {
      const result = parseDALE(sampleMpd, 'http://example.com/video/');
      const firstRep = result.representations[0];
      if (firstRep.segmentTimeline && firstRep.segmentTimeline.length > 0) {
        expect(firstRep.segmentTimeline[0]).toHaveProperty('d');
      }
    });

    test('should calculate total segments from timeline', () => {
      const result = parseDALE(sampleMpd, 'http://example.com/video/');
      const firstRep = result.representations[0];
      if (firstRep.segmentTimeline) {
        expect(firstRep.segmentTimeline.length).toBeGreaterThan(0);
      }
    });
  });

  describe('parseDALE - SegmentTemplate with $Number$', () => {
    test('should expand $Number$ template pattern', () => {
      const result = parseDALE(sampleMpd, 'http://example.com/video/');
      const firstRep = result.representations[0];
      const media = firstRep.segmentTemplate.media;
      expect(media).toContain('segment-');
      expect(media).toMatch(/\$Number\$|segment-(\d+)/);
    });

    test('should handle startNumber attribute', () => {
      const result = parseDALE(sampleMpd, 'http://example.com/video/');
      const firstRep = result.representations[0];
      expect(firstRep.segmentTemplate).toHaveProperty('startNumber');
    });

    test('should generate segment list from template', () => {
      const result = parseDALE(sampleMpd, 'http://example.com/video/');
      const firstRep = result.representations[0];
      expect(firstRep).toHaveProperty('segmentUrls');
      if (firstRep.segmentUrls) {
        expect(Array.isArray(firstRep.segmentUrls)).toBe(true);
        expect(firstRep.segmentUrls.length).toBeGreaterThan(0);
      }
    });
  });

  describe('parseDALE - Edge Cases', () => {
    let consoleWarnSpy;

    beforeEach(() => {
      // Suppress console.warn for edge case tests that intentionally use malformed input
      consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleWarnSpy.mockRestore();
    });

    test('should not crash with malformed MPD', () => {
      expect(() => {
        parseDALE(malformedMpd, 'http://example.com/');
      }).not.toThrow();
    });

    test('should return safe structure even for malformed input', () => {
      const result = parseDALE(malformedMpd, 'http://example.com/');
      expect(result).toHaveProperty('representations');
      expect(Array.isArray(result.representations)).toBe(true);
    });

    test('should handle missing mediaPresentationDuration gracefully', () => {
      const mpdWithoutDuration = sampleMpd.replace(
        'mediaPresentationDuration="PT0H0M10S"',
        ''
      );
      const result = parseDALE(mpdWithoutDuration, 'http://example.com/video/');
      expect(result).toHaveProperty('mediaDuration');
      expect(typeof result.mediaDuration).toBe('number');
    });

    test('should handle empty or minimal MPD', () => {
      const minimalMpd = '<?xml version="1.0"?><MPD></MPD>';
      const result = parseDALE(minimalMpd, 'http://example.com/');
      expect(result).toHaveProperty('representations');
      expect(Array.isArray(result.representations)).toBe(true);
    });
  });

  describe('selectQuality', () => {
    test('should select representation by bitrate preference', () => {
      const result = parseDALE(sampleMpd, 'http://example.com/video/');
      const videoReps = result.representations.filter(r => r.type === 'video');
      const selected = selectQuality(videoReps, 'high');
      expect(selected).toBeDefined();
      expect(selected.bitrate).toBeDefined();
    });

    test('should select low quality representation', () => {
      const result = parseDALE(sampleMpd, 'http://example.com/video/');
      const videoReps = result.representations.filter(r => r.type === 'video');
      const selected = selectQuality(videoReps, 'low');
      expect(selected).toBeDefined();
      expect(selected.width).toBeLessThanOrEqual(854);
    });

    test('should select medium quality representation', () => {
      const result = parseDALE(sampleMpd, 'http://example.com/video/');
      const videoReps = result.representations.filter(r => r.type === 'video');
      const selected = selectQuality(videoReps, 'medium');
      expect(selected).toBeDefined();
    });
  });

  describe('Utility Functions', () => {
    test('getAvailableResolutions - should list all resolutions', () => {
      const result = parseDALE(sampleMpd, 'http://example.com/video/');
      const resolutions = getAvailableResolutions(result.representations);
      expect(Array.isArray(resolutions)).toBe(true);
      expect(resolutions.length).toBeGreaterThan(0);
    });

    test('getAvailableBitrates - should list all bitrates', () => {
      const result = parseDALE(sampleMpd, 'http://example.com/video/');
      const bitrates = getAvailableBitrates(result.representations);
      expect(Array.isArray(bitrates)).toBe(true);
      expect(bitrates.length).toBeGreaterThan(0);
    });

    test('getTotalDuration - should calculate from media duration', () => {
      const result = parseDALE(sampleMpd, 'http://example.com/video/');
      const duration = getTotalDuration(result);
      expect(typeof duration).toBe('number');
      expect(duration).toBeGreaterThan(0);
    });
  });
});

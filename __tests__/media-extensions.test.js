/**
 * Phase 1: [RED] Media Extensions Tests
 * 
 * Estes testes definem o comportamento esperado para detecção de tipos de mídia.
 * EXPECTATIVA: Todos os testes FALHAM porque o módulo não existe ainda.
 */

import {
  isMediaURL,
  getMediaType,
  cleanUrl,
  MEDIA_EXTENSIONS,
} from '../src/utils/media-extensions';

describe('Media Extensions', () => {
  describe('MEDIA_EXTENSIONS constant', () => {
    test('should export MEDIA_EXTENSIONS object', () => {
      expect(MEDIA_EXTENSIONS).toBeDefined();
      expect(typeof MEDIA_EXTENSIONS).toBe('object');
    });

    test('should contain audio extensions', () => {
      expect(MEDIA_EXTENSIONS.audio).toBeDefined();
      expect(Array.isArray(MEDIA_EXTENSIONS.audio)).toBe(true);
    });

    test('should contain video extensions', () => {
      expect(MEDIA_EXTENSIONS.video).toBeDefined();
      expect(Array.isArray(MEDIA_EXTENSIONS.video)).toBe(true);
    });

    test('should contain hls extensions', () => {
      expect(MEDIA_EXTENSIONS.hls).toBeDefined();
      expect(Array.isArray(MEDIA_EXTENSIONS.hls)).toBe(true);
    });

    test('should contain dash extensions', () => {
      expect(MEDIA_EXTENSIONS.dash).toBeDefined();
      expect(Array.isArray(MEDIA_EXTENSIONS.dash)).toBe(true);
    });

    test('should contain stream extensions', () => {
      expect(MEDIA_EXTENSIONS.stream).toBeDefined();
      expect(Array.isArray(MEDIA_EXTENSIONS.stream)).toBe(true);
    });
  });

  describe('isMediaURL(url)', () => {
    describe('should return true for video extensions', () => {
      test('.mp4 returns true', () => {
        expect(isMediaURL('video.mp4')).toBe(true);
        expect(isMediaURL('https://example.com/video.mp4')).toBe(true);
        expect(isMediaURL('https://example.com/video.mp4?token=xyz')).toBe(true);
      });

      test('.webm returns true', () => {
        expect(isMediaURL('video.webm')).toBe(true);
      });

      test('.mov returns true', () => {
        expect(isMediaURL('video.mov')).toBe(true);
      });

      test('.mkv returns true', () => {
        expect(isMediaURL('video.mkv')).toBe(true);
      });
    });

    describe('should return true for HLS extensions', () => {
      test('.m3u8 returns true', () => {
        expect(isMediaURL('playlist.m3u8')).toBe(true);
        expect(isMediaURL('https://example.com/playlist.m3u8')).toBe(true);
      });

      test('.ts (segment) returns true', () => {
        expect(isMediaURL('segment.ts')).toBe(true);
      });
    });

    describe('should return true for DASH extensions', () => {
      test('.mpd returns true', () => {
        expect(isMediaURL('manifest.mpd')).toBe(true);
        expect(isMediaURL('https://example.com/manifest.mpd')).toBe(true);
      });

      test('.m4s (segment) returns true', () => {
        expect(isMediaURL('segment.m4s')).toBe(true);
      });
    });

    describe('should handle case-insensitivity', () => {
      test('.MP4 (uppercase) returns true', () => {
        expect(isMediaURL('VIDEO.MP4')).toBe(true);
      });

      test('.M3U8 (uppercase) returns true', () => {
        expect(isMediaURL('PLAYLIST.M3U8')).toBe(true);
      });

      test('mixed case returns true', () => {
        expect(isMediaURL('Video.Mp4')).toBe(true);
      });
    });

    describe('should return false for non-media extensions', () => {
      test('.txt returns false', () => {
        expect(isMediaURL('document.txt')).toBe(false);
      });

      test('.html returns false', () => {
        expect(isMediaURL('page.html')).toBe(false);
      });

      test('.js returns false', () => {
        expect(isMediaURL('script.js')).toBe(false);
      });

      test('.json returns false', () => {
        expect(isMediaURL('data.json')).toBe(false);
      });

      test('no extension returns false', () => {
        expect(isMediaURL('example')).toBe(false);
      });
    });

    describe('should handle URLs with query parameters', () => {
      test('video.mp4?token=abc123 returns true', () => {
        expect(isMediaURL('video.mp4?token=abc123')).toBe(true);
      });

      test('https://cdn.example.com/video.mp4?v=1&format=hq returns true', () => {
        expect(isMediaURL('https://cdn.example.com/video.mp4?v=1&format=hq')).toBe(true);
      });

      test('playlist.m3u8?auth=token returns true', () => {
        expect(isMediaURL('playlist.m3u8?auth=token')).toBe(true);
      });
    });

    describe('should handle URLs with fragments', () => {
      test('video.mp4#t=10 returns true', () => {
        expect(isMediaURL('video.mp4#t=10')).toBe(true);
      });

      test('https://example.com/video.mp4#section1 returns true', () => {
        expect(isMediaURL('https://example.com/video.mp4#section1')).toBe(true);
      });
    });
  });

  describe('getMediaType(url)', () => {
    describe('HLS type', () => {
      test('.m3u8 returns "hls"', () => {
        expect(getMediaType('playlist.m3u8')).toBe('hls');
        expect(getMediaType('https://example.com/stream.m3u8')).toBe('hls');
      });

      test('.m3u8?params returns "hls"', () => {
        expect(getMediaType('playlist.m3u8?token=xyz')).toBe('hls');
      });
    });

    describe('DASH type', () => {
      test('.mpd returns "dash"', () => {
        expect(getMediaType('manifest.mpd')).toBe('dash');
        expect(getMediaType('https://example.com/stream.mpd')).toBe('dash');
      });

      test('.mpd?params returns "dash"', () => {
        expect(getMediaType('manifest.mpd?v=1')).toBe('dash');
      });
    });

    describe('Video type', () => {
      test('.mp4 returns "video"', () => {
        expect(getMediaType('video.mp4')).toBe('video');
        expect(getMediaType('https://example.com/movie.mp4')).toBe('video');
      });

      test('.webm returns "video"', () => {
        expect(getMediaType('video.webm')).toBe('video');
      });

      test('.mov returns "video"', () => {
        expect(getMediaType('video.mov')).toBe('video');
      });
    });

    describe('Stream segment type', () => {
      test('.ts returns "stream"', () => {
        expect(getMediaType('segment.ts')).toBe('stream');
      });

      test('.m4s returns "stream"', () => {
        expect(getMediaType('segment.m4s')).toBe('stream');
      });
    });

    describe('Unknown type', () => {
      test('non-media URL returns "unknown"', () => {
        expect(getMediaType('document.pdf')).toBe('unknown');
        expect(getMediaType('file.txt')).toBe('unknown');
      });

      test('URL without extension returns "unknown"', () => {
        expect(getMediaType('https://example.com/media')).toBe('unknown');
      });
    });

    describe('case-insensitivity', () => {
      test('uppercase extension returns correct type', () => {
        expect(getMediaType('VIDEO.MP4')).toBe('video');
        expect(getMediaType('PLAYLIST.M3U8')).toBe('hls');
        expect(getMediaType('MANIFEST.MPD')).toBe('dash');
      });
    });
  });

  describe('cleanUrl(url)', () => {
    test('should remove query parameters', () => {
      expect(cleanUrl('https://example.com/video.mp4?token=xyz')).toBe('https://example.com/video.mp4');
      expect(cleanUrl('video.mp4?v=1&format=hq')).toBe('video.mp4');
    });

    test('should remove fragments', () => {
      expect(cleanUrl('https://example.com/video.mp4#t=10')).toBe('https://example.com/video.mp4');
      expect(cleanUrl('video.mp4#section')).toBe('video.mp4');
    });

    test('should remove both query parameters and fragments', () => {
      expect(cleanUrl('https://example.com/video.mp4?token=xyz#t=10')).toBe('https://example.com/video.mp4');
    });

    test('should return clean URL if no query or fragments', () => {
      expect(cleanUrl('https://example.com/video.mp4')).toBe('https://example.com/video.mp4');
      expect(cleanUrl('video.mp4')).toBe('video.mp4');
    });

    test('should handle edge cases', () => {
      expect(cleanUrl('')).toBe('');
      expect(cleanUrl('?query')).toBe('');
      expect(cleanUrl('#fragment')).toBe('');
    });
  });
});

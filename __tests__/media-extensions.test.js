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
  getExtensionsByType,
  isPlaylistURL,
  isSimpleVideoURL,
  isStreamSegmentURL,
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

    describe('should handle invalid input types', () => {
      test('null returns false', () => {
        expect(isMediaURL(null)).toBe(false);
      });

      test('undefined returns false', () => {
        expect(isMediaURL(undefined)).toBe(false);
      });

      test('number returns false', () => {
        expect(isMediaURL(123)).toBe(false);
      });

      test('object returns false', () => {
        expect(isMediaURL({})).toBe(false);
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

    describe('invalid input types', () => {
      test('null returns "unknown"', () => {
        expect(getMediaType(null)).toBe('unknown');
      });

      test('undefined returns "unknown"', () => {
        expect(getMediaType(undefined)).toBe('unknown');
      });

      test('number returns "unknown"', () => {
        expect(getMediaType(123)).toBe('unknown');
      });

      test('object returns "unknown"', () => {
        expect(getMediaType({})).toBe('unknown');
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

    test('should handle null/undefined/non-string inputs', () => {
      expect(cleanUrl(null)).toBe('');
      expect(cleanUrl(undefined)).toBe('');
      expect(cleanUrl(123)).toBe('');
    });
  });

  describe('getExtensionsByType(type)', () => {
    test('should return video extensions', () => {
      const videoExts = getExtensionsByType('video');
      expect(Array.isArray(videoExts)).toBe(true);
      expect(videoExts).toContain('.mp4');
      expect(videoExts).toContain('.webm');
      expect(videoExts).toContain('.mov');
    });

    test('should return audio extensions', () => {
      const audioExts = getExtensionsByType('audio');
      expect(Array.isArray(audioExts)).toBe(true);
      expect(audioExts).toContain('.mp3');
      expect(audioExts).toContain('.aac');
      expect(audioExts).toContain('.wav');
    });

    test('should return hls extensions', () => {
      const hlsExts = getExtensionsByType('hls');
      expect(Array.isArray(hlsExts)).toBe(true);
      expect(hlsExts).toContain('.m3u8');
      expect(hlsExts).toContain('.m3u');
    });

    test('should return dash extensions', () => {
      const dashExts = getExtensionsByType('dash');
      expect(Array.isArray(dashExts)).toBe(true);
      expect(dashExts).toContain('.mpd');
    });

    test('should return stream extensions', () => {
      const streamExts = getExtensionsByType('stream');
      expect(Array.isArray(streamExts)).toBe(true);
      expect(streamExts).toContain('.ts');
      expect(streamExts).toContain('.m4s');
    });

    test('should return empty array for unknown type', () => {
      expect(getExtensionsByType('unknown')).toEqual([]);
      expect(getExtensionsByType('fake')).toEqual([]);
    });
  });

  describe('isPlaylistURL(url)', () => {
    describe('HLS playlists', () => {
      test('.m3u8 URL should return true', () => {
        expect(isPlaylistURL('playlist.m3u8')).toBe(true);
        expect(isPlaylistURL('https://cdn.example.com/stream.m3u8')).toBe(true);
      });

      test('.m3u8 with query params should return true', () => {
        expect(isPlaylistURL('playlist.m3u8?token=xyz')).toBe(true);
      });

      test('.m3u URL should return true', () => {
        expect(isPlaylistURL('playlist.m3u')).toBe(true);
      });
    });

    describe('DASH playlists', () => {
      test('.mpd URL should return true', () => {
        expect(isPlaylistURL('manifest.mpd')).toBe(true);
        expect(isPlaylistURL('https://cdn.example.com/stream.mpd')).toBe(true);
      });

      test('.mpd with query params should return true', () => {
        expect(isPlaylistURL('manifest.mpd?v=1')).toBe(true);
      });
    });

    describe('non-playlist URLs', () => {
      test('video files should return false', () => {
        expect(isPlaylistURL('video.mp4')).toBe(false);
        expect(isPlaylistURL('https://example.com/movie.webm')).toBe(false);
      });

      test('stream segments should return false', () => {
        expect(isPlaylistURL('segment.ts')).toBe(false);
        expect(isPlaylistURL('segment.m4s')).toBe(false);
      });

      test('non-media URLs should return false', () => {
        expect(isPlaylistURL('document.pdf')).toBe(false);
        expect(isPlaylistURL('script.js')).toBe(false);
      });
    });

    describe('edge cases', () => {
      test('should return false for null/undefined/empty', () => {
        expect(isPlaylistURL(null)).toBe(false);
        expect(isPlaylistURL(undefined)).toBe(false);
        expect(isPlaylistURL('')).toBe(false);
      });

      test('should be case-insensitive', () => {
        expect(isPlaylistURL('PLAYLIST.M3U8')).toBe(true);
        expect(isPlaylistURL('MANIFEST.MPD')).toBe(true);
      });
    });
  });

  describe('isSimpleVideoURL(url)', () => {
    describe('simple video files', () => {
      test('.mp4 URL should return true', () => {
        expect(isSimpleVideoURL('video.mp4')).toBe(true);
        expect(isSimpleVideoURL('https://example.com/movie.mp4')).toBe(true);
      });

      test('.mp4 with query params should return true', () => {
        expect(isSimpleVideoURL('video.mp4?token=xyz')).toBe(true);
      });

      test('.webm URL should return true', () => {
        expect(isSimpleVideoURL('video.webm')).toBe(true);
      });

      test('.mov URL should return true', () => {
        expect(isSimpleVideoURL('video.mov')).toBe(true);
      });

      test('.mkv URL should return true', () => {
        expect(isSimpleVideoURL('video.mkv')).toBe(true);
      });
    });

    describe('non-video URLs', () => {
      test('playlists should return false', () => {
        expect(isSimpleVideoURL('playlist.m3u8')).toBe(false);
        expect(isSimpleVideoURL('manifest.mpd')).toBe(false);
      });

      test('stream segments should return false', () => {
        expect(isSimpleVideoURL('segment.ts')).toBe(false);
        expect(isSimpleVideoURL('segment.m4s')).toBe(false);
      });

      test('audio files should return false', () => {
        expect(isSimpleVideoURL('audio.mp3')).toBe(false);
        expect(isSimpleVideoURL('music.wav')).toBe(false);
      });

      test('non-media URLs should return false', () => {
        expect(isSimpleVideoURL('document.pdf')).toBe(false);
        expect(isSimpleVideoURL('index.html')).toBe(false);
      });
    });

    describe('edge cases', () => {
      test('should return false for null/undefined/empty', () => {
        expect(isSimpleVideoURL(null)).toBe(false);
        expect(isSimpleVideoURL(undefined)).toBe(false);
        expect(isSimpleVideoURL('')).toBe(false);
      });

      test('should be case-insensitive', () => {
        expect(isSimpleVideoURL('VIDEO.MP4')).toBe(true);
        expect(isSimpleVideoURL('Movie.WebM')).toBe(true);
      });
    });
  });

  describe('isStreamSegmentURL(url)', () => {
    describe('stream segment files', () => {
      test('.ts (MPEG-TS) URL should return true', () => {
        expect(isStreamSegmentURL('segment.ts')).toBe(true);
        expect(isStreamSegmentURL('https://cdn.example.com/segment001.ts')).toBe(true);
      });

      test('.ts with query params should return true', () => {
        expect(isStreamSegmentURL('segment.ts?token=xyz')).toBe(true);
      });

      test('.m4s (DASH segment) URL should return true', () => {
        expect(isStreamSegmentURL('segment.m4s')).toBe(true);
      });

      test('.seg URL should return true', () => {
        expect(isStreamSegmentURL('segment.seg')).toBe(true);
      });

      test('.f4v URL should return true', () => {
        expect(isStreamSegmentURL('segment.f4v')).toBe(true);
      });
    });

    describe('non-segment URLs', () => {
      test('video files should return false', () => {
        expect(isStreamSegmentURL('video.mp4')).toBe(false);
        expect(isStreamSegmentURL('movie.webm')).toBe(false);
      });

      test('playlists should return false', () => {
        expect(isStreamSegmentURL('playlist.m3u8')).toBe(false);
        expect(isStreamSegmentURL('manifest.mpd')).toBe(false);
      });

      test('non-media URLs should return false', () => {
        expect(isStreamSegmentURL('document.pdf')).toBe(false);
        expect(isStreamSegmentURL('index.html')).toBe(false);
      });
    });

    describe('edge cases', () => {
      test('should return false for null/undefined/empty', () => {
        expect(isStreamSegmentURL(null)).toBe(false);
        expect(isStreamSegmentURL(undefined)).toBe(false);
        expect(isStreamSegmentURL('')).toBe(false);
      });

      test('should be case-insensitive', () => {
        expect(isStreamSegmentURL('SEGMENT.TS')).toBe(true);
        expect(isStreamSegmentURL('Segment.M4S')).toBe(true);
      });
    });
  });
});

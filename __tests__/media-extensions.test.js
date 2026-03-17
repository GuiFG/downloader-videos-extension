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
  URL_PATTERNS,
  detectMediaTypeByPattern,
  detectMediaTypeByContentType,
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

  describe('URL_PATTERNS constant', () => {
    test('should export URL_PATTERNS object', () => {
      expect(URL_PATTERNS).toBeDefined();
      expect(typeof URL_PATTERNS).toBe('object');
    });

    test('should contain stream patterns', () => {
      expect(URL_PATTERNS.stream).toBeDefined();
      expect(Array.isArray(URL_PATTERNS.stream)).toBe(true);
      expect(URL_PATTERNS.stream.length).toBeGreaterThan(0);
    });

    test('should have patterns for googlevideo.com', () => {
      const hasGoogleVideoPattern = URL_PATTERNS.stream.some(
        (pattern) => pattern.source.includes('googlevideo')
      );
      expect(hasGoogleVideoPattern).toBe(true);
    });

    test('should have patterns for vimeo.com/video', () => {
      const hasVimeoVideoPattern = URL_PATTERNS.stream.some(
        (pattern) => pattern.source.includes('vimeo') && pattern.source.includes('video')
      );
      expect(hasVimeoVideoPattern).toBe(true);
    });

    test('should have patterns for player.vimeo.com', () => {
      const hasPlayerVimeoPattern = URL_PATTERNS.stream.some(
        (pattern) => pattern.source.includes('player') && pattern.source.includes('vimeo')
      );
      expect(hasPlayerVimeoPattern).toBe(true);
    });
  });

  describe('detectMediaTypeByPattern(url)', () => {
    describe('Google Video / YouTube patterns', () => {
      test('should detect googlevideo.com URLs', () => {
        expect(detectMediaTypeByPattern('https://r1---sn-5hne6nzs.googlevideo.com/videoplayback')).toBe('stream');
        expect(detectMediaTypeByPattern('https://googlevideo.com/videoplayback?id=123')).toBe('stream');
        expect(detectMediaTypeByPattern('http://r2.googlevideo.com/file')).toBe('stream');
      });

      test('should detect googlevideo.com case-insensitively', () => {
        expect(detectMediaTypeByPattern('https://GOOGLEVIDEO.COM/video')).toBe('stream');
        expect(detectMediaTypeByPattern('https://GoogleVideo.com/stream')).toBe('stream');
        expect(detectMediaTypeByPattern('https://r1---sn-5hne6nzs.GOOGLEVIDEO.COM/videoplayback')).toBe('stream');
      });

      test('should ignore query parameters', () => {
        expect(
          detectMediaTypeByPattern('https://r1---sn-5hne6nzs.googlevideo.com/videoplayback?id=123&range=0-1000')
        ).toBe('stream');
      });

      test('should ignore fragments', () => {
        expect(detectMediaTypeByPattern('https://r1---sn-5hne6nzs.googlevideo.com/videoplayback#t=10')).toBe('stream');
      });

      test('should ignore both query params and fragments', () => {
        expect(
          detectMediaTypeByPattern('https://r1---sn-5hne6nzs.googlevideo.com/videoplayback?id=123#t=10')
        ).toBe('stream');
      });
    });

    describe('Vimeo /video/ pattern', () => {
      test('should detect vimeo.com/video/ URLs', () => {
        expect(detectMediaTypeByPattern('https://vimeo.com/video/123456')).toBe('stream');
        expect(detectMediaTypeByPattern('https://vimeo.com/video/87654321/config')).toBe('stream');
      });

      test('should detect vimeo.com/video/ case-insensitively', () => {
        expect(detectMediaTypeByPattern('https://VIMEO.COM/VIDEO/123456')).toBe('stream');
        expect(detectMediaTypeByPattern('https://Vimeo.com/Video/123')).toBe('stream');
      });

      test('should ignore query parameters', () => {
        expect(detectMediaTypeByPattern('https://vimeo.com/video/123456?auth=token')).toBe('stream');
      });

      test('should not match vimeo.com without /video/', () => {
        expect(detectMediaTypeByPattern('https://vimeo.com/123456')).not.toBe('stream');
        expect(detectMediaTypeByPattern('https://vimeo.com/')).not.toBe('stream');
      });
    });

    describe('Vimeo player pattern', () => {
      test('should detect player.vimeo.com URLs', () => {
        expect(detectMediaTypeByPattern('https://player.vimeo.com/video/123456')).toBe('stream');
        expect(detectMediaTypeByPattern('https://player.vimeo.com/external/123.mp4')).toBe('stream');
      });

      test('should detect player.vimeo.com case-insensitively', () => {
        expect(detectMediaTypeByPattern('https://PLAYER.VIMEO.COM/video/123')).toBe('stream');
        expect(detectMediaTypeByPattern('https://Player.Vimeo.Com/external/456')).toBe('stream');
      });

      test('should ignore query parameters', () => {
        expect(detectMediaTypeByPattern('https://player.vimeo.com/video/123?v=1')).toBe('stream');
        expect(detectMediaTypeByPattern('https://player.vimeo.com/external/123.mp4?token=abc')).toBe('stream');
      });
    });

    describe('Non-matching URLs', () => {
      test('should return null for regular URLs without patterns', () => {
        expect(detectMediaTypeByPattern('https://example.com/video')).toBeNull();
        expect(detectMediaTypeByPattern('https://youtube.com/watch?v=123')).toBeNull();
        expect(detectMediaTypeByPattern('https://dailymotion.com/video/123')).toBeNull();
      });

      test('should return null for file extensions (without patterns)', () => {
        expect(detectMediaTypeByPattern('https://example.com/video.mp4')).toBeNull();
        expect(detectMediaTypeByPattern('video.webm')).toBeNull();
      });

      test('should return null for partial pattern matches', () => {
        expect(detectMediaTypeByPattern('https://fakegooglevideo.com/video')).toBeNull();
        expect(detectMediaTypeByPattern('https://myvimeo.com/video/123')).toBeNull();
      });
    });

    describe('Malformed URLs', () => {
      test('should return null for invalid input types', () => {
        expect(detectMediaTypeByPattern(null)).toBeNull();
        expect(detectMediaTypeByPattern(undefined)).toBeNull();
        expect(detectMediaTypeByPattern(123)).toBeNull();
        expect(detectMediaTypeByPattern({})).toBeNull();
        expect(detectMediaTypeByPattern([])).toBeNull();
      });

      test('should return null for empty strings', () => {
        expect(detectMediaTypeByPattern('')).toBeNull();
        expect(detectMediaTypeByPattern('   ')).toBeNull();
      });

      test('should handle URLs with only query params or fragments', () => {
        expect(detectMediaTypeByPattern('?query=value')).toBeNull();
        expect(detectMediaTypeByPattern('#fragment')).toBeNull();
      });
    });

    describe('Integration with getMediaType', () => {
      test('getMediaType should return "stream" for googlevideo.com URLs', () => {
        expect(getMediaType('https://r1---sn-5hne6nzs.googlevideo.com/videoplayback')).toBe('stream');
      });

      test('getMediaType should return "stream" for vimeo.com/video URLs', () => {
        expect(getMediaType('https://vimeo.com/video/123456')).toBe('stream');
      });

      test('getMediaType should return "stream" for player.vimeo.com URLs', () => {
        expect(getMediaType('https://player.vimeo.com/video/123')).toBe('stream');
      });

      test('getMediaType should prioritize extensions over patterns', () => {
        // A URL with both extension and pattern should return based on extension first
        expect(getMediaType('https://example.com/video.mp4')).toBe('video');
      });

      test('getMediaType should fall back to pattern when no extension', () => {
        expect(getMediaType('https://vimeo.com/video/123456')).toBe('stream');
        expect(getMediaType('https://googlevideo.com/videoplayback')).toBe('stream');
      });

      test('getMediaType should return unknown for non-matching URLs', () => {
        expect(getMediaType('https://example.com/media')).toBe('unknown');
        expect(getMediaType('https://custom-site.com/stream')).toBe('unknown');
      });
    });
  });

  describe('detectMediaTypeByContentType(contentType)', () => {
    describe('Video MIME types', () => {
      test('should detect video/mp4', () => {
        expect(detectMediaTypeByContentType('video/mp4')).toBe('stream');
      });

      test('should detect video/webm', () => {
        expect(detectMediaTypeByContentType('video/webm')).toBe('stream');
      });

      test('should detect video/quicktime', () => {
        expect(detectMediaTypeByContentType('video/quicktime')).toBe('stream');
      });

      test('should detect video/x-matroska', () => {
        expect(detectMediaTypeByContentType('video/x-matroska')).toBe('stream');
      });

      test('should detect video/x-msvideo', () => {
        expect(detectMediaTypeByContentType('video/x-msvideo')).toBe('stream');
      });

      test('should detect video/x-flv', () => {
        expect(detectMediaTypeByContentType('video/x-flv')).toBe('stream');
      });

      test('should detect application/x-mpegURL as stream', () => {
        expect(detectMediaTypeByContentType('application/x-mpegURL')).not.toBe('stream');
      });

      test('should handle video/mp4 with charset parameter', () => {
        expect(detectMediaTypeByContentType('video/mp4; charset=utf-8')).toBe('stream');
      });

      test('should handle video/mp4 with multiple parameters', () => {
        expect(detectMediaTypeByContentType('video/mp4; charset=utf-8; boundary=something')).toBe('stream');
      });

      test('should be case-insensitive', () => {
        expect(detectMediaTypeByContentType('VIDEO/MP4')).toBe('stream');
        expect(detectMediaTypeByContentType('Video/WebM')).toBe('stream');
      });
    });

    describe('Audio MIME types', () => {
      test('should detect audio/mpeg', () => {
        expect(detectMediaTypeByContentType('audio/mpeg')).toBe('audio');
      });

      test('should detect audio/wav', () => {
        expect(detectMediaTypeByContentType('audio/wav')).toBe('audio');
      });

      test('should detect audio/aac', () => {
        expect(detectMediaTypeByContentType('audio/aac')).toBe('audio');
      });

      test('should detect audio/ogg', () => {
        expect(detectMediaTypeByContentType('audio/ogg')).toBe('audio');
      });

      test('should handle audio with parameters', () => {
        expect(detectMediaTypeByContentType('audio/mpeg; charset=utf-8')).toBe('audio');
      });

      test('should be case-insensitive for audio', () => {
        expect(detectMediaTypeByContentType('AUDIO/MPEG')).toBe('audio');
      });
    });

    describe('Non-video MIME types', () => {
      test('should return null for text/html', () => {
        expect(detectMediaTypeByContentType('text/html')).toBeNull();
      });

      test('should return null for application/json', () => {
        expect(detectMediaTypeByContentType('application/json')).toBeNull();
      });

      test('should return null for image/png', () => {
        expect(detectMediaTypeByContentType('image/png')).toBeNull();
      });

      test('should return null for application/pdf', () => {
        expect(detectMediaTypeByContentType('application/pdf')).toBeNull();
      });

      test('should return null for application/octet-stream', () => {
        expect(detectMediaTypeByContentType('application/octet-stream')).toBeNull();
      });

      test('should return null for text/plain', () => {
        expect(detectMediaTypeByContentType('text/plain')).toBeNull();
      });
    });

    describe('Edge cases and malformed input', () => {
      test('should return null for null', () => {
        expect(detectMediaTypeByContentType(null)).toBeNull();
      });

      test('should return null for undefined', () => {
        expect(detectMediaTypeByContentType(undefined)).toBeNull();
      });

      test('should return null for empty string', () => {
        expect(detectMediaTypeByContentType('')).toBeNull();
      });

      test('should return null for whitespace only', () => {
        expect(detectMediaTypeByContentType('   ')).toBeNull();
      });

      test('should return null for number', () => {
        expect(detectMediaTypeByContentType(123)).toBeNull();
      });

      test('should return null for object', () => {
        expect(detectMediaTypeByContentType({})).toBeNull();
      });

      test('should return null for array', () => {
        expect(detectMediaTypeByContentType([])).toBeNull();
      });

      test('should handle extra whitespace around MIME type', () => {
        expect(detectMediaTypeByContentType('  video/mp4  ')).toBe('stream'); // trim() is applied after split
      });

      test('should handle MIME type with spaces in parameters', () => {
        expect(detectMediaTypeByContentType('video/mp4; name = value')).toBe('stream');
      });
    });

    describe('Missing header (graceful fallback)', () => {
      test('should return null when header is missing', () => {
        expect(detectMediaTypeByContentType(null)).toBeNull();
      });

      test('should handle empty Content-Type header', () => {
        expect(detectMediaTypeByContentType('')).toBeNull();
      });

      test('should return null for malformed Content-Type', () => {
        expect(detectMediaTypeByContentType('invalid/invalid/extra')).toBeNull();
      });
    });

    describe('Real-world scenarios', () => {
      test('should detect streaming video without file extension', () => {
        const contentType = 'video/mp4';
        expect(detectMediaTypeByContentType(contentType)).toBe('stream');
      });

      test('should handle Content-Type from CDN response', () => {
        const contentType = 'video/mp4; charset=utf-8';
        expect(detectMediaTypeByContentType(contentType)).toBe('stream');
      });

      test('should handle HLS stream Content-Type (usually application/x-mpegURL)', () => {
        // HLS typically comes with m3u8 extension, so this is uncommon but possible
        expect(detectMediaTypeByContentType('application/x-mpegURL')).toBeNull();
      });

      test('should handle DASH stream Content-Type', () => {
        // DASH typically comes with mpd extension, so this is uncommon
        expect(detectMediaTypeByContentType('application/dash+xml')).toBeNull();
      });
    });
  });

  describe('Debug logging integration', () => {
    let originalEnv;
    let consoleLogSpy;

    beforeEach(() => {
      originalEnv = process.env.DEBUG_VIDEO_DETECTION;
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      process.env.DEBUG_VIDEO_DETECTION = originalEnv;
      consoleLogSpy.mockRestore();
      jest.resetModules();
    });

    test('should not log when DEBUG_VIDEO_DETECTION is disabled', () => {
      process.env.DEBUG_VIDEO_DETECTION = 'false';
      jest.resetModules();
      // Re-import to get fresh modules with updated env
      const mod = require('../src/utils/media-extensions');

      mod.detectMediaTypeByPattern('https://googlevideo.com/video');

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    test('should log pattern detection when DEBUG_VIDEO_DETECTION is enabled', () => {
      process.env.DEBUG_VIDEO_DETECTION = 'true';
      jest.resetModules();
      const mod = require('../src/utils/media-extensions');

      mod.detectMediaTypeByPattern('https://googlevideo.com/video');

      expect(consoleLogSpy).toHaveBeenCalled();
      const calls = consoleLogSpy.mock.calls;
      expect(calls[0][0]).toContain('Pattern detection');
    });

    test('should log Content-Type detection when DEBUG_VIDEO_DETECTION is enabled', () => {
      process.env.DEBUG_VIDEO_DETECTION = 'true';
      jest.resetModules();
      const mod = require('../src/utils/media-extensions');

      mod.detectMediaTypeByContentType('video/mp4');

      expect(consoleLogSpy).toHaveBeenCalled();
      const calls = consoleLogSpy.mock.calls;
      expect(calls[0][0]).toContain('Content-Type detection');
    });

    test('should include detection method in log output', () => {
      process.env.DEBUG_VIDEO_DETECTION = 'true';
      jest.resetModules();
      const mod = require('../src/utils/media-extensions');

      mod.detectMediaTypeByPattern('https://vimeo.com/video/123');

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0];
      expect(output[0]).toContain('matched');
    });

    test('should log failure reasons when detection fails', () => {
      process.env.DEBUG_VIDEO_DETECTION = 'true';
      jest.resetModules();
      const mod = require('../src/utils/media-extensions');

      mod.detectMediaTypeByPattern('https://example.com/unknown');

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0];
      expect(output[0]).toContain('no match');
    });

    test('should handle debug logging for invalid inputs gracefully', () => {
      process.env.DEBUG_VIDEO_DETECTION = 'true';
      jest.resetModules();
      const mod = require('../src/utils/media-extensions');

      // Should not throw even with invalid input
      expect(() => {
        mod.detectMediaTypeByPattern(null);
        mod.detectMediaTypeByContentType(undefined);
      }).not.toThrow();

      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });
});

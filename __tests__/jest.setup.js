// Polyfill TextEncoder/TextDecoder for jsdom compatibility
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// Make DOMParser available globally from jsdom
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.DOMParser = dom.window.DOMParser;

// Mock global de chrome API
global.chrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
    },
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn(),
    },
  },
  downloads: {
    download: jest.fn(),
    onChanged: {
      addListener: jest.fn(),
    },
  },
  webRequest: {
    onBeforeRequest: {
      addListener: jest.fn(),
    },
    onResponseStarted: {
      addListener: jest.fn(),
    },
  },
  tabs: {
    query: jest.fn(),
    sendMessage: jest.fn(),
  },
};

// Mock fetch (se necessário)
global.fetch = jest.fn();

// Mock de indexedDB (básico)
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'indexedDB', {
    value: {
      open: jest.fn(),
    },
  });
}

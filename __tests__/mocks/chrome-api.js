/**
 * Chrome API Mock para testes
 * Fornece implementação mock de todas as APIs de Chrome usadas pela extensão
 */

export const createChromeMock = () => {
  return {
    runtime: {
      sendMessage: jest.fn(),
      onMessage: {
        addListener: jest.fn(),
      },
    },
    storage: {
      local: {
        get: jest.fn((keys, callback) => {
          callback({});
        }),
        set: jest.fn((items, callback) => {
          if (callback) callback();
        }),
        remove: jest.fn((keys, callback) => {
          if (callback) callback();
        }),
        clear: jest.fn((callback) => {
          if (callback) callback();
        }),
      },
    },
    downloads: {
      download: jest.fn((options, callback) => {
        if (callback) callback(1);
        return 1;
      }),
      onChanged: {
        addListener: jest.fn(),
      },
    },
    webRequest: {
      onBeforeRequest: {
        addListener: jest.fn(),
      },
      onHeadersReceived: {
        addListener: jest.fn(),
      },
      onResponseStarted: {
        addListener: jest.fn(),
      },
    },
    tabs: {
      query: jest.fn((queryInfo, callback) => {
        callback([]);
      }),
      sendMessage: jest.fn(),
    },
  };
};

export default createChromeMock();

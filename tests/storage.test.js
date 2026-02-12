import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockStorage = {};

vi.stubGlobal('chrome', {
  storage: {
    local: {
      get: vi.fn((key) => Promise.resolve({ [key]: mockStorage[key] ?? null })),
      set: vi.fn((obj) => {
        Object.assign(mockStorage, obj);
        return Promise.resolve();
      }),
      remove: vi.fn((key) => {
        delete mockStorage[key];
        return Promise.resolve();
      }),
    },
  },
});

let storageGet, storageSet, storageRemove;

beforeEach(async () => {
  for (const key of Object.keys(mockStorage)) delete mockStorage[key];
  vi.clearAllMocks();
  vi.resetModules();

  const mod = await import('../src/shared/storage.js');
  storageGet = mod.storageGet;
  storageSet = mod.storageSet;
  storageRemove = mod.storageRemove;
});

describe('storage wrapper', () => {
  it('stores and retrieves a value', async () => {
    await storageSet('testKey', { foo: 'bar' });
    const result = await storageGet('testKey');
    expect(result).toEqual({ foo: 'bar' });
  });

  it('returns null for missing key', async () => {
    const result = await storageGet('nonexistent');
    expect(result).toBeNull();
  });

  it('removes a key', async () => {
    await storageSet('toDelete', 'value');
    await storageRemove('toDelete');
    const result = await storageGet('toDelete');
    expect(result).toBeNull();
  });

  it('overwrites existing values', async () => {
    await storageSet('key', 'first');
    await storageSet('key', 'second');
    const result = await storageGet('key');
    expect(result).toBe('second');
  });
});

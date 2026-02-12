import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock chrome.storage.local before importing the module
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

// Use dynamic import to get a fresh module for each test
let initStore, ingestItems, getItems, clearItems;

beforeEach(async () => {
  // Clear mock storage
  for (const key of Object.keys(mockStorage)) delete mockStorage[key];

  // Re-import module fresh (vitest module cache reset)
  vi.resetModules();
  const mod = await import('../src/background/feed-store.js');
  initStore = mod.initStore;
  ingestItems = mod.ingestItems;
  getItems = mod.getItems;
  clearItems = mod.clearItems;

  await initStore();
});

describe('feed-store', () => {
  const makeItem = (id, createdAt) => ({
    id,
    platform: id.startsWith('x:') ? 'x' : 'bsky',
    author: { handle: 'test', displayName: 'Test', avatarUrl: '' },
    text: `Post ${id}`,
    createdAt,
    url: `https://example.com/${id}`,
  });

  it('ingests items and returns them sorted newest first', async () => {
    const items = [
      makeItem('x:1', '2024-01-01T10:00:00Z'),
      makeItem('x:2', '2024-01-01T12:00:00Z'),
      makeItem('bsky:3', '2024-01-01T11:00:00Z'),
    ];

    await ingestItems(items);
    const result = getItems();

    expect(result).toHaveLength(3);
    expect(result[0].id).toBe('x:2');
    expect(result[1].id).toBe('bsky:3');
    expect(result[2].id).toBe('x:1');
  });

  it('deduplicates by id', async () => {
    const items = [
      makeItem('x:1', '2024-01-01T10:00:00Z'),
      makeItem('x:1', '2024-01-01T10:00:00Z'),
    ];

    await ingestItems(items);
    expect(getItems()).toHaveLength(1);

    // Ingesting again should also deduplicate
    await ingestItems([makeItem('x:1', '2024-01-01T10:00:00Z')]);
    expect(getItems()).toHaveLength(1);
  });

  it('returns false when no new items added', async () => {
    await ingestItems([makeItem('x:1', '2024-01-01T10:00:00Z')]);
    const result = await ingestItems([makeItem('x:1', '2024-01-01T10:00:00Z')]);
    expect(result).toBe(false);
  });

  it('returns true when new items are added', async () => {
    const result = await ingestItems([makeItem('x:1', '2024-01-01T10:00:00Z')]);
    expect(result).toBe(true);
  });

  it('clears all items', async () => {
    await ingestItems([makeItem('x:1', '2024-01-01T10:00:00Z')]);
    await clearItems();
    expect(getItems()).toHaveLength(0);
  });

  it('handles empty input', async () => {
    expect(await ingestItems([])).toBe(false);
    expect(await ingestItems(null)).toBe(false);
  });
});

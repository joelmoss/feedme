import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock chrome APIs
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
  alarms: {
    create: vi.fn(),
    clear: vi.fn(),
  },
});

// Mock @atproto/api
vi.mock('@atproto/api', () => {
  const MockAgent = vi.fn().mockImplementation(() => ({
    session: null,
    login: vi.fn().mockImplementation(function () {
      this.session = {
        did: 'did:plc:test',
        handle: 'test.bsky.social',
        accessJwt: 'access-token',
        refreshJwt: 'refresh-token',
      };
      return Promise.resolve({
        data: this.session,
      });
    }),
    resumeSession: vi.fn().mockImplementation(function (session) {
      this.session = session;
      return Promise.resolve();
    }),
    getTimeline: vi.fn().mockResolvedValue({
      data: {
        feed: [
          {
            post: {
              uri: 'at://did:plc:test/app.bsky.feed.post/abc',
              cid: 'bafytest',
              author: {
                did: 'did:plc:test',
                handle: 'test.bsky.social',
                displayName: 'Test',
                avatar: 'https://cdn.bsky.app/avatar.jpg',
              },
              record: {
                $type: 'app.bsky.feed.post',
                text: 'Hello from Bluesky test',
                createdAt: '2024-01-01T12:00:00.000Z',
              },
              indexedAt: '2024-01-01T12:00:01.000Z',
            },
          },
        ],
        cursor: 'next-cursor',
      },
    }),
  }));

  return { BskyAgent: MockAgent };
});

let login, logout, isLoggedIn, fetchTimeline;

beforeEach(async () => {
  for (const key of Object.keys(mockStorage)) delete mockStorage[key];
  vi.clearAllMocks();
  vi.resetModules();

  const mod = await import('../src/background/bluesky-client.js');
  login = mod.login;
  logout = mod.logout;
  isLoggedIn = mod.isLoggedIn;
  fetchTimeline = mod.fetchTimeline;
});

describe('bluesky-client', () => {
  it('login stores session and returns success', async () => {
    const result = await login('test.bsky.social', 'app-password');
    expect(result.success).toBe(true);
    expect(await isLoggedIn()).toBe(true);
    expect(chrome.alarms.create).toHaveBeenCalled();
  });

  it('logout clears session', async () => {
    await login('test.bsky.social', 'app-password');
    await logout();
    expect(await isLoggedIn()).toBe(false);
    expect(chrome.alarms.clear).toHaveBeenCalled();
  });

  it('fetchTimeline returns normalised items', async () => {
    await login('test.bsky.social', 'app-password');
    const { items, cursor } = await fetchTimeline();

    expect(items).toHaveLength(1);
    expect(items[0].platform).toBe('bsky');
    expect(items[0].text).toBe('Hello from Bluesky test');
    expect(cursor).toBe('next-cursor');
  });

  it('fetchTimeline returns empty when not logged in', async () => {
    const { items } = await fetchTimeline();
    expect(items).toEqual([]);
  });
});

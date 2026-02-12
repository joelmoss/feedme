import { describe, it, expect } from 'vitest';
import {
  extractXTimelineEntries,
  normalizeXTweet,
  normalizeBskyPost,
} from '../src/lib/normalizer.js';

// ── X.com normalisation ────────────────────────────────────────────────────

describe('extractXTimelineEntries', () => {
  it('extracts tweet entries from a timeline response', () => {
    const json = {
      data: {
        home: {
          home_timeline_urt: {
            instructions: [
              {
                type: 'TimelineAddEntries',
                entries: [
                  {
                    entryId: 'tweet-123',
                    content: {
                      entryType: 'TimelineTimelineItem',
                      itemContent: {
                        tweet_results: { result: { id: '123' } },
                      },
                    },
                  },
                  {
                    entryId: 'cursor-top',
                    content: { entryType: 'TimelineTimelineCursor' },
                  },
                ],
              },
            ],
          },
        },
      },
    };

    const entries = extractXTimelineEntries(json);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({ id: '123' });
  });

  it('returns empty array for malformed data', () => {
    expect(extractXTimelineEntries({})).toEqual([]);
    expect(extractXTimelineEntries(null)).toEqual([]);
  });
});

describe('normalizeXTweet', () => {
  const makeRawTweet = (overrides = {}) => ({
    __typename: 'Tweet',
    legacy: {
      id_str: '1234567890',
      full_text: 'Hello world!',
      created_at: 'Mon Jan 01 12:00:00 +0000 2024',
      extended_entities: { media: [] },
      ...overrides.legacy,
    },
    core: {
      user_results: {
        result: {
          rest_id: 'user1',
          legacy: {
            screen_name: 'testuser',
            name: 'Test User',
            profile_image_url_https: 'https://pbs.twimg.com/pic_normal.jpg',
            ...overrides.user,
          },
        },
      },
    },
  });

  it('normalizes a basic tweet', () => {
    const item = normalizeXTweet(makeRawTweet());
    expect(item).toEqual({
      id: 'x:1234567890',
      platform: 'x',
      author: {
        handle: 'testuser',
        displayName: 'Test User',
        avatarUrl: 'https://pbs.twimg.com/pic_bigger.jpg',
      },
      text: 'Hello world!',
      createdAt: new Date('Mon Jan 01 12:00:00 +0000 2024').toISOString(),
      media: undefined,
      repostBy: undefined,
      url: 'https://x.com/testuser/status/1234567890',
    });
  });

  it('extracts image media', () => {
    const raw = makeRawTweet({
      legacy: {
        extended_entities: {
          media: [
            {
              type: 'photo',
              media_url_https: 'https://pbs.twimg.com/media/img.jpg',
              ext_alt_text: 'A photo',
            },
          ],
        },
      },
    });
    const item = normalizeXTweet(raw);
    expect(item.media).toEqual([
      { type: 'image', url: 'https://pbs.twimg.com/media/img.jpg', alt: 'A photo' },
    ]);
  });

  it('handles retweets', () => {
    const raw = makeRawTweet();
    raw.legacy.retweeted_status_result = {
      result: {
        __typename: 'Tweet',
        legacy: {
          id_str: '9999',
          full_text: 'Original tweet',
          created_at: 'Mon Jan 01 11:00:00 +0000 2024',
          extended_entities: { media: [] },
        },
        core: {
          user_results: {
            result: {
              legacy: {
                screen_name: 'original_author',
                name: 'Original Author',
                profile_image_url_https: 'https://pbs.twimg.com/oa_normal.jpg',
              },
            },
          },
        },
      },
    };

    const item = normalizeXTweet(raw);
    expect(item.repostBy).toBe('Test User');
    expect(item.author.handle).toBe('original_author');
    expect(item.text).toBe('Original tweet');
    expect(item.id).toBe('x:9999');
  });

  it('returns null for invalid data', () => {
    expect(normalizeXTweet({})).toBeNull();
    expect(normalizeXTweet(null)).toBeNull();
  });
});

// ── Bluesky normalisation ──────────────────────────────────────────────────

describe('normalizeBskyPost', () => {
  const makeFeedViewPost = (overrides = {}) => ({
    post: {
      uri: 'at://did:plc:abc123/app.bsky.feed.post/rkey1',
      cid: 'bafyabc',
      author: {
        did: 'did:plc:abc123',
        handle: 'alice.bsky.social',
        displayName: 'Alice',
        avatar: 'https://cdn.bsky.app/avatar.jpg',
        ...overrides.author,
      },
      record: {
        $type: 'app.bsky.feed.post',
        text: 'Hello from Bluesky!',
        createdAt: '2024-01-01T12:00:00.000Z',
        ...overrides.record,
      },
      embed: overrides.embed ?? undefined,
      indexedAt: '2024-01-01T12:00:01.000Z',
    },
    reason: overrides.reason ?? undefined,
  });

  it('normalizes a basic Bluesky post', () => {
    const item = normalizeBskyPost(makeFeedViewPost());
    expect(item).toEqual({
      id: 'bsky:at://did:plc:abc123/app.bsky.feed.post/rkey1',
      platform: 'bsky',
      author: {
        handle: 'alice.bsky.social',
        displayName: 'Alice',
        avatarUrl: 'https://cdn.bsky.app/avatar.jpg',
      },
      text: 'Hello from Bluesky!',
      createdAt: '2024-01-01T12:00:00.000Z',
      media: undefined,
      repostBy: undefined,
      url: 'https://bsky.app/profile/alice.bsky.social/post/rkey1',
    });
  });

  it('handles reposts', () => {
    const item = normalizeBskyPost(
      makeFeedViewPost({
        reason: {
          $type: 'app.bsky.feed.defs#reasonRepost',
          by: { handle: 'bob.bsky.social', displayName: 'Bob' },
        },
      })
    );
    expect(item.repostBy).toBe('Bob');
  });

  it('extracts image embeds', () => {
    const item = normalizeBskyPost(
      makeFeedViewPost({
        embed: {
          $type: 'app.bsky.embed.images#view',
          images: [
            { fullsize: 'https://cdn.bsky.app/full.jpg', thumb: 'https://cdn.bsky.app/thumb.jpg', alt: 'A sunset' },
          ],
        },
      })
    );
    expect(item.media).toEqual([
      { type: 'image', url: 'https://cdn.bsky.app/full.jpg', alt: 'A sunset' },
    ]);
  });

  it('returns null for invalid data', () => {
    expect(normalizeBskyPost({})).toBeNull();
    expect(normalizeBskyPost(null)).toBeNull();
  });
});

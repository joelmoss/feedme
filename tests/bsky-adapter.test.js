import { describe, it, expect, beforeEach } from 'vitest';
import { getTopVisiblePost, getPostInfo, findPostById, isTimelinePage } from '../src/content/sites/bsky.js';

function createBskyFeedItem(handle, rkey, text, rect = {}) {
  const item = document.createElement('div');
  item.setAttribute('data-testid', `feedItem-by-${handle}`);

  // Profile link with display name
  const profileLink = document.createElement('a');
  profileLink.href = `https://bsky.app/profile/${handle}`;
  profileLink.textContent = handle.charAt(0).toUpperCase() + handle.slice(1);
  item.appendChild(profileLink);

  // Post permalink
  const permalink = document.createElement('a');
  permalink.href = `https://bsky.app/profile/${handle}/post/${rkey}`;
  permalink.textContent = 'link';
  item.appendChild(permalink);

  // Post text
  const postText = document.createElement('div');
  postText.setAttribute('data-testid', 'postText');
  postText.textContent = text;
  item.appendChild(postText);

  item.getBoundingClientRect = () => ({
    top: rect.top ?? 0,
    bottom: rect.bottom ?? 100,
    left: 0,
    right: 400,
    width: 400,
    height: (rect.bottom ?? 100) - (rect.top ?? 0),
  });

  return item;
}

describe('Bluesky adapter: getPostInfo', () => {
  it('extracts post info from a feed item element', () => {
    const item = createBskyFeedItem('alice.bsky.social', '3abc123', 'Hello Bluesky!');
    const info = getPostInfo(item);

    expect(info).toEqual({
      postId: '3abc123',
      author: '@alice.bsky.social',
      displayName: 'Alice.bsky.social',
      textPreview: 'Hello Bluesky!',
      url: 'https://bsky.app/profile/alice.bsky.social/post/3abc123',
    });
  });

  it('truncates long text to 100 chars', () => {
    const longText = 'B'.repeat(150);
    const item = createBskyFeedItem('bob.bsky.social', '3def456', longText);
    const info = getPostInfo(item);

    expect(info.textPreview).toBe('B'.repeat(100) + '...');
  });

  it('returns null for null input', () => {
    expect(getPostInfo(null)).toBeNull();
  });

  it('returns null for element without post permalink', () => {
    const item = document.createElement('div');
    item.setAttribute('data-testid', 'feedItem-by-test');
    expect(getPostInfo(item)).toBeNull();
  });
});

describe('Bluesky adapter: getTopVisiblePost', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('returns the first feed item visible in viewport', () => {
    const offscreen = createBskyFeedItem('a.bsky.social', '1', 'off', { top: -200, bottom: -100 });
    const visible = createBskyFeedItem('b.bsky.social', '2', 'visible', { top: 50, bottom: 200 });

    document.body.appendChild(offscreen);
    document.body.appendChild(visible);

    Object.defineProperty(window, 'innerHeight', { value: 800, writable: true });

    const result = getTopVisiblePost();
    expect(result).toBe(visible);
  });

  it('returns null when no feed items exist', () => {
    expect(getTopVisiblePost()).toBeNull();
  });
});

describe('Bluesky adapter: findPostById', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('finds a post by its rkey', () => {
    const item = createBskyFeedItem('charlie.bsky.social', '3xyz789', 'Find me');
    document.body.appendChild(item);

    const found = findPostById('3xyz789');
    expect(found).toBe(item);
  });

  it('returns null for non-existent rkey', () => {
    expect(findPostById('nonexistent')).toBeNull();
  });

  it('returns null for null ID', () => {
    expect(findPostById(null)).toBeNull();
  });
});

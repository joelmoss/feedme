import { describe, it, expect, beforeEach } from 'vitest';
import { getTopVisibleTweet, getTweetInfo, findTweetById } from '../src/content/tweet-finder.js';

function createTweetArticle(username, tweetId, text, rect = {}) {
  const article = document.createElement('article');
  article.setAttribute('data-testid', 'tweet');

  const userNameDiv = document.createElement('div');
  userNameDiv.setAttribute('data-testid', 'User-Name');
  const nameLink = document.createElement('a');
  nameLink.href = `https://x.com/${username}`;
  const nameSpan = document.createElement('span');
  nameSpan.textContent = username.charAt(0).toUpperCase() + username.slice(1);
  nameLink.appendChild(nameSpan);
  userNameDiv.appendChild(nameLink);
  article.appendChild(userNameDiv);

  const permalink = document.createElement('a');
  permalink.href = `https://x.com/${username}/status/${tweetId}`;
  permalink.textContent = 'link';
  article.appendChild(permalink);

  const tweetText = document.createElement('div');
  tweetText.setAttribute('data-testid', 'tweetText');
  tweetText.textContent = text;
  article.appendChild(tweetText);

  // Mock getBoundingClientRect
  article.getBoundingClientRect = () => ({
    top: rect.top ?? 0,
    bottom: rect.bottom ?? 100,
    left: 0,
    right: 400,
    width: 400,
    height: (rect.bottom ?? 100) - (rect.top ?? 0),
  });

  return article;
}

describe('getTweetInfo', () => {
  it('extracts tweet info from an article element', () => {
    const article = createTweetArticle('alice', '12345', 'Hello world!');
    const info = getTweetInfo(article);

    expect(info).toEqual({
      tweetId: '12345',
      author: '@alice',
      displayName: 'Alice',
      textPreview: 'Hello world!',
      url: 'https://x.com/alice/status/12345',
    });
  });

  it('truncates long text to 100 chars', () => {
    const longText = 'A'.repeat(150);
    const article = createTweetArticle('bob', '99999', longText);
    const info = getTweetInfo(article);

    expect(info.textPreview).toBe('A'.repeat(100) + '...');
  });

  it('returns null for null input', () => {
    expect(getTweetInfo(null)).toBeNull();
  });

  it('returns null for article without permalink', () => {
    const article = document.createElement('article');
    article.setAttribute('data-testid', 'tweet');
    expect(getTweetInfo(article)).toBeNull();
  });
});

describe('getTopVisibleTweet', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('returns the first article visible in viewport', () => {
    // Article above viewport
    const offscreen = createTweetArticle('a', '1', 'off', { top: -200, bottom: -100 });
    // Article in viewport
    const visible = createTweetArticle('b', '2', 'visible', { top: 50, bottom: 200 });

    document.body.appendChild(offscreen);
    document.body.appendChild(visible);

    // Mock window.innerHeight
    Object.defineProperty(window, 'innerHeight', { value: 800, writable: true });

    const result = getTopVisibleTweet();
    expect(result).toBe(visible);
  });

  it('returns null when no tweets exist', () => {
    expect(getTopVisibleTweet()).toBeNull();
  });
});

describe('findTweetById', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('finds a tweet by its status ID', () => {
    const tweet = createTweetArticle('charlie', '55555', 'Find me');
    document.body.appendChild(tweet);

    const found = findTweetById('55555');
    expect(found).toBe(tweet);
  });

  it('returns null for non-existent ID', () => {
    expect(findTweetById('99999')).toBeNull();
  });

  it('returns null for null ID', () => {
    expect(findTweetById(null)).toBeNull();
  });
});

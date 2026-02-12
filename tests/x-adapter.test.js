import { describe, it, expect, beforeEach } from 'vitest';
import { getTopVisiblePost, getPostInfo, findPostById, isTimelinePage } from '../src/content/sites/x.js';

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

describe('X.com adapter: getPostInfo', () => {
  it('extracts post info from an article element', () => {
    const article = createTweetArticle('alice', '12345', 'Hello world!');
    const info = getPostInfo(article);

    expect(info).toEqual({
      postId: '12345',
      author: '@alice',
      displayName: 'Alice',
      textPreview: 'Hello world!',
      url: 'https://x.com/alice/status/12345',
    });
  });

  it('truncates long text to 100 chars', () => {
    const longText = 'A'.repeat(150);
    const article = createTweetArticle('bob', '99999', longText);
    const info = getPostInfo(article);

    expect(info.textPreview).toBe('A'.repeat(100) + '...');
  });

  it('returns null for null input', () => {
    expect(getPostInfo(null)).toBeNull();
  });

  it('returns null for article without permalink', () => {
    const article = document.createElement('article');
    article.setAttribute('data-testid', 'tweet');
    expect(getPostInfo(article)).toBeNull();
  });
});

describe('X.com adapter: getTopVisiblePost', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('returns the first article visible in viewport', () => {
    const offscreen = createTweetArticle('a', '1', 'off', { top: -200, bottom: -100 });
    const visible = createTweetArticle('b', '2', 'visible', { top: 50, bottom: 200 });

    document.body.appendChild(offscreen);
    document.body.appendChild(visible);

    Object.defineProperty(window, 'innerHeight', { value: 800, writable: true });

    const result = getTopVisiblePost();
    expect(result).toBe(visible);
  });

  it('returns null when no tweets exist', () => {
    expect(getTopVisiblePost()).toBeNull();
  });
});

describe('X.com adapter: findPostById', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('finds a tweet by its status ID', () => {
    const tweet = createTweetArticle('charlie', '55555', 'Find me');
    document.body.appendChild(tweet);

    const found = findPostById('55555');
    expect(found).toBe(tweet);
  });

  it('returns null for non-existent ID', () => {
    expect(findPostById('99999')).toBeNull();
  });

  it('returns null for null ID', () => {
    expect(findPostById(null)).toBeNull();
  });
});

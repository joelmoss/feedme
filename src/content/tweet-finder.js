/**
 * DOM utilities for finding and extracting tweet data from x.com's timeline.
 *
 * X.com renders tweets as <article> elements with `data-testid="tweet"`.
 * Each tweet contains a permalink <a> with href like /username/status/12345.
 */

/**
 * Find the topmost visible tweet article in the viewport.
 * Returns the <article> element or null.
 */
export function getTopVisibleTweet() {
  const articles = document.querySelectorAll('article[data-testid="tweet"]');

  for (const article of articles) {
    const rect = article.getBoundingClientRect();
    // The first article whose bottom is below the top of the viewport
    // (i.e. it's at least partially visible)
    if (rect.bottom > 0 && rect.top < window.innerHeight) {
      return article;
    }
  }

  return null;
}

/**
 * Extract tweet info from an <article> DOM element.
 * Returns { tweetId, author, displayName, textPreview, url } or null.
 */
export function getTweetInfo(articleEl) {
  if (!articleEl) return null;

  try {
    // Find the permalink: <a> with href matching /username/status/id
    const links = articleEl.querySelectorAll('a[href*="/status/"]');
    let permalink = null;
    let tweetId = null;
    let author = null;

    for (const link of links) {
      const match = link.href.match(/x\.com\/([^/]+)\/status\/(\d+)/);
      if (match) {
        author = `@${match[1]}`;
        tweetId = match[2];
        permalink = link.href;
        break;
      }
    }

    if (!tweetId) return null;

    // Display name: first <span> inside the user-name test id area
    let displayName = author;
    const userNameEl = articleEl.querySelector('[data-testid="User-Name"]');
    if (userNameEl) {
      // The display name is typically the first link's text
      const nameLink = userNameEl.querySelector('a span');
      if (nameLink) {
        displayName = nameLink.textContent.trim();
      }
    }

    // Tweet text
    const tweetTextEl = articleEl.querySelector('[data-testid="tweetText"]');
    const fullText = tweetTextEl?.textContent ?? '';
    const textPreview = fullText.length > 100 ? fullText.slice(0, 100) + '...' : fullText;

    return {
      tweetId,
      author,
      displayName,
      textPreview,
      url: permalink,
    };
  } catch {
    return null;
  }
}

/**
 * Find a tweet in the DOM by its status ID.
 * Returns the <article> element or null.
 */
export function findTweetById(tweetId) {
  if (!tweetId) return null;

  const articles = document.querySelectorAll('article[data-testid="tweet"]');
  for (const article of articles) {
    const link = article.querySelector(`a[href*="/status/${tweetId}"]`);
    if (link) return article;
  }

  return null;
}

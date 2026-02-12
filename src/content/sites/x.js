/**
 * X.com (Twitter) site adapter.
 *
 * X.com renders tweets as <article> elements with `data-testid="tweet"`.
 * Each tweet contains a permalink <a> with href like /username/status/12345.
 */

/**
 * Find the topmost visible tweet article in the viewport.
 */
export function getTopVisiblePost() {
  const articles = document.querySelectorAll('article[data-testid="tweet"]');

  for (const article of articles) {
    const rect = article.getBoundingClientRect();
    if (rect.bottom > 0 && rect.top < window.innerHeight) {
      return article;
    }
  }

  return null;
}

/**
 * Extract post info from an <article> DOM element.
 * Returns { postId, author, displayName, textPreview, url } or null.
 */
export function getPostInfo(articleEl) {
  if (!articleEl) return null;

  try {
    const links = articleEl.querySelectorAll('a[href*="/status/"]');
    let permalink = null;
    let postId = null;
    let author = null;

    for (const link of links) {
      const match = link.href.match(/x\.com\/([^/]+)\/status\/(\d+)/);
      if (match) {
        author = `@${match[1]}`;
        postId = match[2];
        permalink = link.href;
        break;
      }
    }

    if (!postId) return null;

    let displayName = author;
    const userNameEl = articleEl.querySelector('[data-testid="User-Name"]');
    if (userNameEl) {
      const nameLink = userNameEl.querySelector('a span');
      if (nameLink) {
        displayName = nameLink.textContent.trim();
      }
    }

    const tweetTextEl = articleEl.querySelector('[data-testid="tweetText"]');
    const fullText = tweetTextEl?.textContent ?? '';
    const textPreview = fullText.length > 100 ? fullText.slice(0, 100) + '...' : fullText;

    return {
      postId,
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
 */
export function findPostById(postId) {
  if (!postId) return null;

  const articles = document.querySelectorAll('article[data-testid="tweet"]');
  for (const article of articles) {
    const link = article.querySelector(`a[href*="/status/${postId}"]`);
    if (link) return article;
  }

  return null;
}

/**
 * Check if the current page is a timeline page.
 */
export function isTimelinePage() {
  const path = location.pathname;
  return path === '/' || path === '/home' || path === '/following';
}

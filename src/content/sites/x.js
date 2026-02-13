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
 * Find the tweet article ancestor of a clicked element.
 */
export function getPostElement(el) {
  return el?.closest('article[data-testid="tweet"]') ?? null;
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
 * Return an array of post elements above the given element in the feed.
 */
export function getPostsAbove(el) {
  const posts = [];
  const articles = document.querySelectorAll('article[data-testid="tweet"]');

  for (const article of articles) {
    // Stop once we reach the reference element or anything after it
    if (article.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) {
      posts.push(article);
    } else {
      break;
    }
  }

  return posts;
}

/**
 * Check if an element is X.com's native "Show N posts" button that appears
 * at the top of the timeline when new posts are available.
 */
export function isShowNewPostsButton(el) {
  // The button is a non-tweet cell in the timeline with text like "Show 5 posts"
  const cell = el?.closest('[data-testid="cellInnerDiv"]');
  if (!cell) return false;

  // It should NOT contain a tweet article
  if (cell.querySelector('article[data-testid="tweet"]')) return false;

  const text = cell.textContent?.trim() ?? '';
  return /show\s+\d*\s*post/i.test(text);
}

/**
 * Check if the current page is a timeline page.
 */
export function isTimelinePage() {
  const path = location.pathname;
  return path === '/' || path === '/home' || path === '/following';
}

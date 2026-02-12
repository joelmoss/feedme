/**
 * Bluesky (bsky.app) site adapter.
 *
 * Bluesky renders feed items with `data-testid="feedItem-by-{handle}"`.
 * Post text uses `data-testid="postText"`.
 * Post URLs follow: /profile/{handle}/post/{rkey}
 */

/**
 * Find the topmost visible feed item in the viewport.
 */
export function getTopVisiblePost() {
  const items = document.querySelectorAll('[data-testid^="feedItem-by-"]');

  for (const item of items) {
    const rect = item.getBoundingClientRect();
    if (rect.bottom > 0 && rect.top < window.innerHeight) {
      return item;
    }
  }

  return null;
}

/**
 * Extract post info from a feed item DOM element.
 * Returns { postId, author, displayName, textPreview, url } or null.
 */
export function getPostInfo(itemEl) {
  if (!itemEl) return null;

  try {
    // Find the post permalink: <a> with href matching /profile/{handle}/post/{rkey}
    const links = itemEl.querySelectorAll('a[href*="/post/"]');
    let permalink = null;
    let postId = null;
    let author = null;

    for (const link of links) {
      const match = link.href.match(/bsky\.app\/profile\/([^/]+)\/post\/([^/?#]+)/);
      if (match) {
        author = `@${match[1]}`;
        postId = match[2];
        permalink = link.href;
        break;
      }
    }

    if (!postId) return null;

    // Display name: extract from the testid attribute
    let displayName = author;
    const testId = itemEl.getAttribute('data-testid');
    if (testId) {
      const handleMatch = testId.match(/^feedItem-by-(.+)$/);
      if (handleMatch) {
        displayName = `@${handleMatch[1]}`;
      }
    }

    // Try to find a more specific display name from the DOM
    // Bluesky shows display name and handle in the post header
    const allLinks = itemEl.querySelectorAll('a[href*="/profile/"]');
    for (const link of allLinks) {
      // Skip the post permalink links, look for profile-only links
      if (link.href.includes('/post/')) continue;
      const text = link.textContent?.trim();
      if (text && text.length > 0 && !text.startsWith('@') && text !== displayName) {
        displayName = text;
        break;
      }
    }

    // Post text
    const textEl = itemEl.querySelector('[data-testid="postText"]');
    const fullText = textEl?.textContent ?? '';
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
 * Find the feed item ancestor of a clicked element.
 */
export function getPostElement(el) {
  return el?.closest('[data-testid^="feedItem-by-"]') ?? null;
}

/**
 * Find a post in the DOM by its rkey.
 */
export function findPostById(postId) {
  if (!postId) return null;

  const items = document.querySelectorAll('[data-testid^="feedItem-by-"]');
  for (const item of items) {
    const link = item.querySelector(`a[href*="/post/${postId}"]`);
    if (link) return item;
  }

  return null;
}

/**
 * Return an array of post elements above the given element in the feed.
 */
export function getPostsAbove(el) {
  const posts = [];
  const items = document.querySelectorAll('[data-testid^="feedItem-by-"]');

  for (const item of items) {
    if (item.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) {
      posts.push(item);
    } else {
      break;
    }
  }

  return posts;
}

/**
 * Check if the current page is a feed/timeline page.
 * Bluesky timelines: / (home), /feeds, custom feeds at /profile/.../feed/...
 */
export function isTimelinePage() {
  const path = location.pathname;
  return path === '/' || path.startsWith('/feeds') || path.match(/^\/profile\/[^/]+\/feed\//);
}

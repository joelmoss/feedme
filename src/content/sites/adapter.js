/**
 * Site adapter factory.
 *
 * Returns the appropriate adapter for the current site (x.com or bsky.app).
 * Each adapter provides: getTopVisiblePost, getPostInfo, findPostById, isTimelinePage.
 */

import * as x from './x.js';
import * as bsky from './bsky.js';

export function getSiteAdapter() {
  const host = location.hostname;

  if (host === 'x.com' || host === 'www.x.com') {
    return { ...x, site: 'x' };
  }

  if (host === 'bsky.app' || host === 'www.bsky.app') {
    return { ...bsky, site: 'bsky' };
  }

  return null;
}

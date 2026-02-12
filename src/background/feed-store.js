/**
 * In-memory feed store with persistence to chrome.storage.local.
 * Maintains a sorted, deduplicated list of FeedItems.
 */

import { STORAGE_KEYS, MAX_FEED_ITEMS } from '../shared/constants.js';
import { storageGet, storageSet } from '../shared/storage.js';

let items = [];
let initialized = false;

/**
 * Restore feed from storage (call on service worker wake-up).
 */
export async function initStore() {
  if (initialized) return;
  const saved = await storageGet(STORAGE_KEYS.FEED_ITEMS);
  if (Array.isArray(saved)) {
    items = saved;
  }
  initialized = true;
}

/**
 * Insert new items, deduplicate by id, sort by createdAt descending,
 * cap at MAX_FEED_ITEMS, and persist.
 * Returns true if any new items were added.
 */
export async function ingestItems(newItems) {
  if (!newItems || newItems.length === 0) return false;

  const existingIds = new Set(items.map((it) => it.id));
  const toAdd = newItems.filter((it) => {
    if (!it || existingIds.has(it.id)) return false;
    existingIds.add(it.id); // prevent dupes within newItems
    return true;
  });

  if (toAdd.length === 0) return false;

  items = items.concat(toAdd);

  // Sort newest first
  items.sort((a, b) => {
    const da = new Date(a.createdAt).getTime();
    const db = new Date(b.createdAt).getTime();
    return db - da;
  });

  // Cap size
  if (items.length > MAX_FEED_ITEMS) {
    items = items.slice(0, MAX_FEED_ITEMS);
  }

  await persist();
  return true;
}

/**
 * Get all feed items (newest first).
 */
export function getItems() {
  return items;
}

/**
 * Clear all items from the store and storage.
 */
export async function clearItems() {
  items = [];
  await persist();
}

/**
 * Write current items to chrome.storage.local.
 */
async function persist() {
  await storageSet(STORAGE_KEYS.FEED_ITEMS, items);
}

/**
 * Thin wrapper around chrome.storage.local for convenience.
 */
export async function storageGet(key) {
  const result = await chrome.storage.local.get(key);
  return result[key] ?? null;
}

export async function storageSet(key, value) {
  await chrome.storage.local.set({ [key]: value });
}

export async function storageRemove(key) {
  await chrome.storage.local.remove(key);
}

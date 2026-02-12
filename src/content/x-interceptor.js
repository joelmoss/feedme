/**
 * Content script injected into x.com at document_start.
 * Intercepts fetch responses from X.com's internal GraphQL API
 * to capture timeline data without needing API keys.
 */

import { X_TIMELINE_ENDPOINTS, MSG } from '../shared/constants.js';

const originalFetch = window.fetch;

window.fetch = async function (...args) {
  const response = await originalFetch.apply(this, args);

  try {
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;
    if (!url) return response;

    // Check if this is a timeline endpoint we care about
    const isTimeline = X_TIMELINE_ENDPOINTS.some((ep) => url.includes(ep));
    if (!isTimeline) return response;

    // Clone so we don't consume the body that x.com needs
    const cloned = response.clone();
    cloned.json().then((json) => {
      chrome.runtime.sendMessage({
        type: MSG.X_FEED_DATA,
        payload: json,
      });
    }).catch(() => {
      // Silently ignore parse failures
    });
  } catch {
    // Never break the host page
  }

  return response;
};

// Also intercept XMLHttpRequest for older code paths
const XHROpen = XMLHttpRequest.prototype.open;
const XHRSend = XMLHttpRequest.prototype.send;

XMLHttpRequest.prototype.open = function (method, url, ...rest) {
  this._feedmeUrl = url;
  return XHROpen.call(this, method, url, ...rest);
};

XMLHttpRequest.prototype.send = function (...args) {
  const url = this._feedmeUrl;

  if (url && X_TIMELINE_ENDPOINTS.some((ep) => url.includes(ep))) {
    this.addEventListener('load', function () {
      try {
        const json = JSON.parse(this.responseText);
        chrome.runtime.sendMessage({
          type: MSG.X_FEED_DATA,
          payload: json,
        });
      } catch {
        // Silently ignore
      }
    });
  }

  return XHRSend.apply(this, args);
};

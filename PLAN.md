# FeedMe — X.com Scroll Position Marker

A Chrome extension that remembers where you stopped reading on X.com.
When you stop scrolling for 1 minute, it drops a visual marker below the
top-most visible post. When you return, it restores the marker and scrolls
you back to where you left off. A sidebar shows your current position and
a history of past positions.

---

## How It Works

```
User scrolls x.com timeline
  → stops scrolling
  → 1 minute of no scroll activity
  → content script finds the topmost visible tweet
  → injects a visual marker ("You left off here") below that tweet
  → saves the tweet identifier + timestamp to chrome.storage.local

User navigates away and comes back to x.com
  → content script reads saved position from storage
  → waits for timeline to load
  → finds the saved tweet in the DOM (or nearest match)
  → injects the marker and scrolls to it

User opens sidebar
  → sees current marker position (tweet author, text preview, time)
  → sees history of past marker positions
  → can click any history entry to jump to that position
  → can clear history
```

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                  Chrome Extension                     │
│                                                       │
│  ┌────────────────────┐    ┌───────────────────────┐ │
│  │  Content Script     │    │  Background Service   │ │
│  │  (x.com)            │    │  Worker               │ │
│  │                     │    │                        │ │
│  │ - Scroll listener   │    │ - Message routing      │ │
│  │ - 1-min idle timer  │    │ - Storage management   │ │
│  │ - Find top tweet    │    │ - Side panel setup     │ │
│  │ - Inject/remove     │    │                        │ │
│  │   marker DOM node   │    │                        │ │
│  │ - Restore on load   │    │                        │ │
│  └─────────┬──────────┘    └──────────┬─────────────┘ │
│            │  messages                │               │
│            └──────────┐  ┌────────────┘               │
│                       ▼  ▼                            │
│            ┌──────────────────────┐                   │
│            │   Side Panel UI      │                   │
│            │                      │                   │
│            │ - Current position   │                   │
│            │ - Position history   │                   │
│            │ - Jump to / clear    │                   │
│            └──────────────────────┘                   │
│                                                       │
│            ┌──────────────────────┐                   │
│            │ chrome.storage.local │                   │
│            │                      │                   │
│            │ - Current position   │                   │
│            │ - History array      │                   │
│            └──────────────────────┘                   │
└──────────────────────────────────────────────────────┘
```

---

## Project Structure

```
feedme/
├── manifest.json
├── package.json
├── vite.config.js
├── vitest.config.js
├── src/
│   ├── content/
│   │   ├── scroll-tracker.js    # Scroll idle detection + marker placement
│   │   ├── marker.js            # Marker DOM creation/removal/styling
│   │   └── tweet-finder.js      # Find topmost tweet, extract tweet info
│   ├── background/
│   │   └── index.js             # Message handler + side panel setup
│   ├── panel/
│   │   ├── index.html           # Side panel shell
│   │   ├── panel.js             # Panel logic (render position + history)
│   │   └── panel.css            # Panel styles
│   └── shared/
│       ├── storage.js           # chrome.storage.local wrapper
│       └── constants.js         # Storage keys, message types, config
└── tests/
    ├── scroll-tracker.test.js
    ├── tweet-finder.test.js
    └── storage.test.js
```

---

## Implementation Steps

### Phase 1: Scaffolding

1. **Update `manifest.json`** for the new simpler extension
   - Permissions: `storage`, `sidePanel`, `activeTab`
   - Content script on `https://x.com/*` at `document_idle`
   - Background service worker
   - Side panel

2. **Update `vite.config.js`** for new entry points
   - content script, background worker, panel HTML

### Phase 2: Content Script — Scroll Detection & Marker

3. **`tweet-finder.js`** — DOM utilities for x.com's timeline
   - `getTopVisibleTweet()` — find the tweet element closest to the
     top of the viewport
   - `getTweetInfo(tweetEl)` — extract tweet ID, author, text preview,
     and permalink from the DOM node
   - `findTweetById(tweetId)` — locate a tweet element by its data
     attribute or link href

4. **`marker.js`** — visual marker element
   - `createMarker()` — returns a styled DOM element:
     "📍 You left off here — <relative time>"
   - `insertMarkerAfter(tweetEl)` — places marker below a tweet
   - `removeMarker()` — removes any existing marker from the page
   - Styled to be noticeable but not intrusive (coloured bar with text)

5. **`scroll-tracker.js`** — the core logic
   - Listen for `scroll` events on the timeline scroll container
   - On each scroll, reset a 60-second idle timer
   - When the timer fires (user hasn't scrolled for 1 minute):
     1. Call `getTopVisibleTweet()` to find the top tweet
     2. Call `getTweetInfo()` to extract its details
     3. Call `removeMarker()` then `insertMarkerAfter()` to place marker
     4. Save position to storage via message to background worker
     5. Add to position history
   - On page load / navigation:
     1. Read saved position from storage
     2. Wait for timeline DOM to be ready (MutationObserver)
     3. Try to find the saved tweet, inject marker, scroll to it

### Phase 3: Background Service Worker

6. **`background/index.js`**
   - Handle messages: `SAVE_POSITION`, `GET_POSITION`, `GET_HISTORY`,
     `CLEAR_HISTORY`, `JUMP_TO_POSITION`
   - Manage storage reads/writes
   - Open side panel on extension icon click

### Phase 4: Side Panel

7. **`panel/`** — simple HTML + vanilla JS
   - Current position card: shows tweet author, text preview, timestamp,
     "Jump to" button
   - History list: past positions with author, preview, timestamp
   - Clear history button
   - Empty states when no position is saved
   - Communicates with background via `chrome.runtime.sendMessage`

### Phase 5: Polish

8. **Handle x.com SPA navigation** — x.com is a single-page app, so
   detect route changes (URL changes without full reload) and re-init
   the scroll tracker

9. **Handle timeline DOM changes** — x.com virtualises its timeline
   (removes off-screen tweets). Use MutationObserver to re-inject the
   marker if its parent tweet gets removed and re-added.

10. **Tests**
    - `tweet-finder.test.js` — DOM parsing with mock tweet HTML
    - `scroll-tracker.test.js` — timer logic, idle detection
    - `storage.test.js` — storage wrapper round-trips

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| 1-minute idle threshold | Long enough to indicate intentional stopping, not just pausing to read a tweet |
| Content script at `document_idle` | Timeline DOM needs to exist before we can observe it |
| Marker injected into x.com DOM | User sees it in-context, right in their feed |
| Side panel (not popup) | Can stay open while browsing; shows history at a glance |
| Position history capped at 50 | Enough to be useful without bloating storage |
| Tweet identified by status URL | Stable across page reloads; derived from `<a>` href in tweet DOM |

---

## Stored Data Shape

```js
// Current position (chrome.storage.local)
{
  "feedme:position": {
    tweetId: "1234567890",        // status ID from URL
    author: "@username",
    displayName: "Display Name",
    textPreview: "First 100 chars of tweet...",
    url: "https://x.com/username/status/1234567890",
    savedAt: "2024-01-15T10:30:00Z"
  },

  "feedme:history": [
    // same shape as position, newest first, max 50
  ]
}
```

# FeedMe — Chrome Extension Implementation Plan

A Chrome extension that combines X.com and Bluesky feeds into a single unified
timeline, with persistent read-position tracking.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                   Chrome Extension                       │
│                                                          │
│  ┌──────────────┐   messages   ┌──────────────────────┐ │
│  │ Content Script│ ──────────> │  Background Service   │ │
│  │  (x.com)     │             │  Worker               │ │
│  │              │             │                        │ │
│  │ Intercepts   │             │ - Bluesky API client   │ │
│  │ XHR/fetch to │             │ - Feed merge engine    │ │
│  │ capture feed │             │ - Storage manager      │ │
│  │ data from    │             │ - Auth token mgmt      │ │
│  │ Twitter API  │             │                        │ │
│  └──────────────┘             └──────────┬─────────────┘ │
│                                          │               │
│  ┌──────────────────────────────────┐    │               │
│  │        Side Panel UI             │<───┘               │
│  │                                  │                    │
│  │ - Unified chronological feed     │                    │
│  │ - Read position indicator        │                    │
│  │ - Platform badges (X / Bsky)     │                    │
│  │ - Settings / auth management     │                    │
│  └──────────────────────────────────┘                    │
│                                                          │
│  ┌──────────────────────────────────┐                    │
│  │      chrome.storage.local        │                    │
│  │                                  │                    │
│  │ - Read position per platform     │                    │
│  │ - Cached feed items              │                    │
│  │ - Bluesky session tokens         │                    │
│  │ - User preferences               │                    │
│  └──────────────────────────────────┘                    │
└─────────────────────────────────────────────────────────┘
```

---

## Key Design Decisions

### 1. X.com Feed Data: XHR Interception (no API key)

The X API free tier allows only **100 reads/month** — unusable for a feed
reader. Paid tiers start at **$200/month**.

Instead, the extension injects a content script into x.com at `document_start`
that overrides `XMLHttpRequest` and `fetch` to intercept responses from
Twitter's internal API endpoints (e.g., `/HomeTimeline`, `/HomeLatestTimeline`).
This captures the same structured JSON the X.com frontend already receives —
no separate API key, no rate limits, no cost.

The user must have x.com open in a tab (and be logged in) for this to work.

### 2. Bluesky Feed Data: Direct AT Protocol API

Bluesky's API is **free and open** with generous rate limits (3,000 req / 5 min).
The service worker calls `app.bsky.feed.getTimeline` directly using session
tokens obtained via app password authentication (simple `createSession` call).

### 3. Side Panel UI (not popup)

Chrome's Side Panel API (`chrome.sidePanel`) keeps the feed visible alongside
normal browsing, unlike a popup that closes when you click away. This is the
right UX for a feed reader — you can scroll through your feed while interacting
with other tabs.

### 4. Read Position Tracking

Each post in the unified feed has a composite ID (`platform:postId`). When the
user scrolls, the extension records the ID of the topmost visible post via an
`IntersectionObserver`. This is debounced and persisted to
`chrome.storage.local`. On reopen, the feed loads cached items and scrolls to
the saved position.

---

## Project Structure

```
feedme/
├── manifest.json
├── package.json
├── tsconfig.json
├── vite.config.ts              # Build config (Vite multi-entry)
├── src/
│   ├── background/
│   │   ├── index.ts            # Service worker entry point
│   │   ├── bluesky-client.ts   # Bluesky AT Protocol API client
│   │   ├── feed-store.ts       # Feed caching & merge logic
│   │   └── message-handler.ts  # Handle messages from content/panel
│   ├── content/
│   │   └── x-interceptor.ts    # Content script for x.com XHR interception
│   ├── panel/
│   │   ├── index.html          # Side panel HTML shell
│   │   ├── index.ts            # Panel entry — registers custom elements
│   │   ├── components/
│   │   │   ├── feed-panel.ts   # <feed-panel> — root element, routing
│   │   │   ├── feed-list.ts    # <feed-list> — scrollable unified feed
│   │   │   ├── feed-item.ts    # <feed-item> — single post card
│   │   │   ├── read-marker.ts  # <read-marker> — "You left off here"
│   │   │   └── feed-settings.ts # <feed-settings> — auth & preferences
│   │   └── styles.css          # Panel styles (or inlined in shadow DOM)
│   ├── shared/
│   │   ├── types.ts            # Shared TypeScript types
│   │   ├── storage.ts          # chrome.storage wrapper
│   │   └── constants.ts        # Keys, URLs, defaults
│   └── lib/
│       └── normalizer.ts       # Normalize X/Bsky posts into unified format
├── public/
│   └── icons/                  # Extension icons (16, 48, 128)
└── tests/
    ├── normalizer.test.ts
    ├── feed-store.test.ts
    └── bluesky-client.test.ts
```

---

## Implementation Steps

### Phase 1: Project Scaffolding

1. **Initialize the project**
   - `package.json` with TypeScript, Vite, and `@atproto/api` for Bluesky
     (no framework dependencies — UI is vanilla custom elements)
   - `tsconfig.json` with strict mode
   - Vite config for building content script, service worker, and panel
     separately (Chrome extensions need separate bundles)

2. **Create `manifest.json`** (Manifest V3)
   - Permissions: `storage`, `sidePanel`, `alarms`
   - Host permissions: `https://x.com/*`, `https://bsky.social/*`,
     `https://bsky.app/*`, `https://*.bsky.network/*`,
     `https://public.api.bsky.app/*`
   - Content script targeting `https://x.com/*` with `run_at: document_start`
   - Background service worker
   - Side panel configuration

3. **Set up build pipeline**
   - Vite multi-entry build producing: `dist/content.js`,
     `dist/background.js`, `dist/panel/index.html`
   - Dev mode with watch + auto-reload

### Phase 2: X.com Feed Capture (Content Script)

4. **Build the XHR/fetch interceptor** (`src/content/x-interceptor.ts`)
   - Inject at `document_start` before X.com's own scripts run
   - Override `window.fetch` to intercept responses from X.com's internal
     GraphQL endpoints:
     - `HomeTimeline` — algorithmic feed
     - `HomeLatestTimeline` — reverse-chronological feed
   - Parse the JSON response to extract tweet objects (text, author, media,
     timestamps, IDs)
   - Forward extracted tweets to the service worker via
     `chrome.runtime.sendMessage`

5. **Normalize X.com tweet data** (`src/lib/normalizer.ts`)
   - Map X.com's internal tweet format to a unified `FeedItem` type:
     ```ts
     interface FeedItem {
       id: string              // "x:<tweetId>" or "bsky:<postUri>"
       platform: "x" | "bsky"
       author: {
         handle: string
         displayName: string
         avatarUrl: string
       }
       text: string
       createdAt: Date         // used for chronological merge
       media?: MediaItem[]
       repostBy?: string       // if this is a repost/retweet
       url: string             // link to original post
     }
     ```

### Phase 3: Bluesky Feed Client (Service Worker)

6. **Implement Bluesky authentication** (`src/background/bluesky-client.ts`)
   - `createSession` with handle + app password
   - Store `accessJwt` and `refreshJwt` in `chrome.storage.local`
   - Auto-refresh: use `chrome.alarms` to refresh the token before expiry
   - `refreshSession` on 401 responses

7. **Implement Bluesky timeline fetcher**
   - Call `app.bsky.feed.getTimeline` with cursor-based pagination
   - Parse response into the same `FeedItem` format via the normalizer
   - Handle rate limiting (back off on 429)

### Phase 4: Feed Merge & Storage

8. **Build the feed store** (`src/background/feed-store.ts`)
   - Maintain an in-memory sorted array of `FeedItem` objects, ordered by
     `createdAt` descending
   - Deduplicate by `id`
   - Accept new items from both X (via content script messages) and Bluesky
     (via periodic fetch)
   - Persist the latest N items (e.g., 500) to `chrome.storage.local` so the
     feed is available immediately on panel open
   - Periodic Bluesky fetch: use `chrome.alarms` to poll every 2-3 minutes

9. **Build the message handler** (`src/background/message-handler.ts`)
   - Handle messages from content script: `X_FEED_DATA` → ingest into store
   - Handle messages from panel: `GET_FEED`, `GET_READ_POSITION`,
     `SET_READ_POSITION`, `GET_SETTINGS`, `SAVE_SETTINGS`,
     `LOGIN_BLUESKY`, `LOGOUT_BLUESKY`

### Phase 5: Side Panel UI

10. **Create the side panel shell** (`src/panel/`)
    - Plain HTML (`panel/index.html`) that loads `index.ts`
    - `index.ts` registers all custom elements and inserts `<feed-panel>`
    - Communicates with service worker via `chrome.runtime.sendMessage`

11. **Build `<feed-list>` custom element** (`src/panel/components/feed-list.ts`)
    - Extends `HTMLElement`, uses Shadow DOM for style encapsulation
    - Renders `<feed-item>` elements for each post in the merged feed
    - Each `<feed-item>` shows: platform badge, author avatar+name, post text,
      media thumbnails, timestamp, link to original
    - Infinite scroll: `IntersectionObserver` on a sentinel element at the
      bottom triggers loading older items from the store
    - DOM recycling: reuse off-screen `<feed-item>` nodes rather than
      creating/destroying — keeps the DOM lightweight with hundreds of posts

12. **Build `<read-marker>` custom element** (`src/panel/components/read-marker.ts`)
    - When the feed loads, insert a visual divider ("You left off here")
      between the last-read post and newer posts
    - Automatically scroll to this element on panel open

13. **Implement read position tracking** (inside `<feed-list>`)
    - Use `IntersectionObserver` on `<feed-item>` elements to detect which
      post is at the top of the viewport
    - Debounce (500ms) and save the topmost visible post ID to storage via
      `chrome.runtime.sendMessage({ type: 'SET_READ_POSITION', id })`
    - On panel open: retrieve saved position, find the corresponding item in
      the feed, scroll to it

14. **Build `<feed-settings>` custom element** (`src/panel/components/feed-settings.ts`)
    - Bluesky login form (handle + app password)
    - Connection status indicators for both platforms
    - X.com: show status (requires x.com tab open to capture feed)
    - Option to clear cached feed / reset read position

### Phase 6: Polish & Edge Cases

15. **Handle service worker lifecycle**
    - Service workers can be terminated by Chrome after ~30s of inactivity
    - On wake-up: restore feed store from `chrome.storage.local`
    - Use `chrome.alarms` (not `setInterval`) for periodic Bluesky polling

16. **Handle X.com tab requirement**
    - Show a notice in the panel when no X.com data has been received
    - Optionally: badge the extension icon to indicate X.com feed is stale

17. **Handle authentication edge cases**
    - Bluesky token refresh failures → prompt re-login
    - X.com logged-out state → interceptor detects no feed data

18. **Add basic tests**
    - Unit tests for the normalizer (X format → FeedItem, Bsky format →
      FeedItem)
    - Unit tests for feed store merge/dedup logic
    - Unit tests for read position storage

---

## Technology Choices

| Concern             | Choice                          | Rationale                                                    |
|---------------------|---------------------------------|--------------------------------------------------------------|
| Language            | TypeScript                      | Type safety across content script, worker, and UI            |
| Build tool          | Vite + manual multi-entry       | Fast builds, good TS support, flexible output config         |
| UI                  | Vanilla JS + Custom Elements    | Zero dependencies, Shadow DOM encapsulation, native platform |
| Bluesky SDK         | `@atproto/api`                  | Official SDK, handles session management                     |
| List performance    | DOM recycling + IntersectionObserver | No library needed; reuse off-screen nodes manually       |
| Storage             | `chrome.storage.local`          | Persistent, accessible from all extension contexts           |
| Testing             | Vitest                          | Fast, native TS support, works with Vite                     |

---

## Data Flow: End to End

### Capturing X.com feed
```
User browses x.com
  → X.com frontend fetches /HomeLatestTimeline (internal GraphQL)
  → Content script intercepts the fetch response
  → Parses JSON, extracts tweet objects
  → Sends via chrome.runtime.sendMessage to service worker
  → Service worker normalizes tweets → FeedItem[]
  → Merges into feed store, persists to chrome.storage.local
```

### Fetching Bluesky feed
```
chrome.alarms fires every 2 min
  → Service worker calls app.bsky.feed.getTimeline
  → Parses response, normalizes to FeedItem[]
  → Merges into feed store, persists to chrome.storage.local
```

### Displaying unified feed
```
User opens side panel
  → Panel sends GET_FEED message to service worker
  → Service worker returns merged FeedItem[] from store
  → Panel also sends GET_READ_POSITION
  → Panel renders feed with ReadMarker at saved position
  → Scrolls to ReadMarker automatically
```

### Tracking read position
```
User scrolls in panel
  → IntersectionObserver detects topmost visible FeedItem
  → Debounced (500ms): sends SET_READ_POSITION to service worker
  → Service worker persists to chrome.storage.local
```

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| X.com changes internal API format | Feed capture breaks | Normalizer is isolated; update the parsing logic. Log raw intercepted data to aid debugging. |
| X.com adds anti-extension measures | Content script blocked | Fallback: manual paste of X.com export data, or paid API integration as optional path |
| Service worker termination | Lost in-memory state | Always restore from `chrome.storage.local` on wake. Keep storage writes frequent. |
| Bluesky rate limits hit | Temporary feed staleness | Exponential backoff; display "last updated" timestamp in UI |
| Large feed cache | Storage bloat | Cap cached items at 500; prune oldest on insert |

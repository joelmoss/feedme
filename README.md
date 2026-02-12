# FeedMe

A Chrome extension that combines your X.com and Bluesky feeds into a single unified timeline, with persistent read-position tracking.

## Features

- **Unified timeline** — X.com and Bluesky posts merged chronologically in one view
- **X.com feed capture** — Intercepts timeline data from x.com (no API key needed, no rate limits)
- **Bluesky integration** — Connects via AT Protocol with app password authentication
- **Read position tracking** — Remembers where you left off and scrolls back to it
- **Side panel UI** — Stays open alongside your normal browsing via Chrome's Side Panel API
- **Dark theme** — Purpose-built dark interface

## How It Works

- **X.com**: A content script injected into x.com intercepts fetch/XHR responses from Twitter's internal GraphQL API (`HomeTimeline`, `HomeLatestTimeline`). You must have x.com open in a tab and be logged in.
- **Bluesky**: The background service worker polls `app.bsky.feed.getTimeline` every 2 minutes using session tokens from app password login.
- **Merge**: Both sources are normalized into a common format, deduplicated, sorted by date, and stored in `chrome.storage.local`.

## Setup

```
npm install
npm run build
```

Then load the `dist/` directory as an unpacked extension in Chrome:

1. Go to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `dist/` folder

## Development

```
npm run dev       # Build with watch mode
npm test          # Run tests
npm run test:watch # Run tests in watch mode
```

## Project Structure

```
src/
├── background/          # Service worker
│   ├── index.js         # Entry point, alarms, polling
│   ├── bluesky-client.js # AT Protocol auth & timeline fetch
│   ├── feed-store.js    # In-memory sorted/deduped feed with persistence
│   └── message-handler.js # Routes messages from content script & panel
├── content/
│   └── x-interceptor.js # Intercepts X.com timeline API responses
├── panel/               # Side panel UI (vanilla custom elements)
│   ├── index.html
│   ├── index.js
│   ├── styles.css
│   └── components/
│       ├── feed-panel.js    # Root element with feed/settings navigation
│       ├── feed-list.js     # Scrollable feed with read-position tracking
│       ├── feed-item.js     # Single post card
│       ├── read-marker.js   # "You left off here" divider
│       └── feed-settings.js # Bluesky login & preferences
├── shared/
│   ├── constants.js     # Storage keys, message types, config
│   └── storage.js       # chrome.storage.local wrapper
└── lib/
    └── normalizer.js    # Normalizes X.com & Bluesky posts into unified format
```

## Usage

1. **X.com** — Just browse x.com normally. The extension captures feed data automatically.
2. **Bluesky** — Open the side panel, go to Settings, and log in with your handle and an [app password](https://bsky.app/settings/app-passwords).
3. **Reading** — Click the extension icon to open the side panel. Your unified feed appears with a marker showing where you left off.

# FeedMe

A Chrome extension that remembers where you stopped reading on X.com. When you stop scrolling for 1 minute, it drops a visual marker below the topmost visible tweet. When you come back, it restores the marker and scrolls you to where you left off.

## Features

- **Scroll position marker** — stop scrolling for 1 minute and a marker appears below your last-read tweet
- **Automatic restore** — return to x.com and it scrolls back to your marker
- **Position history** — sidebar shows your current position and a log of past positions
- **Jump to any position** — click any history entry to navigate back to that tweet

## How It Works

1. A content script runs on x.com and listens for scroll events
2. When you stop scrolling for 60 seconds, it finds the topmost visible tweet
3. A visual marker ("You left off here") is injected below that tweet
4. The tweet's ID, author, and text preview are saved to `chrome.storage.local`
5. When you return to x.com, the extension finds the saved tweet and scrolls to it

## Setup

```
npm install
npm run build
```

Load the extension in Chrome:

1. Go to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `dist/` folder

## Development

```
npm run dev        # Build with watch mode
npm test           # Run tests
npm run test:watch # Run tests in watch mode
```

## Project Structure

```
src/
├── content/
│   ├── scroll-tracker.js  # Scroll idle detection, marker placement, position restore
│   ├── marker.js          # Marker DOM creation/removal/styling
│   └── tweet-finder.js    # Find topmost tweet, extract info, find by ID
├── background/
│   └── index.js           # Message handler, storage ops, side panel setup
├── panel/
│   ├── index.html         # Side panel shell
│   ├── panel.js           # Renders current position + history
│   └── panel.css          # Panel styles
└── shared/
    ├── constants.js       # Storage keys, message types, config
    └── storage.js         # chrome.storage.local wrapper
```

## Usage

1. Browse x.com normally
2. Stop scrolling — after 1 minute of inactivity, a blue marker appears below the top tweet
3. Navigate away and come back — the extension scrolls you to the marker
4. Click the extension icon to open the sidebar with your current position and history

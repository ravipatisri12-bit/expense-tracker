# LEDGR

A mobile-first dark-themed expense tracker PWA with natural language input, AI-powered insights, and Firebase sync.

## Features

- **Natural Language Input** — Type `100 at castilla on food 02/18` and Ledgr parses it automatically via Gemini 2.0 Flash-Lite
- **AI Spending Insights** — Behavioral coaching powered by Gemini, with smart fallback to local computed insights
- **Firebase Sync** — Google auth + Firestore cloud sync with offline localStorage fallback
- **Eating Out Streak** — Tracks consecutive days without spending on food
- **Monthly Report** — Collapsible card showing spent, saved, and overall totals
- **Spending Trends** — Daily and weekly bar charts with toggle
- **Category Breakdown** — Color-coded pie chart with badge indicators
- **Privacy Mode** — One-tap blur on all monetary values
- **PWA** — Installable on iOS and Android with offline support

## Design

- Material Design 3 dark theme
- Gradient accents (`#667eea` → `#764ba2`)
- Muted coral (`#cf6679`) for negatives, primary blue for positives
- Material Symbols icons throughout — no emojis
- Pill-shaped buttons, tonal dark surfaces

## Quick Start

```bash
git clone https://github.com/ravipatisri12-bit/expense-tracker.git
cd expense-tracker
python3 -m http.server 8000
```

Open `http://localhost:8000`

### Setup

1. **Gemini API** — Tap AI Settings on the Add page, enter your [Gemini API key](https://makersuite.google.com/app/apikey)
2. **Firebase** — Update `js/config.js` with your Firebase project credentials
3. **Income/Budget** — Set monthly income in Settings for accurate saved/overall calculations

## Project Structure

```
├── index.html            # Single-page app (4 tabs)
├── script.js             # Core app logic + all features
├── styles/main.css       # MD3 dark theme + animations
├── manifest.json         # PWA manifest
├── sw.js                 # Service worker
├── js/
│   ├── config.js         # Firebase config
│   ├── auth.js           # Google authentication
│   ├── llm-integration.js # Gemini API + fallback parser
│   ├── smart-input.js    # Batch input processing
│   └── utils.js          # Formatting helpers
└── icon_*.png            # App icons (128, 192, 512)
```

## Tech Stack

- Vanilla JavaScript (ES6+)
- Tailwind CSS + custom MD3 tokens
- Google Gemini 2.0 Flash-Lite
- Firebase (Firestore + Auth)
- Service Worker for offline PWA

## License

MIT

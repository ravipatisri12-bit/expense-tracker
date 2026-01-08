# Modern Expense Tracker

A clean, Apple-inspired expense tracking application built with modern web technologies.

## Features

- **Clean, Minimalist UI**: Apple-inspired design using Tailwind CSS
- **Mobile-First**: Responsive design optimized for mobile devices
- **Real-time Tracking**: Instant updates for daily, weekly, and monthly totals
- **Category Goals**: Visual progress tracking for spending categories
- **Data Export**: Export expenses to CSV format
- **Offline Support**: Progressive Web App with offline functionality
- **Local Storage**: All data saved locally in your browser

## Quick Start

1. Open `index.html` in your web browser
2. Add your first expense using the form
3. Track your spending with real-time updates
4. Install as a PWA for mobile access

## Installation as App

### Mobile (iOS/Android)
1. Open the app in your mobile browser
2. Tap the "Share" button (iOS) or menu (Android)
3. Select "Add to Home Screen"
4. The app will install like a native app

### Desktop
1. Open the app in Chrome, Edge, or Safari
2. Look for the install icon in the address bar
3. Click to install the app

## Categories & Goals

Default monthly spending goals:
- Food: $300
- Transportation: $200
- Entertainment: $150
- Coffee: $50
- Shopping: $200
- Bills: $400
- Other: $100

## Data Management

- All data is stored locally in your browser
- Export to CSV for external analysis
- No personal data is sent to external servers

## Technology Stack

- **Framework**: Vanilla JavaScript (ES6+)
- **Styling**: Tailwind CSS
- **Storage**: localStorage API
- **PWA**: Service Worker for offline support
- **Export**: CSV generation

## Browser Support

- Chrome 80+
- Safari 13+
- Firefox 75+
- Edge 80+

## File Structure

```
modern-expense-tracker/
├── index.html          # Main application
├── script.js           # Application logic
├── manifest.json       # PWA configuration
├── sw.js              # Service worker
└── README.md          # Documentation

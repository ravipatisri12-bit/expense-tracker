# Modern Expense Tracker

A clean, modern expense tracking application with AI-powered smart input using Google Gemini API.

## Features

### Core Features
- **AI-Powered Smart Input**: Add multiple expenses with natural language (e.g., "5 at starbucks 10 at chipotle")
- **Clean, Modern UI**: Consistent design with intuitive navigation
- **Real-time Tracking**: Instant updates for daily, weekly, and monthly totals
- **Category Goals**: Visual progress tracking for spending categories
- **Firebase Integration**: Cloud sync with Google authentication
- **Offline Support**: Progressive Web App with local storage fallback
- **Data Export**: Export expenses to CSV format

### Smart Input Capabilities
- Parse multiple transactions from a single input
- Understand natural language (lazy input supported)
- Automatic category detection
- Batch processing with progress tracking
- Manual entry fallback option

## Quick Start

### Prerequisites
- Modern web browser (Chrome, Safari, Firefox, Edge)
- Python 3 (for local development server)
- Google Gemini API key (free tier available)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd modern-expense-tracker
```

2. Start local server:
```bash
python3 -m http.server 8000
```

3. Open in browser:
```
http://localhost:8000
```

4. Configure AI (optional):
   - Click "AI Settings" in Add Expense page
   - Enter your Google Gemini API key
   - Get free key at: https://makersuite.google.com/app/apikey

## Usage

### Adding Expenses

**Smart Input (Recommended):**
```
5 at starbucks 10 at chipotle 2 at amazon go
```
or
```
Coffee $5, Uber $23, lunch $12
```

**Manual Entry:**
- Click "Manual Entry" button
- Fill in amount, description, category, and date
- Submit

### Viewing Data
- **Dashboard**: Overview of monthly finances
- **Transactions**: Detailed list of all expenses
- **History**: Monthly historical data and comparisons

## Project Structure

```
modern-expense-tracker/
├── index.html              # Main application
├── manifest.json           # PWA configuration
├── sw.js                   # Service worker
├── js/
│   ├── auth.js            # Firebase authentication
│   ├── config.js          # Firebase configuration
│   ├── llm-integration.js # Gemini API integration
│   ├── smart-input.js     # Smart input controller
│   └── utils.js           # Utility functions
├── styles/
│   └── main.css           # Custom styles
├── docs/
│   └── smart-input/       # Smart input documentation
├── tests/                 # Test files
└── glass-ui-prototype/    # Glass UI prototype (separate feature)
```

## Documentation

- [Smart Input Guide](docs/smart-input/SMART-INPUT-GUIDE.md)
- [Developer Setup](docs/smart-input/DEVELOPER-SETUP.md)
- [Gemini Integration](docs/smart-input/GEMINI-INTEGRATION-README.md)
- [Examples](docs/smart-input/EXAMPLES.md)

## Technology Stack

- **Frontend**: Vanilla JavaScript (ES6+)
- **Styling**: Tailwind CSS
- **AI**: Google Gemini API
- **Backend**: Firebase (Firestore + Auth)
- **Storage**: localStorage + Firestore
- **PWA**: Service Worker

## Browser Support

- Chrome 80+
- Safari 13+
- Firefox 75+
- Edge 80+

## Configuration

### Firebase Setup
1. Create Firebase project at https://console.firebase.google.com
2. Enable Firestore and Authentication
3. Update `js/config.js` with your Firebase credentials

### Gemini API Setup
1. Get API key from https://makersuite.google.com/app/apikey
2. Configure in app via "AI Settings" button
3. API key stored locally in browser

## Development

### Running Tests
```bash
# Open test files in browser
open tests/test-smart-input.html
open tests/test-gemini-api.html
```

### Local Development
```bash
# Start server
python3 -m http.server 8000

# Open in browser
open http://localhost:8000
```

## Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

## License

MIT License - feel free to use for personal or commercial projects

## Support

For issues or questions, please open an issue on GitHub.

# 🛠️ Developer Setup Guide - Smart Transaction Input

## Architecture Overview

The smart transaction input system consists of three main components:

### 1. **LLM Integration** (`js/llm-integration.js`)
- `LLMTransactionParser`: Handles AI-powered parsing via OpenAI API
- `VoiceInputHandler`: Manages speech recognition
- Fallback parsing for offline/no-API scenarios

### 2. **Smart Input UI** (`js/smart-input.js`)
- `SmartTransactionInput`: Main UI controller
- Manages natural language input, voice input, and quick-add buttons
- Handles suggestions and form auto-fill

### 3. **Enhanced HTML** (`index.html`)
- Smart input section with voice button
- Quick-add buttons grid
- LLM configuration modal
- Traditional form (unchanged)

## File Structure

```
expense-tracker/
├── index.html                 # Main HTML with smart input UI
├── js/
│   ├── config.js             # Firebase configuration
│   ├── auth.js               # Authentication logic
│   ├── utils.js              # Utility functions
│   ├── llm-integration.js    # NEW: AI parsing & voice input
│   └── smart-input.js        # NEW: Smart input UI controller
├── script.js                 # Main application logic
├── SMART-INPUT-GUIDE.md      # User documentation
└── DEVELOPER-SETUP.md        # This file
```

## Installation

### Prerequisites
- Modern web browser (Chrome, Edge, Safari, or Firefox)
- Internet connection for AI features
- OpenAI API key (optional, for enhanced parsing)

### Setup Steps

1. **Include the new JavaScript files** in your HTML:
```html
<script src="js/config.js"></script>
<script src="js/utils.js"></script>
<script src="js/auth.js"></script>
<script src="js/llm-integration.js"></script>
<script src="js/smart-input.js"></script>
```

2. **Add the smart input UI** to your Add Expense page (already done in index.html)

3. **Configure OpenAI API** (optional):
   - Get API key from https://platform.openai.com/api-keys
   - Click "Configure AI" in the app
   - Enter API key and select model

## API Integration

### OpenAI API

The system uses OpenAI's Chat Completions API for natural language parsing.

**Endpoint**: `https://api.openai.com/v1/chat/completions`

**Request Format**:
```javascript
{
  model: "gpt-3.5-turbo",
  messages: [
    {
      role: "system",
      content: "You are a financial assistant..."
    },
    {
      role: "user",
      content: "Spent $45 on groceries"
    }
  ],
  temperature: 0.3,
  max_tokens: 150
}
```

**Response Format**:
```javascript
{
  amount: 45,
  description: "groceries",
  category: "Food"
}
```

### Cost Estimation

Using GPT-3.5 Turbo:
- **Input**: ~100 tokens per request
- **Output**: ~50 tokens per response
- **Cost**: ~$0.0002 per transaction
- **Monthly** (100 transactions): ~$0.02

Using GPT-4:
- **Cost**: ~$0.003 per transaction
- **Monthly** (100 transactions): ~$0.30

## Fallback Mechanism

When AI is unavailable or not configured, the system uses regex-based parsing:

```javascript
fallbackParse(input) {
  // Extract amount: $45 or 45
  const amountMatch = input.match(/\$?(\d+\.?\d*)/);
  
  // Guess category based on keywords
  const category = this.guessCategory(input.toLowerCase());
  
  return { amount, description, category, confidence: 'low' };
}
```

## Voice Input

Uses Web Speech API (browser-native):

```javascript
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();
recognition.continuous = false;
recognition.interimResults = false;
recognition.lang = 'en-US';
```

**Browser Support**:
- ✅ Chrome/Edge (full support)
- ✅ Safari (full support)
- ❌ Firefox (limited support)

## Quick-Add Buttons

Dynamically generated based on transaction history:

```javascript
getCommonExpenses() {
  // Analyze frequency and amounts
  const expenses = JSON.parse(localStorage.getItem('expenses')) || [];
  
  // Group by description + category
  // Sort by frequency
  // Calculate average amounts
  // Return top 5
}
```

**Default buttons** (shown when history < 10 transactions):
- Coffee (~$5)
- Lunch (~$15)
- Gas (~$40)
- Groceries (~$50)
- Uber (~$20)

## Configuration Storage

All configuration is stored in browser's localStorage:

```javascript
// LLM Configuration
localStorage.setItem('llm_api_key', apiKey);
localStorage.setItem('llm_model', model);

// Expenses (existing)
localStorage.setItem('expenses', JSON.stringify(expenses));

// Settings (existing)
localStorage.setItem('settings', JSON.stringify(settings));
```

## Security Considerations

### API Key Storage
- Stored in localStorage (client-side only)
- Never transmitted to your servers
- Only sent to OpenAI API
- Can be cleared by user

### Data Privacy
- Only transaction text is sent to OpenAI
- No personal information included
- No transaction history shared
- User can opt-out by not configuring API

### HTTPS Requirement
- Voice input requires HTTPS
- API calls require secure connection
- Use HTTPS in production

## Testing

### Manual Testing Checklist

**Natural Language Input**:
- [ ] "Spent $45 on groceries" → Amount: 45, Category: Food
- [ ] "Coffee 5.50" → Amount: 5.50, Category: Coffee
- [ ] "Uber ride $23" → Amount: 23, Category: Transportation
- [ ] "Lunch at Chipotle" → Category: Food (amount optional)

**Voice Input**:
- [ ] Microphone button appears (Chrome/Safari)
- [ ] Permission prompt shows
- [ ] Speech is transcribed correctly
- [ ] Auto-parse after speech

**Quick-Add Buttons**:
- [ ] Default buttons show (new user)
- [ ] Buttons update after 10+ transactions
- [ ] Click fills form correctly
- [ ] Amounts are editable

**Fallback Mode**:
- [ ] Works without API key
- [ ] Basic parsing functions
- [ ] Categories detected from keywords

### Automated Testing

```javascript
// Test LLM Parser
const parser = new LLMTransactionParser();
const result = await parser.parseTransaction("Spent $45 on groceries");
console.assert(result.amount === 45);
console.assert(result.category === "Food");

// Test Voice Input
const voice = new VoiceInputHandler();
console.assert(voice.isSupported() === true);

// Test Smart Input
const smartInput = new SmartTransactionInput(expenseTracker);
const suggestions = await smartInput.showSuggestions("coffee");
console.assert(suggestions.length > 0);
```

## Customization

### Adding New Categories

Update category keywords in `llm-integration.js`:

```javascript
guessCategory(text) {
  const categoryKeywords = {
    'Food': ['food', 'lunch', 'dinner', ...],
    'YourCategory': ['keyword1', 'keyword2', ...]
  };
}
```

### Changing AI Model

Modify in `llm-integration.js`:

```javascript
constructor() {
  this.model = 'gpt-4'; // or 'gpt-3.5-turbo'
}
```

### Customizing Quick-Add Buttons

Edit defaults in `smart-input.js`:

```javascript
const defaults = [
  { description: 'Coffee', category: 'Coffee', avgAmount: 5, icon: '☕' },
  { description: 'YourExpense', category: 'Category', avgAmount: 10, icon: '🎯' }
];
```

## Performance Optimization

### Debouncing
Suggestions are debounced to reduce API calls:

```javascript
let debounceTimer;
smartInput.addEventListener('input', (e) => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    await this.showSuggestions(e.target.value);
  }, 300); // Wait 300ms after typing stops
});
```

### Caching
Consider implementing caching for repeated queries:

```javascript
const cache = new Map();

async parseTransaction(input) {
  if (cache.has(input)) {
    return cache.get(input);
  }
  
  const result = await this.callAPI(input);
  cache.set(input, result);
  return result;
}
```

### Rate Limiting
Implement rate limiting to control API costs:

```javascript
class RateLimiter {
  constructor(maxRequests, timeWindow) {
    this.maxRequests = maxRequests;
    this.timeWindow = timeWindow;
    this.requests = [];
  }
  
  async throttle() {
    const now = Date.now();
    this.requests = this.requests.filter(t => now - t < this.timeWindow);
    
    if (this.requests.length >= this.maxRequests) {
      throw new Error('Rate limit exceeded');
    }
    
    this.requests.push(now);
  }
}
```

## Troubleshooting

### Common Issues

**1. API Key Invalid**
```
Error: API error: 401
Solution: Check API key in configuration modal
```

**2. Voice Input Not Working**
```
Error: Speech recognition not supported
Solution: Use Chrome/Safari or enable HTTPS
```

**3. Suggestions Not Showing**
```
Issue: Empty suggestions array
Solution: Add more transactions to build history
```

**4. CORS Errors**
```
Error: CORS policy blocked
Solution: OpenAI API should work from any origin
Check if API key is valid
```

## Deployment

### Production Checklist

- [ ] Use HTTPS for voice input
- [ ] Implement rate limiting
- [ ] Add error tracking (Sentry, etc.)
- [ ] Monitor API costs
- [ ] Test on multiple browsers
- [ ] Optimize bundle size
- [ ] Add loading states
- [ ] Implement retry logic

### Environment Variables

For production, consider using environment variables:

```javascript
const config = {
  apiEndpoint: process.env.OPENAI_API_ENDPOINT,
  defaultModel: process.env.DEFAULT_MODEL || 'gpt-3.5-turbo'
};
```

## Contributing

### Code Style
- Use ES6+ features
- Follow existing naming conventions
- Add JSDoc comments
- Keep functions small and focused

### Pull Request Process
1. Fork the repository
2. Create feature branch
3. Add tests
4. Update documentation
5. Submit PR with description

## Resources

- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [localStorage Guide](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)

## License

Same as main project license.

## Support

For issues or questions:
1. Check this documentation
2. Review SMART-INPUT-GUIDE.md
3. Check browser console for errors
4. Open GitHub issue with details

---

**Happy Coding!** 🚀

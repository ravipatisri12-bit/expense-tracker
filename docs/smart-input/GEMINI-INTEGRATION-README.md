# 🤖 Gemini AI Integration for Expense Tracker

## What's New?

Your expense tracker now has **AI-powered smart input** using Google Gemini! Add expenses by simply typing naturally like "Spent $45 on groceries" and let AI do the rest.

## ✨ Features

### 1. Natural Language Parsing
Type expenses naturally:
- "Coffee at Starbucks 5.50" → Amount: $5.50, Category: Coffee
- "Uber ride home $23" → Amount: $23, Category: Transportation
- "Lunch with team 67 dollars" → Amount: $67, Category: Food

### 2. Quick-Add Buttons
One-tap buttons for common expenses that adapt to your spending habits.

### 3. Smart Suggestions
Get suggestions based on your transaction history as you type.

## 🚀 Quick Start

### 1. Get Your Free API Key
1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy your key (starts with "AIza...")

### 2. Configure the App
1. Open the expense tracker
2. Go to "Add" tab
3. Click "Configure AI"
4. Paste your API key
5. Click "Save Configuration"

### 3. Start Using!
Type naturally in the Smart Input field:
```
"Spent $45 on groceries"
```
Click "Parse" and watch the magic happen! ✨

## 💰 Cost

**100% FREE!**
- No credit card required
- 60 requests per minute
- 1,500 requests per day
- Perfect for personal expense tracking

## 🔒 Privacy

- API key stored **locally** in your browser
- Never sent to our servers
- Only communicates with Google Gemini
- Your expense data stays private

## 📖 Documentation

- **User Guide**: See `SMART-INPUT-GUIDE.md` for detailed usage
- **Developer Guide**: See `DEVELOPER-SETUP.md` for technical details

## 🎯 Examples

### Simple Expenses
```
Input: "Coffee 5.50"
Output: Amount: $5.50, Description: Coffee, Category: Coffee

Input: "Gas $40"
Output: Amount: $40, Description: Gas, Category: Transportation
```

### Detailed Expenses
```
Input: "Lunch at Chipotle with Sarah $23.45"
Output: Amount: $23.45, Description: Lunch at Chipotle with Sarah, Category: Food

Input: "Bought new shoes at Nike store for 89 dollars"
Output: Amount: $89, Description: Bought new shoes at Nike store, Category: Shopping
```

### Without Amount
```
Input: "Uber ride to airport"
Output: Amount: (empty), Description: Uber ride to airport, Category: Transportation
(You can fill in the amount manually)
```

## 🛠️ Technical Details

### API Endpoint
```
https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent
```

### Model
- **Gemini Pro**: Fast, accurate, and free

### Fallback
If AI is unavailable, the system automatically uses pattern-based parsing:
- Regex for amount extraction
- Keyword matching for categories
- Still works offline!

## 🆘 Troubleshooting

### API Key Not Working
- Make sure you copied the entire key (starts with "AIza...")
- Check if you're signed in to Google AI Studio
- Try generating a new key

### Parsing Errors
- Check your internet connection
- The system will fall back to basic parsing
- You can always use the traditional form

### Rate Limits
- Free tier: 60 requests/minute
- If you hit the limit, wait a minute or use the traditional form

## 🔄 Updates

### Version 1.0 (Current)
- ✅ Natural language parsing with Gemini
- ✅ Quick-add buttons
- ✅ Smart suggestions
- ✅ Fallback parsing
- ✅ Local API key storage

### Coming Soon
- 📸 Receipt photo scanning
- 📧 Email expense parsing
- 🔁 Recurring expense templates
- 💱 Multi-currency support

## 🤝 Contributing

Want to improve the AI parsing? Check out `js/llm-integration.js` and submit a PR!

## 📄 License

Same as the main project.

---

**Enjoy smarter expense tracking!** 🎉

For questions or issues, check the troubleshooting section or open an issue on GitHub.

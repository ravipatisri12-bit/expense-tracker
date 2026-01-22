# 🚀 Smart Transaction Input - User Guide

## Overview

The expense tracker now features **AI-powered smart input using Google Gemini** that makes adding transactions faster and easier than ever. Simply type naturally, and the AI will automatically extract the amount, description, and category.

## ✨ Key Features

### 1. **Natural Language Input**
Type expenses in plain English:
- "Spent $45 on groceries"
- "Coffee at Starbucks 5.50"
- "Uber ride home $23"
- "Lunch with team 67 dollars"

The AI automatically extracts:
- **Amount**: $45, $5.50, $23, $67
- **Description**: groceries, Coffee at Starbucks, Uber ride home, Lunch with team
- **Category**: Food, Coffee, Transportation, Food

### 2. **Quick-Add Buttons** ⚡
One-tap buttons for your most common expenses:
- ☕ Coffee (~$5)
- 🍽️ Lunch (~$15)
- ⛽ Gas (~$40)
- 🛒 Groceries (~$50)
- 🚗 Uber (~$20)

The buttons adapt based on your spending history!

### 3. **Smart Suggestions**
As you type, the system shows suggestions based on:
- Your previous transactions
- Similar descriptions
- Common patterns

Click any suggestion to instantly fill the form.

## � Setup Instructions

### Step 1: Configure Gemini AI (Optional but Recommended)

1. Click **"Configure AI"** in the Smart Input section
2. Get a **free** API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
3. Paste your API key
4. Click **"Save Configuration"**

**Why Gemini?**
- ✅ **Free to use** with generous limits (60 requests/minute)
- ✅ Fast and accurate parsing
- ✅ No credit card required
- ✅ Privacy-focused

**Privacy Note**: Your API key is stored locally in your browser and never sent to our servers. It's only used to communicate directly with Google Gemini.

## 📱 How to Use

### Method 1: Natural Language Input

1. Navigate to **"Add"** tab
2. Type your expense in the **Smart Input** field
3. Click **"Parse"** or press **Enter**
4. Review the auto-filled form
5. Adjust if needed
6. Click **"Add Expense"**

**Examples:**
```
Input: "Spent $45 on groceries"
Result:
  Amount: $45.00
  Description: groceries
  Category: Food

Input: "Coffee at Starbucks 5.50"
Result:
  Amount: $5.50
  Description: Coffee at Starbucks
  Category: Coffee

Input: "Uber to airport $35"
Result:
  Amount: $35.00
  Description: Uber to airport
  Category: Transportation
```

### Method 2: Quick-Add Buttons

1. Click any **Quick-Add button**
2. The form is pre-filled with typical values
3. Adjust the amount if needed
4. Click **"Add Expense"**

### Method 3: Traditional Form

You can always use the traditional form below if you prefer manual entry.

## 🎯 Tips for Best Results

### Natural Language Input
- **Include the amount**: "45 dollars" or "$45"
- **Be specific**: "Coffee at Starbucks" vs just "coffee"
- **Use keywords**: Words like "uber", "coffee", "groceries" help with categorization

### Voice Input
- **Speak naturally**: "I spent fifteen dollars on coffee"
- **Include context**: "Lunch at Chipotle twenty-three dollars"
- **Avoid background noise**: Find a quiet spot for better accuracy

### Category Recognition
The AI recognizes these keywords for automatic categorization:

- **Food**: food, lunch, dinner, breakfast, restaurant, grocery, meal
- **Coffee**: coffee, starbucks, cafe, latte, espresso
- **Transportation**: uber, lyft, taxi, gas, fuel, parking, bus, train
- **Entertainment**: movie, cinema, concert, game, netflix, spotify
- **Shopping**: amazon, shopping, clothes, shoes, store, mall
- **Bills**: bill, utility, rent, insurance, phone, internet

## 🔒 Privacy & Security

### API Key Storage
- Stored **locally** in your browser's localStorage
- **Never sent** to our servers
- Only used for direct communication with OpenAI
- Can be deleted anytime from the configuration modal

### Data Processing
- Transaction parsing happens via OpenAI's API
- Only the text you input is sent for parsing
- No personal information or transaction history is shared
- All your expense data remains in your browser and Firebase (if signed in)

### Offline Fallback
If the AI service is unavailable:
- The system automatically falls back to pattern-based parsing
- Basic amount and category extraction still works
- You can always use the traditional form

## 🆘 Troubleshooting

### "Parse" button doesn't work
- **Check API configuration**: Make sure you've entered a valid OpenAI API key
- **Check internet connection**: AI parsing requires internet access
- **Try fallback mode**: The system will use basic parsing if AI is unavailable

### Voice input button is missing
- **Browser compatibility**: Voice input requires Chrome, Edge, or Safari
- **Permissions**: Allow microphone access when prompted
- **HTTPS required**: Voice input only works on secure connections

### Suggestions not appearing
- **Type more**: Suggestions appear after 3+ characters
- **Build history**: Suggestions improve as you add more transactions
- **Check spelling**: Make sure your input matches previous transactions

### Wrong category detected
- **Use keywords**: Include category-specific words in your description
- **Manual override**: You can always change the category before submitting
- **Improve with feedback**: The more you use it, the better it gets

## 💡 Advanced Tips

### Batch Entry
For multiple quick expenses:
1. Use Quick-Add buttons for speed
2. Adjust amounts as needed
3. Submit immediately
4. Repeat for next expense

### Custom Quick-Add Buttons
The Quick-Add buttons automatically adapt to show your 5 most frequent expenses after you've logged 10+ transactions.

### Keyboard Shortcuts
- **Enter** in Smart Input: Parse the text
- **Tab** through form fields: Quick navigation
- **Enter** on form: Submit expense

## 📊 Benefits

### Time Savings
- **Traditional method**: ~30 seconds per transaction
- **Smart Input**: ~10 seconds per transaction
- **Quick-Add**: ~3 seconds per transaction

### Accuracy
- AI-powered parsing reduces typos
- Automatic categorization improves consistency
- Smart suggestions prevent duplicate entries

### Convenience
- No need to remember exact amounts
- Natural language feels more intuitive
- Free to use with Gemini API

## 🔄 Future Enhancements

Coming soon:
- Receipt photo scanning
- SMS/email expense parsing
- Recurring expense templates
- Multi-currency support
- Expense splitting for shared costs

## 📞 Support

Having issues? Here's how to get help:

1. **Check this guide** for common solutions
2. **Try the fallback mode** by using the traditional form
3. **Clear browser cache** and reload the page
4. **Check browser console** for error messages

## 🎉 Get Started!

Ready to try it out? Head to the **"Add"** tab and start entering expenses naturally. The more you use it, the smarter it gets!

---

**Pro Tip**: Start with Quick-Add buttons to build your transaction history, then switch to natural language input for more complex expenses. The AI learns from your patterns and gets better over time!

/**
 * LLM Integration for Smart Transaction Input
 * Uses Google Gemini API for natural language processing
 */

class LLMTransactionParser {
    constructor() {
        // Hardcoded API key for personal use
        this.apiKey = localStorage.getItem('gemini_api_key') || '';
        this.apiEndpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent';
        this.model = 'gemini-2.0-flash-lite';
        this.isConfigured = true;
    }

    /**
     * Configure the Gemini API
     * @param {string} apiKey - Google Gemini API key
     */
    configure(apiKey) {
        this.apiKey = apiKey;
        this.isConfigured = !!apiKey;
        
        // Save to localStorage
        if (apiKey) {
            localStorage.setItem('gemini_api_key', apiKey);
            // Sync to Firebase if signed in
            if (window.expenseTracker) {
                window.expenseTracker.settings.geminiApiKey = apiKey;
                window.expenseTracker.saveSettingsToFirebase();
            }
        }
    }

    /**
     * Load configuration from localStorage
     */
    loadConfig() {
        // Use hardcoded key, but allow override from localStorage
        const savedKey = localStorage.getItem('llm_api_key');
        
        if (savedKey) {
            this.configure(savedKey);
        }
    }

    /**
     * Parse natural language input into structured transaction data
     * Can handle single or multiple transactions in one input
     * @param {string} input - Natural language description
     * @returns {Promise<Array>} Array of parsed transaction data
     */
    async parseTransaction(input) {
        if (!this.isConfigured) {
            return this.fallbackParseMultiple(input);
        }

        try {
            const prompt = `You are a financial assistant. Parse ALL transactions from the input.

CRITICAL RULES:
1. Look for EVERY amount mentioned (numbers with or without $)
2. Each amount = separate transaction
3. ALWAYS return a JSON array, even for 1 transaction
4. Extract: amount (number), description (string), category (Food/Transportation/Entertainment/Coffee/Shopping/Bills/Other)

Examples:
Input: "5 at starbucks 10 at chipotle 2 at amazon go"
Output: [
  {"amount": 5, "description": "starbucks", "category": "Coffee"},
  {"amount": 10, "description": "chipotle", "category": "Food"},
  {"amount": 2, "description": "amazon go", "category": "Shopping"}
]

Input: "Coffee $5, Uber $23, lunch $12"
Output: [
  {"amount": 5, "description": "Coffee", "category": "Coffee"},
  {"amount": 23, "description": "Uber", "category": "Transportation"},
  {"amount": 12, "description": "lunch", "category": "Food"}
]

Input: "Spent $45 on groceries"
Output: [{"amount": 45, "description": "groceries", "category": "Food"}]

Now parse: "${input}"

Return ONLY the JSON array, nothing else.`;

            const response = await fetch(`${this.apiEndpoint}?key=${this.apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.3,
                        maxOutputTokens: 500
                    }
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                if (response.status === 429) {
                    console.warn('Gemini rate limited, using fallback parser');
                    return this.fallbackParseMultiple(input);
                }
                throw new Error(`API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
            }

            const data = await response.json();
            const content = data.candidates[0].content.parts[0].text.trim();
            
            // Extract JSON from response (Gemini sometimes adds markdown)
            let jsonStr = content;
            const jsonMatch = content.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                jsonStr = jsonMatch[0];
            }
            
            // Parse JSON response
            const parsed = JSON.parse(jsonStr);
            
            // Ensure it's an array
            const transactions = Array.isArray(parsed) ? parsed : [parsed];
            
            // Validate and format each transaction
            return transactions.map(t => ({
                amount: t.amount,
                description: t.description || input,
                category: this.validateCategory(t.category),
                confidence: 'high'
            }));
        } catch (error) {
            console.error('Gemini parsing error:', error);
            return this.fallbackParseMultiple(input);
        }
    }

    /**
     * Fallback parser using regex patterns for multiple transactions
     * @param {string} input - Natural language description
     * @returns {Array} Array of parsed transaction data
     */
    fallbackParseMultiple(input) {
        const today = new Date();
        const todayStr = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0');
        
        // First strip out date patterns and store them, so their numbers don't get picked up as amounts
        let cleaned = input;
        const dateMap = new Map(); // placeholder -> date string
        let placeholderIdx = 0;
        
        const dateReplacements = [
            { re: /\byesterday\b/gi, fn: () => { const d = new Date(today); d.setDate(d.getDate()-1); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }},
            { re: /\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*/gi, fn: (m,day,mon) => { const months = {jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12}; return today.getFullYear()+'-'+String(months[mon.toLowerCase().slice(0,3)]).padStart(2,'0')+'-'+String(day).padStart(2,'0'); }},
            { re: /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g, fn: (m,mo,da,yr) => { const y = yr ? (yr.length === 2 ? '20'+yr : yr) : today.getFullYear(); return y+'-'+String(mo).padStart(2,'0')+'-'+String(da).padStart(2,'0'); }},
            { re: /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g, fn: m => m }
        ];
        
        for (const p of dateReplacements) {
            cleaned = cleaned.replace(p.re, (...args) => {
                const dateVal = p.fn(...args);
                const ph = `__DATE${placeholderIdx++}__`;
                dateMap.set(ph, dateVal);
                return ph;
            });
        }
        
        // Now split on commas or newlines
        const segments = cleaned.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);
        
        const transactions = [];
        for (const seg of segments) {
            const amountMatch = seg.match(/\$\s*(\d+(?:\.\d{1,2})?)\b|\b(\d+(?:\.\d{1,2})?)\b/);
            if (!amountMatch) continue;
            
            const amount = parseFloat(amountMatch[1] || amountMatch[2]);
            if (amount <= 0) continue;
            
            // Find date placeholder in this segment
            let date = todayStr;
            for (const [ph, d] of dateMap) {
                if (seg.includes(ph)) { date = d; break; }
            }
            
            // Remove amount and date placeholders to get description
            let desc = seg.replace(amountMatch[0], '').replace(/__DATE\d+__/g, '').trim();
            desc = desc.replace(/^[\s,\-–]+|[\s,\-–]+$/g, '');
            desc = desc.replace(/^(at|on|for|spent|paid|to)\s+/i, '').trim();
            desc = desc.replace(/\s+(at|on|for|spent|paid|to)$/i, '').trim();
            if (!desc) desc = 'Expense';
            
            transactions.push({
                amount,
                description: desc.charAt(0).toUpperCase() + desc.slice(1),
                category: this.guessCategory(desc.toLowerCase()),
                date,
                confidence: 'low'
            });
        }
        
        return transactions.length > 0 ? transactions : [{ amount: null, description: input, category: 'Other', date: todayStr, confidence: 'low' }];
    }

    /**
     * Fallback parser for a single transaction using regex patterns
     * @param {string} input - Natural language description
     * @returns {Object} Parsed transaction data
     */
    fallbackParseSingle(input) {
        // Extract amount using regex
        const amountMatch = input.match(/\$?(\d+\.?\d*)/);
        const amount = amountMatch ? parseFloat(amountMatch[1]) : null;

        // Remove amount from description
        let description = input.replace(/\$?\d+\.?\d*/, '').trim();
        
        // Clean up common words
        description = description.replace(/^(spent|paid|bought|for|on|at)\s+/i, '').trim();
        
        // Guess category based on keywords
        const category = this.guessCategory(input.toLowerCase());

        return {
            amount,
            description: description || input,
            category,
            confidence: 'low'
        };
    }

    /**
     * Guess category based on keywords
     * @param {string} text - Text to analyze
     * @returns {string} Category name
     */
    guessCategory(text) {
        const categoryKeywords = {
            'Food': ['food', 'lunch', 'dinner', 'breakfast', 'restaurant', 'grocery', 'groceries', 'meal'],
            'Coffee': ['coffee', 'starbucks', 'cafe', 'latte', 'espresso'],
            'Transportation': ['uber', 'lyft', 'taxi', 'gas', 'fuel', 'parking', 'bus', 'train', 'metro'],
            'Entertainment': ['movie', 'cinema', 'concert', 'game', 'netflix', 'spotify', 'entertainment'],
            'Shopping': ['amazon', 'shopping', 'clothes', 'shoes', 'store', 'mall'],
            'Bills': ['bill', 'utility', 'rent', 'insurance', 'phone', 'internet', 'electricity']
        };

        for (const [category, keywords] of Object.entries(categoryKeywords)) {
            if (keywords.some(keyword => text.includes(keyword))) {
                return category;
            }
        }

        return 'Other';
    }

    /**
     * Validate category against allowed categories
     * @param {string} category - Category to validate
     * @returns {string} Valid category
     */
    validateCategory(category) {
        const validCategories = ['Food', 'Transportation', 'Entertainment', 'Coffee', 'Shopping', 'Bills', 'Other'];
        return validCategories.includes(category) ? category : 'Other';
    }

    /**
     * Get smart suggestions based on input
     * @param {string} input - Partial input
     * @returns {Array} Suggestions
     */
    async getSuggestions(input) {
        if (!input || input.length < 3) return [];

        // Get recent similar transactions
        const expenses = JSON.parse(localStorage.getItem('expenses')) || [];
        const suggestions = expenses
            .filter(e => e.description.toLowerCase().includes(input.toLowerCase()))
            .slice(0, 5)
            .map(e => ({
                description: e.description,
                amount: e.amount,
                category: e.category
            }));

        return suggestions;
    }
}

// Export instance
window.llmParser = new LLMTransactionParser();

// Auto-load configuration
window.llmParser.loadConfig();

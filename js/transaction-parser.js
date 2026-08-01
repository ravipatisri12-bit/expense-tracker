/**
 * Natural-language transaction parser (local, no network).
 *
 * Replaces the old Gemini-backed js/llm-integration.js. That integration never
 * actually parsed anything: its constructor hardcoded `isConfigured = true` while
 * the API key resolved to '' (the committed key was stripped in c83cd5c), so every
 * parse fired a keyless request, got a 400, and fell through to this same regex
 * parser. The LLM path was pure latency — one failing round-trip per parse.
 *
 * The regex parser below IS the parser, and always has been. It handles:
 *   "100 at castilla on food 02/18"   -> amount, merchant, category, date
 *   "12 coffee yesterday"             -> relative dates
 *   multi-line input                  -> one transaction per line
 *
 * Exposed as `window.llmParser` and kept method-compatible with the old class so
 * existing call sites (js/smart-input.js) need no changes.
 */

class TransactionParser {
    constructor() {
        // Retained so any lingering `if (llmParser.isConfigured)` check reads false
        // rather than undefined. There is no remote parser any more.
        this.isConfigured = false;
    }

    /**
     * Parse one or more transactions from natural-language text.
     * @param {string} input
     * @returns {Promise<Array>} parsed transactions (async for call-site compatibility)
     */
    async parseTransaction(input) {
        return this.fallbackParseMultiple(input);
    }

    /**
     * Parse every line of input into a transaction.
     * @param {string} input
     * @returns {Array} parsed transactions
     */
    fallbackParseMultiple(input) {
        const today = new Date();
        // Local calendar parts — never toISOString(), which is UTC and shifts a day
        // in negative timezones (see CLAUDE.md "Timezone footgun").
        const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
        const validCategories = ['Food', 'Transportation', 'Entertainment', 'Coffee', 'Shopping', 'Bills', 'Other'];

        const lines = input.split('\n').map(s => s.trim()).filter(Boolean);
        const transactions = [];

        for (let line of lines) {
            // 1. Extract date from end or anywhere
            let date = todayStr;
            // yesterday
            if (/\byesterday\b/i.test(line)) {
                const d = new Date(today); d.setDate(d.getDate() - 1);
                date = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
                line = line.replace(/\s*\byesterday\b\s*/i, ' ');
            }
            // MM/DD or MM/DD/YY
            const dateMatch = line.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
            if (dateMatch) {
                const y = dateMatch[3] ? (dateMatch[3].length === 2 ? '20' + dateMatch[3] : dateMatch[3]) : today.getFullYear();
                date = y + '-' + String(dateMatch[1]).padStart(2, '0') + '-' + String(dateMatch[2]).padStart(2, '0');
                line = line.replace(dateMatch[0], ' ');
            }

            // 2. Extract explicit category (match known categories or "on <word>")
            let category = null;
            const catMatch = line.match(/\b(?:on|in|for|category)\s+(\w+)\s*$/i) || line.match(/\b(?:on|in|for|category)\s+(\w+)/i);
            if (catMatch) {
                const cat = catMatch[1].charAt(0).toUpperCase() + catMatch[1].slice(1).toLowerCase();
                if (validCategories.map(c => c.toLowerCase()).includes(cat.toLowerCase())) {
                    category = cat;
                    line = line.replace(catMatch[0], ' ');
                }
            }

            // 3. Extract amount: first number (with optional $)
            const amountMatch = line.match(/\$?\s*(\d+(?:\.\d{1,2})?)/);
            if (!amountMatch) continue;
            const amount = parseFloat(amountMatch[1]);
            if (!amount || amount <= 0) continue;
            line = line.replace(amountMatch[0], ' ');

            // 4. Everything left is description
            let desc = line.replace(/\b(at|on|in|for|spent|paid|to)\b/gi, ' ').replace(/\s+/g, ' ').trim();
            if (!desc) desc = 'Expense';
            else desc = desc.charAt(0).toUpperCase() + desc.slice(1);

            if (!category) category = this.guessCategory(desc.toLowerCase());

            transactions.push({ amount, description: desc, category, date, confidence: 'low' });
        }

        return transactions.length > 0 ? transactions : [{ amount: null, description: input, category: 'Other', date: todayStr, confidence: 'low' }];
    }

    /**
     * Parse a single transaction.
     * @param {string} input
     * @returns {Object} parsed transaction
     */
    fallbackParseSingle(input) {
        const amountMatch = input.match(/\$?(\d+\.?\d*)/);
        const amount = amountMatch ? parseFloat(amountMatch[1]) : null;

        let description = input.replace(/\$?\d+\.?\d*/, '').trim();
        description = description.replace(/^(spent|paid|bought|for|on|at)\s+/i, '').trim();

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
     * Suggestions from previously logged expenses (local only).
     * @param {string} input - Partial input
     * @returns {Array} Suggestions
     */
    async getSuggestions(input) {
        if (!input || input.length < 3) return [];

        const expenses = JSON.parse(localStorage.getItem('expenses')) || [];
        return expenses
            .filter(e => e.description && e.description.toLowerCase().includes(input.toLowerCase()))
            .slice(0, 5)
            .map(e => ({
                description: e.description,
                amount: e.amount,
                category: e.category
            }));
    }
}

// Exported under the historical name so existing call sites keep working.
window.llmParser = new TransactionParser();
window.transactionParser = window.llmParser;

// Gmail Email Parser — imports Chase credit card alert transactions
// Triggered manually via "Pull from Gmail" button on the Add page

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent`;

// TEST MODE: all filters removed — searches any email from the last day.
// Restore this line before production use:
// const GMAIL_QUERY = 'from:no.reply.alerts@chase.com label:"Chase Transactions" newer_than:7d';
const GMAIL_QUERY = 'newer_than:1d';

class EmailParser {
    isTokenValid() {
        const token = localStorage.getItem('gmail_access_token');
        const expiry = parseInt(localStorage.getItem('gmail_token_expiry') || '0', 10);
        return !!token && Date.now() < expiry;
    }

    async getValidToken() {
        if (this.isTokenValid()) return localStorage.getItem('gmail_access_token');
        if (typeof showNotification === 'function') {
            showNotification('Reconnecting Gmail...', 'success');
        }
        const token = await window.refreshGmailToken();
        if (!token && typeof showNotification === 'function') {
            showNotification('Gmail reconnect failed — tap "Reconnect Gmail" in Settings', 'error', 7000);
            this.showReconnectButton(true);
        }
        return token;
    }

    async searchMessages(token) {
        const url = `${GMAIL_API}/messages?q=${encodeURIComponent(GMAIL_QUERY)}&maxResults=25`;
        const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (resp.status === 401) throw new Error('TOKEN_EXPIRED');
        if (!resp.ok) throw new Error(`Gmail search failed: ${resp.status}`);
        const data = await resp.json();
        return data.messages || [];
    }

    async fetchMessageBody(token, messageId) {
        const url = `${GMAIL_API}/messages/${messageId}?format=full`;
        const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (resp.status === 401) throw new Error('TOKEN_EXPIRED');
        if (!resp.ok) throw new Error(`Failed to fetch message ${messageId}`);
        return resp.json();
    }

    extractTextFromPayload(payload) {
        if (payload.body && payload.body.data) {
            return this._decodeBase64url(payload.body.data);
        }
        if (payload.parts) {
            for (const part of payload.parts) {
                if (part.mimeType === 'text/plain' && part.body && part.body.data) {
                    return this._decodeBase64url(part.body.data);
                }
            }
            for (const part of payload.parts) {
                if (part.mimeType === 'text/html' && part.body && part.body.data) {
                    return this._decodeBase64url(part.body.data)
                        .replace(/<[^>]+>/g, ' ')
                        .replace(/\s+/g, ' ')
                        .trim();
                }
            }
            for (const part of payload.parts) {
                if (part.mimeType && part.mimeType.startsWith('multipart/') && part.parts) {
                    const result = this.extractTextFromPayload(part);
                    if (result) return result;
                }
            }
        }
        return payload.snippet || '';
    }

    _decodeBase64url(encoded) {
        const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
        try {
            return decodeURIComponent(
                atob(base64).split('').map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join('')
            );
        } catch {
            return atob(base64);
        }
    }

    async callGeminiWithRetry(prompt) {
        const apiKey = localStorage.getItem('gemini_api_key');
        if (!apiKey) return null;

        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                const resp = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { temperature: 0.1, maxOutputTokens: 200 }
                    })
                });

                if (resp.status === 429 && attempt < 2) {
                    await new Promise(r => setTimeout(r, Math.pow(2, attempt + 1) * 1000));
                    continue;
                }
                if (!resp.ok) return null;

                const data = await resp.json();
                return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
            } catch {
                if (attempt < 2) await new Promise(r => setTimeout(r, 2000));
            }
        }
        return null;
    }

    async parseEmailWithGemini(emailText, emailSubject) {
        const today = new Date().toISOString().split('T')[0];
        const truncated = emailText.slice(0, 1500);

        const prompt = `You are a financial data extractor. Extract the credit card transaction from this Chase bank alert email.

Return ONLY a JSON object or null:
{ "amount": <number>, "merchant": <string>, "date": "<YYYY-MM-DD>", "category": <one of: Food, Transportation, Entertainment, Coffee, Shopping, Bills, Other> }

Rules:
- amount must be a positive number (no $ or commas)
- merchant is the business name only (e.g. "CHIPOTLE 0469", not "Chase Transaction")
- category: Food=restaurants/grocery, Coffee=cafes, Transportation=gas/uber/transit, Entertainment=streaming/movies, Shopping=retail/amazon, Bills=utilities/insurance/subscriptions
- Use ${today} if date not found
- Return ONLY the JSON or null, no other text

CRITICAL — return null if the email is ANY of these:
- A promotional email, advertisement, offer, or discount ("get $50 off", "earn rewards")
- A newsletter, marketing email, or account statement
- A payment reminder, bill announcement, or balance notification
- A rewards/cashback/points notification
- Anything where YOU are not the one spending money on a specific purchase

Only return JSON if this email is a real-time purchase alert confirming a specific card transaction you just made.

Email subject: "${emailSubject}"
Email:
${truncated}`;

        const text = await this.callGeminiWithRetry(prompt);
        if (!text || text === 'null') return null;

        try {
            const match = text.match(/\{[\s\S]*\}/);
            return match ? JSON.parse(match[0]) : null;
        } catch {
            return null;
        }
    }

    // Regex fallback for when Gemini is unavailable.
    // Priority: Chase structured table → subject line → free-form text.
    parseChaseRegex(emailText, emailSubject = '') {
        // 1. Chase structured table format:
        //    "Merchant  CHIPOTLE 0469"
        //    "Date      Apr 21, 2026 at 5:43 PM ET"
        //    "Amount    $11.14"
        const structuredAmount = emailText.match(/Amount\s+\$([0-9,]+\.?\d{0,2})/i);
        const structuredMerchant = emailText.match(/Merchant\s+([A-Z0-9][^\n\t]+?)(?:\s{2,}|\t|\n|$)/i);
        const structuredDate = emailText.match(/Date\s+((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4})/i);

        if (structuredAmount && structuredMerchant) {
            const amount = parseFloat(structuredAmount[1].replace(/,/g, ''));
            const merchant = structuredMerchant[1].trim();
            const date = this._parseDate(structuredDate ? structuredDate[1] : '', emailText);
            if (amount > 0 && merchant.length > 0) {
                return { amount, merchant, date, category: this.guessCategory(merchant) };
            }
        }

        // 2. Subject line: "You made a $11.14 transaction with CHIPOTLE 0469"
        const subjectMatch = emailSubject.match(/\$([0-9,]+\.?\d{0,2})\s+transaction\s+with\s+(.+?)(?:\s*$)/i);
        if (subjectMatch) {
            const amount = parseFloat(subjectMatch[1].replace(/,/g, ''));
            const merchant = subjectMatch[2].trim();
            if (amount > 0 && merchant.length > 0) {
                return { amount, merchant, date: this._parseDate('', emailText), category: this.guessCategory(merchant) };
            }
        }

        // 3. Free-form — only proceed if email signals a real transaction (not a promo)
        const transactionSignals = /\b(charge|charged|transaction|purchase|debit|payment made|you spent|was made)\b/i;
        if (!transactionSignals.test(emailText) && !transactionSignals.test(emailSubject)) return null;

        const amountMatch = emailText.match(/\$([0-9,]+\.?\d{0,2})/);
        if (!amountMatch) return null;
        const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
        if (!amount || amount <= 0) return null;

        const merchantMatch = emailText.match(
            /(?:at|to|with)\s+([A-Z][A-Za-z0-9 &'.,*#-]+?)(?:\s+on\s+\d|\s+for\s|\.|,|\n)/
        );
        const merchant = merchantMatch ? merchantMatch[1].trim() : null;
        if (!merchant) return null;

        return { amount, merchant, date: this._parseDate('', emailText), category: this.guessCategory(merchant) };
    }

    _parseDate(dateStr, fallbackText = '') {
        // "Apr 21, 2026" or "April 21, 2026"
        const monthMatch = (dateStr || fallbackText).match(
            /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/i
        );
        if (monthMatch) {
            const d = new Date(`${monthMatch[1]} ${monthMatch[2]}, ${monthMatch[3]}`);
            if (!isNaN(d)) return d.toISOString().split('T')[0];
        }
        // MM/DD/YYYY
        const slashMatch = fallbackText.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
        if (slashMatch) {
            const d = new Date(slashMatch[1]);
            if (!isNaN(d)) return d.toISOString().split('T')[0];
        }
        return new Date().toISOString().split('T')[0];
    }

    guessCategory(merchant) {
        const m = merchant.toLowerCase();
        if (/starbucks|coffee|dunkin|espresso|latte|cafe/.test(m)) return 'Coffee';
        if (/restaurant|pizza|burger|sushi|bakery|diner|mcdonald|chipotle|subway|taco|kfc|popeye|wendy|grub|doordash|uber\s*eat/.test(m)) return 'Food';
        if (/uber|lyft|gas|shell|bp|chevron|exxon|transit|metro|parking|toll/.test(m)) return 'Transportation';
        if (/amazon|walmart|target|costco|best\s*buy|ebay|etsy|\bshop\b|grocery|supermarket|clothing|apparel/.test(m)) return 'Shopping';
        if (/netflix|spotify|hulu|disney|apple|cinema|movie|theater|game|xbox|playstation/.test(m)) return 'Entertainment';
        if (/insurance|electric|water|internet|att|verizon|comcast|t-mobile|phone|utility|bill/.test(m)) return 'Bills';
        return 'Other';
    }

    isValidTransaction(t) {
        return (
            t &&
            typeof t.amount === 'number' &&
            t.amount > 0 &&
            t.amount < 100000 &&
            typeof t.merchant === 'string' &&
            t.merchant.length > 0 &&
            !isNaN(new Date(t.date))
        );
    }

    getProcessedIds() {
        try { return new Set(JSON.parse(localStorage.getItem('gmail_processed_ids') || '[]')); }
        catch { return new Set(); }
    }

    markProcessed(id) {
        const ids = this.getProcessedIds();
        ids.add(id);
        const arr = Array.from(ids).slice(-1000);
        localStorage.setItem('gmail_processed_ids', JSON.stringify(arr));
    }

    updateLastSyncedUI() {
        const el = document.getElementById('gmail-last-synced');
        if (!el) return;
        const ts = localStorage.getItem('gmail_last_synced');
        el.textContent = ts
            ? `Last synced: ${new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            : 'Never synced';
    }

    showReconnectButton(show) {
        const btn = document.getElementById('gmail-reconnect-btn');
        if (btn) btn.classList.toggle('hidden', !show);
    }

    setSyncButtonState(loading) {
        const btn = document.getElementById('gmail-sync-btn');
        if (!btn) return;
        if (loading) {
            btn.disabled = true;
            btn.textContent = 'Syncing...';
        } else {
            btn.disabled = false;
            btn.textContent = 'Pull from Gmail';
        }
    }

    async sync() {
        if (localStorage.getItem('gmail_syncing') === 'true') return;
        if (!window.currentUser) {
            if (typeof showNotification === 'function') {
                showNotification('Sign in with Google first to use Gmail sync', 'error');
            }
            return;
        }

        localStorage.setItem('gmail_syncing', 'true');
        this.setSyncButtonState(true);

        try {
            const token = await this.getValidToken();
            if (!token) return;

            const messages = await this.searchMessages(token);
            if (!messages.length) {
                if (typeof showNotification === 'function') {
                    showNotification('No new Chase alerts found', 'success');
                }
                return;
            }

            const processedIds = this.getProcessedIds();
            const newMessages = messages.filter(m => !processedIds.has(m.id));

            if (!newMessages.length) {
                if (typeof showNotification === 'function') {
                    showNotification('All emails already imported', 'success');
                }
                return;
            }

            let imported = 0;
            for (const msg of newMessages) {
                try {
                    const fullMsg = await this.fetchMessageBody(token, msg.id);
                    const subjectHeader = fullMsg.payload?.headers?.find(h => h.name === 'Subject');
                    const subject = subjectHeader?.value || '';
                    const bodyText = this.extractTextFromPayload(fullMsg.payload);

                    let parsed = await this.parseEmailWithGemini(bodyText, subject);

                    // Fallback to regex if Gemini is unavailable
                    if (!parsed) parsed = this.parseChaseRegex(bodyText, subject);

                    this.markProcessed(msg.id);

                    if (!this.isValidTransaction(parsed)) continue;

                    const expense = {
                        id: Date.now() + Math.floor(Math.random() * 10000),
                        amount: parseFloat(parsed.amount),
                        description: parsed.merchant,
                        category: parsed.category || 'Other',
                        date: parsed.date,
                        timestamp: Date.now(),
                        excludeFromBudget: false,
                        source: 'gmail'
                    };

                    if (window.expenseTracker) {
                        window.expenseTracker.addExpenseProgrammatically(expense);
                    }
                    imported++;

                    // Small delay to avoid Gmail API rate limits
                    await new Promise(r => setTimeout(r, 300));
                } catch (err) {
                    if (err.message === 'TOKEN_EXPIRED') throw err;
                    console.error('Error processing message', msg.id, err);
                    this.markProcessed(msg.id);
                }
            }

            localStorage.setItem('gmail_last_synced', new Date().toISOString());
            this.updateLastSyncedUI();
            this.showReconnectButton(false);

            if (typeof showNotification === 'function') {
                const msg = imported > 0
                    ? `${imported} transaction${imported > 1 ? 's' : ''} imported from Gmail`
                    : 'No new transactions found in Chase alerts';
                showNotification(msg, 'success');
            }
        } catch (err) {
            if (err.message === 'TOKEN_EXPIRED') {
                localStorage.removeItem('gmail_access_token');
                this.showReconnectButton(true);
                if (typeof showNotification === 'function') {
                    showNotification('Gmail session expired — tap "Reconnect Gmail"', 'error', 7000);
                }
            } else {
                console.error('Gmail sync error:', err);
                if (typeof showNotification === 'function') {
                    showNotification('Gmail sync failed. Check your connection.', 'error');
                }
            }
        } finally {
            localStorage.removeItem('gmail_syncing');
            this.setSyncButtonState(false);
        }
    }
}

window.emailParser = new EmailParser();

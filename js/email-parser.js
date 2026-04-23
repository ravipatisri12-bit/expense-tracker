// Gmail Email Parser — imports Chase credit card alert transactions
// Triggered manually via "Pull from Gmail" button on the Add page

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';

const GMAIL_QUERY = 'from:no.reply.alerts@chase.com label:"Chase Transactions" newer_than:30d';

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
        const url = `${GMAIL_API}/messages?q=${encodeURIComponent(GMAIL_QUERY)}&maxResults=50`;
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
        const MONTHS = {jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
        // "Apr 21, 2026" or "April 21, 2026" — construct directly, never through Date object
        const monthMatch = (dateStr || fallbackText).match(
            /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/i
        );
        if (monthMatch) {
            const m = MONTHS[monthMatch[1].toLowerCase().slice(0, 3)];
            const d = parseInt(monthMatch[2]), y = parseInt(monthMatch[3]);
            if (m && d && y) return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        }
        // MM/DD/YYYY — parse parts directly
        const slashMatch = fallbackText.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
        if (slashMatch) {
            const mo = parseInt(slashMatch[1]), d = parseInt(slashMatch[2]);
            let y = parseInt(slashMatch[3]);
            if (y < 100) y += 2000;
            return `${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        }
        // Fallback: today in local time
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    }

    guessCategory(merchant) {
        const m = merchant.toLowerCase();
        if (/starbucks|coffee|dunkin|espresso|latte|\bcafe\b|dutch bros|woods coffee/.test(m)) return 'Coffee';
        if (/restaurant|pizza|burger|sushi|bakery|diner|mcdonald|chipotle|subway|taco|kfc|popeye|wendy|grub|doordash|uber\s*eat|gyro|shawarma|molly moon|sweet alchemy|beecher|mendocino farm|desi adda|canteen|vending|tst\*/.test(m)) return 'Food';
        if (/uber|lyft|gas|shell|bp|chevron|exxon|transit|metro|parking|toll|\borca\b|bmw|audi|mercedes|jiffy lube|autozone|auto\s*(dealer|repair|service)/.test(m)) return 'Transportation';
        if (/amazon|walmart|target|costco|best\s*buy|ebay|etsy|\bshop\b|grocery|supermarket|clothing|apparel|zara|h&m|uniqlo|gap|nordstrom|macy|wholefds|whole\s*foods|trader\s*joe|safeway|kroger/.test(m)) return 'Shopping';
        if (/netflix|spotify|hulu|disney|apple|cinema|movie|theater|game|xbox|playstation|leetcode|twitch/.test(m)) return 'Entertainment';
        if (/insurance|electric|water|internet|att|verizon|comcast|t-mobile|phone|utility|bill/.test(m)) return 'Bills';
        return 'Other';
    }

    // Run from browser console to fix categories on already-imported transactions:
    // window.emailParser.recategorizeGmailImports()
    recategorizeGmailImports() {
        const expenses = JSON.parse(localStorage.getItem('expenses') || '[]');
        let fixed = 0;
        const updated = expenses.map(e => {
            if (e.source !== 'gmail') return e;
            const correct = this.guessCategory(e.description);
            if (correct !== 'Other' && correct !== e.category) {
                fixed++;
                return { ...e, category: correct };
            }
            return e;
        });
        localStorage.setItem('expenses', JSON.stringify(updated));
        if (window.expenseTracker) {
            window.expenseTracker.expenses = updated;
            window.expenseTracker.updateDashboard();
            window.expenseTracker.renderTransactions();
        }
        if (window.currentUser && window.expenseTracker) {
            updated.filter(e => e.source === 'gmail').forEach(e => window.expenseTracker.saveExpenseToFirebase(e));
        }
        console.log(`Re-categorized ${fixed} Gmail transactions`);
        return fixed;
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
        return new Set(this._processedIds || []);
    }

    markProcessed(id) {
        if (!this._processedIds) this._processedIds = [];
        this._processedIds.push(id);
    }

    async loadProcessedIds() {
        try {
            const doc = await window.firebaseDb.collection('users')
                .doc(window.currentUser.uid)
                .collection('settings').doc('gmail_sync').get();
            if (doc.exists && doc.data().processedIds) {
                this._processedIds = doc.data().processedIds;
                return;
            }
            // First run after migration — seed from localStorage so existing imports aren't duplicated
            const legacy = JSON.parse(localStorage.getItem('gmail_processed_ids') || '[]');
            this._processedIds = legacy;
            if (legacy.length > 0) await this.saveProcessedIds();
        } catch (e) {
            console.warn('Failed to load processed IDs from Firestore:', e.message);
            this._processedIds = JSON.parse(localStorage.getItem('gmail_processed_ids') || '[]');
        }
    }

    async saveProcessedIds() {
        const arr = (this._processedIds || []).slice(-1000);
        try {
            await window.firebaseDb.collection('users')
                .doc(window.currentUser.uid)
                .collection('settings').doc('gmail_sync')
                .set({ processedIds: arr }, { merge: true });
        } catch (e) { console.warn('Failed to save processed IDs to Firestore:', e.message); }
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

            await this.loadProcessedIds();

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

            // Fetch all message bodies in parallel batches of 5
            const BATCH = 5;
            const results = [];
            for (let i = 0; i < newMessages.length; i += BATCH) {
                const batch = newMessages.slice(i, i + BATCH);
                const fetched = await Promise.all(batch.map(async msg => {
                    try {
                        const fullMsg = await this.fetchMessageBody(token, msg.id);
                        return { id: msg.id, fullMsg };
                    } catch (err) {
                        if (err.message === 'TOKEN_EXPIRED') throw err;
                        console.error('Error fetching message', msg.id, err);
                        return { id: msg.id, fullMsg: null };
                    }
                }));
                results.push(...fetched);
            }

            const toAdd = [];
            for (const { id, fullMsg } of results) {
                this.markProcessed(id);
                if (!fullMsg) continue;
                const subjectHeader = fullMsg.payload?.headers?.find(h => h.name === 'Subject');
                const subject = subjectHeader?.value || '';
                const bodyText = this.extractTextFromPayload(fullMsg.payload);
                const parsed = this.parseChaseRegex(bodyText, subject);
                if (!this.isValidTransaction(parsed)) continue;
                toAdd.push({
                    id: Date.now() + Math.floor(Math.random() * 10000),
                    amount: parseFloat(parsed.amount),
                    description: parsed.merchant,
                    category: parsed.category || 'Other',
                    date: parsed.date,
                    timestamp: Date.now(),
                    excludeFromBudget: false,
                    source: 'gmail'
                });
            }
            const imported = toAdd.length;
            if (window.expenseTracker && imported > 0) {
                window.expenseTracker.addExpensesBatch(toAdd);
            }

            localStorage.setItem('gmail_last_synced', new Date().toISOString());
            await this.saveProcessedIds();
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

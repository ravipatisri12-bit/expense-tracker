/**
 * Smart Input Component for Enhanced Transaction Entry
 * Robinhood-style dark theme with multi-transaction batch processing
 */

class SmartTransactionInput {
    constructor(expenseTracker) {
        this.tracker = expenseTracker;
        this.isProcessing = false;
        this.recentlyAdded = [];
        this.init();
    }

    init() {
        this.setupSmartInput();
        this.setupManualFormToggle();
        this.setupLLMConfig();
    }

    /**
     * Setup smart multi-transaction textarea input
     */
    setupSmartInput() {
        const smartInput = document.getElementById('smart-input');
        const parseButton = document.getElementById('parse-smart-input');

        if (!smartInput || !parseButton) return;

        // Parse button click - batch process all lines
        parseButton.addEventListener('click', async () => {
            await this.parseAndAddMultiple(smartInput.value);
        });

        // Allow Ctrl/Cmd + Enter to submit
        smartInput.addEventListener('keydown', async (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                await this.parseAndAddMultiple(smartInput.value);
            }
        });
    }

    /**
     * Setup manual form toggle functionality
     */
    setupManualFormToggle() {
        const toggleButton = document.getElementById('toggle-manual-form');
        const closeButton = document.getElementById('close-manual-form');
        const manualFormContainer = document.getElementById('manual-form-container');

        if (!toggleButton || !manualFormContainer) return;

        // Toggle show/hide
        toggleButton.addEventListener('click', () => {
            manualFormContainer.classList.toggle('hidden');
            if (!manualFormContainer.classList.contains('hidden') && window.expenseTracker) {
                window.expenseTracker.updateCategoryDropdown();
            }
            
            // Update button text
            if (manualFormContainer.classList.contains('hidden')) {
                toggleButton.innerHTML = `
                    <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                    </svg>
                    Manual Entry
                `;
            } else {
                toggleButton.innerHTML = `
                    <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                    Hide Manual Entry
                `;
            }
        });

        // Close button
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                manualFormContainer.classList.add('hidden');
                toggleButton.innerHTML = `
                    <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                    </svg>
                    Manual Entry
                `;
            });
        }
    }

    /**
     * Parse and add multiple transactions (from any format)
     */
    async parseAndAddMultiple(input) {
        if (!input.trim()) {
            showNotification('Please enter at least one transaction', 'error');
            return;
        }

        const parseButton = document.getElementById('parse-smart-input');
        const originalText = parseButton.textContent;
        
        try {
            this.isProcessing = true;
            parseButton.textContent = 'Processing...';
            parseButton.disabled = true;

            // Parse using LLM - it will return an array of transactions
            const parsedTransactions = await window.llmParser.parseTransaction(input);

            // Validate we got an array
            if (!Array.isArray(parsedTransactions) || parsedTransactions.length === 0) {
                showNotification('Could not parse any transactions. Please try again.', 'error');
                return;
            }

            // Show processing status
            this.showProcessingStatus(parsedTransactions.length);

            // Process each parsed transaction
            let successCount = 0;
            let failCount = 0;
            this.recentlyAdded = [];

            for (let i = 0; i < parsedTransactions.length; i++) {
                const parsed = parsedTransactions[i];
                
                try {
                    // Update progress
                    this.updateProgress(i + 1, parsedTransactions.length);

                    // Validate parsed data
                    if (!parsed.amount || parsed.amount <= 0) {
                        console.warn(`Skipping transaction - no valid amount found:`, parsed);
                        failCount++;
                        continue;
                    }

                    // Create expense object
                    const today = new Date();
                    const defaultDate = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0');
                    const expenseDate = parsed.date || defaultDate;
                    // Auto-tag with the trip whose window contains expenseDate (per spec §5.3),
                    // unless the user has flipped the per-page Untag toggle.
                    const untag = !!(window.expenseTracker && window.expenseTracker._addPageState && window.expenseTracker._addPageState.untag);
                    const tripId = (!untag && window.tripsStore && window.tripsStore.pickTripIdForDate)
                        ? window.tripsStore.pickTripIdForDate(expenseDate) : null;
                    const expense = {
                        id: this.tracker.nextExpenseId(),
                        amount: parsed.amount,
                        description: parsed.description || 'Expense',
                        category: parsed.category || 'Other',
                        date: expenseDate,
                        timestamp: Date.now() + i,
                        excludeFromBudget: false,
                        tripId
                    };

                    // Add to tracker
                    this.tracker.expenses.push(expense);
                    
                    // Save to localStorage
                    this.tracker.saveExpenses();
                    
                    // Save to Firebase if signed in
                    if (window.currentUser) {
                        await this.tracker.saveExpenseToFirebase(expense);
                    }

                    // Add to recently added list
                    this.recentlyAdded.push(expense);
                    successCount++;

                    // Small delay to avoid overwhelming the system
                    if (i < parsedTransactions.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }

                } catch (error) {
                    console.error(`Error processing transaction:`, parsed, error);
                    failCount++;
                }
            }

            // Hide processing status
            this.hideProcessingStatus();

            // Update UI
            this.tracker.updateDashboard();
            this.tracker.renderTransactions();

            // Show recently added
            this.showRecentlyAdded();

            // Clear input
            document.getElementById('smart-input').value = '';

            // Show summary notification
            if (successCount > 0) {
                const message = failCount > 0 
                    ? `Added ${successCount} transaction${successCount !== 1 ? 's' : ''}, ${failCount} failed`
                    : `Successfully added ${successCount} transaction${successCount !== 1 ? 's' : ''}!`;
                showNotification(message, 'success');
            } else {
                showNotification('Failed to add transactions. Please check your input.', 'error');
            }

        } catch (error) {
            console.error('Batch processing error:', error);
            showNotification('Failed to process transactions', 'error');
            this.hideProcessingStatus();
        } finally {
            this.isProcessing = false;
            parseButton.textContent = originalText;
            parseButton.disabled = false;
        }
    }

    /**
     * Show processing status UI
     */
    showProcessingStatus(total) {
        const statusContainer = document.getElementById('processing-status');
        if (!statusContainer) return;

        statusContainer.classList.remove('hidden');
        this.updateProgress(0, total);
    }

    /**
     * Update progress indicator
     */
    updateProgress(current, total) {
        const countElement = document.getElementById('process-count');
        const progressBar = document.getElementById('process-progress');

        if (countElement) {
            countElement.textContent = `${current}/${total}`;
        }

        if (progressBar) {
            const percentage = (current / total) * 100;
            progressBar.style.width = `${percentage}%`;
        }
    }

    /**
     * Hide processing status UI
     */
    hideProcessingStatus() {
        const statusContainer = document.getElementById('processing-status');
        if (!statusContainer) return;

        setTimeout(() => {
            statusContainer.classList.add('hidden');
        }, 1000);
    }

    /**
     * Show recently added transactions
     */
    showRecentlyAdded() {
        const container = document.getElementById('recent-added');
        const listContainer = document.getElementById('recent-added-list');

        if (!container || !listContainer || this.recentlyAdded.length === 0) return;

        listContainer.innerHTML = this.recentlyAdded.map(expense => `
            <div class="card flex items-center justify-between p-4">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full flex items-center justify-center" style="background:rgba(168,199,250,0.12)">
                        <span class="material-symbols-rounded" style="font-size:16px;color:var(--md-sys-color-primary)">check</span>
                    </div>
                    <div>
                        <p class="text-sm font-medium" style="color:var(--md-sys-color-on-surface)">${expense.description}</p>
                        <p class="text-xs" style="color:var(--md-sys-color-outline)">${expense.category}</p>
                    </div>
                </div>
                <span class="text-sm font-medium" style="color:var(--md-sys-color-on-surface)">$${expense.amount.toFixed(2)}</span>
            </div>
        `).join('');

        container.classList.remove('hidden');

        // Auto-hide after 5 seconds
        setTimeout(() => {
            container.classList.add('hidden');
            this.recentlyAdded = [];
        }, 5000);
    }

    /**
     * Setup LLM configuration
     */
    setupLLMConfig() {
        const configButton = document.getElementById('llm-config-btn');
        const configModal = document.getElementById('llm-config-modal');
        const saveConfigButton = document.getElementById('save-llm-config');
        const closeConfigButton = document.getElementById('close-llm-config');

        if (!configButton || !configModal) return;

        // Load current config
        const apiKeyInput = document.getElementById('llm-api-key');
        
        if (apiKeyInput) {
            apiKeyInput.value = localStorage.getItem('gemini_api_key') || '';
        }

        // Open modal
        configButton.addEventListener('click', () => {
            configModal.classList.remove('hidden');
        });

        // Close modal
        closeConfigButton.addEventListener('click', () => {
            configModal.classList.add('hidden');
        });

        // Save config
        saveConfigButton.addEventListener('click', () => {
            const apiKey = apiKeyInput.value.trim();

            if (apiKey) {
                window.llmParser.configure(apiKey);
                showNotification('Gemini API configured successfully!', 'success');
                configModal.classList.add('hidden');
            } else {
                showNotification('Please enter an API key', 'error');
            }
        });
    }

    attachLivePreview() {
        const ta = document.getElementById('smart-input');
        const preview = document.getElementById('smart-parse-preview');
        const ctaLabel = document.getElementById('smart-cta-label');
        const submitBtn = document.getElementById('parse-smart-input');
        if (!ta || !preview) return;
        let timer = null;
        const render = () => {
            const text = ta.value;
            if (!text.trim()) {
                preview.classList.add('hidden');
                if (ctaLabel) ctaLabel.textContent = 'Add expenses';
                if (submitBtn) submitBtn.disabled = true;
                return;
            }
            preview.classList.remove('hidden');
            // Use existing regex parser; never call Gemini for live preview.
            const parsed = window.llmParser.fallbackParseMultiple(text);
            const lines = text.split('\n').map(s => s.trim()).filter(Boolean);
            const ok = parsed.filter(p => p.amount && p.amount > 0);
            const rows = parsed.map(p => {
                if (!p.amount || p.amount <= 0) {
                    return `<div class="parse-row unparsed"><span class="amt">?</span><span class="desc">"${p.description}" — couldn't parse</span><span style="color:var(--warn);font-size:18px">!</span></div>`;
                }
                const cls = (p.category || 'other').toLowerCase().replace(/transportation/, 'transit').replace(/shopping/, 'shop').replace(/entertainment/, 'fun');
                const todayStr = window.expenseTracker
                    ? window.expenseTracker.getLocalDateString(new Date())
                    : (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
                const yest = (() => {
                    const d = new Date(); d.setDate(d.getDate() - 1);
                    return window.expenseTracker
                        ? window.expenseTracker.getLocalDateString(d)
                        : `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                })();
                const whenLabel = p.date === todayStr ? 'TODAY' : p.date === yest ? 'YESTERDAY' : (window.expenseTracker ? window.expenseTracker.parseLocalDate(p.date) : new Date(p.date + 'T00:00:00')).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
                return `<div class="parse-row"><span class="amt">$${p.amount}</span><span class="desc">${p.description}<span class="when">${whenLabel}</span></span><span class="cat-pill ${cls}">${p.category}</span></div>`;
            }).join('');
            preview.innerHTML = `<div class="ph"><span class="pulse"></span> Parsed live · ${ok.length} of ${lines.length}</div>${rows}`;
            if (ctaLabel) ctaLabel.textContent = ok.length === 0 ? 'Add expenses' : `Add ${ok.length} expense${ok.length === 1 ? '' : 's'}`;
            if (submitBtn) submitBtn.disabled = ok.length === 0;
        };
        ta.addEventListener('input', () => {
            clearTimeout(timer);
            timer = setTimeout(render, 300);
        });
        // Re-attach submit (renderAddExpensePage replaced the button)
        if (submitBtn && !submitBtn.dataset.bound) {
            submitBtn.dataset.bound = '1';
            submitBtn.addEventListener('click', async () => {
                await this.parseAndAddMultiple(ta.value);
            });
        }
        render();
    }
}

// Initialize when DOM is ready
let smartInput;
document.addEventListener('DOMContentLoaded', () => {
    // Wait for expenseTracker to be initialized
    setTimeout(() => {
        if (window.expenseTracker) {
            smartInput = new SmartTransactionInput(window.expenseTracker);
            window.smartInput = smartInput;
        }
    }, 100);
});

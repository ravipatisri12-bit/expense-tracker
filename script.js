/**
 * Modern Expense Tracker - Main Application
 * 
 * This file contains the core ExpenseTracker class and application logic.
 * Configuration, authentication, and utilities are loaded from separate modules.
 */

// ====================================================================
// MAIN APPLICATION CLASS
// ====================================================================

class ExpenseTracker {
    constructor() {
        this.expenses = JSON.parse(localStorage.getItem('expenses')) || [];
        this.settings = JSON.parse(localStorage.getItem('settings')) || this.getDefaultSettings();
        this.currentPage = 'dashboard';
        this.init();
    }

    getDefaultSettings() {
        return {
            income: 0,
            rent: 0,
            utilities: 0,
            insurance: 0,
            privacyMode: false,
            categories: ['Food', 'Transportation', 'Entertainment', 'Coffee', 'Shopping', 'Bills', 'Other'],
            goals: {
                Food: 300,
                Transportation: 200,
                Entertainment: 150,
                Coffee: 50,
                Shopping: 200,
                Bills: 400,
                Other: 100
            }
        };
    }

    // ====================================================================
    // APPLICATION INITIALIZATION
    // ====================================================================

    init() {
        this.setupEventListeners();
        this.renderCategoryGoalsSettings();
        this.renderExistingCategories();
        this.updateCategoryDropdown();
        this.loadSettings();
        this.updateDashboard();
        this.renderTransactions();
        this.initializeHistoryPage();
        this.initializeDateField();
        this.showPage('dashboard');
    }

    setupEventListeners() {
        // Form submission
        document.getElementById('expense-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addExpense();
        });

        // Edit form submission
        document.getElementById('edit-expense-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveEditedExpense();
        });
    }

    // ====================================================================
    // PAGE NAVIGATION
    // ====================================================================

    showPage(pageId, clickedElement = null) {
        // Hide all pages
        document.querySelectorAll('.page-content').forEach(page => {
            page.classList.add('hidden');
        });
        
        // Show selected page
        document.getElementById(pageId + '-page').classList.remove('hidden');
        
        // Update navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('text-primary-600', 'active-nav');
            btn.style.color='var(--md-sys-color-outline)';
            const icon = btn.querySelector('.material-symbols-rounded');
            if (icon) icon.style.fontVariationSettings = "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24";
        });
        
        // Highlight active nav button
        const activeBtn = document.querySelector(`[onclick="showPage('${pageId}')"]`);
        if (activeBtn) {
            activeBtn.style.color='';
            activeBtn.classList.add('text-primary-600', 'active-nav');
            const icon = activeBtn.querySelector('.material-symbols-rounded');
            if (icon) icon.style.fontVariationSettings = "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24";
        }
        
        this.currentPage = pageId;
    }

    // ====================================================================
    // EXPENSE MANAGEMENT
    // ====================================================================

    async addExpense() {
        const amount = parseFloat(document.getElementById('amount').value);
        const description = document.getElementById('description').value;
        const category = document.getElementById('category').value;
        const selectedDate = document.getElementById('expense-date').value;

        if (!amount || !description || !category || !selectedDate) return;

        // Create date from selected date, preserving the original date but adding current time
        const expenseDate = selectedDate; // Store as YYYY-MM-DD string
        
        const expense = {
            id: Date.now(),
            amount: amount,
            description: description,
            category: category,
            date: expenseDate,
            timestamp: Date.now()
        };

        // Add to local array
        this.expenses.push(expense);
        
        // Save to localStorage (always for offline support)
        this.saveExpenses();
        
        // Save to Firebase if user is signed in
        if (currentUser) {
            await this.saveExpenseToFirebase(expense);
        }

        this.updateDashboard();
        this.renderTransactions();
        this.clearForm();
        
        // Show success message
        showNotification('Expense added successfully!', 'success');
        
        // Redirect to dashboard
        this.showPage('dashboard');
    }

    async deleteExpense(expenseId) {
        if (confirm('Are you sure you want to delete this transaction?')) {
            // Remove from local array
            this.expenses = this.expenses.filter(expense => expense.id != expenseId);
            
            // Save to localStorage
            this.saveExpenses();
            
            // Delete from Firebase if user is signed in
            if (currentUser) {
                await this.deleteExpenseFromFirebase(expenseId);
            }

            this.updateDashboard();
            this.renderTransactions();
            showNotification('Transaction deleted successfully!', 'success');
        }
    }

    // ====================================================================
    // EXPENSE EDITING FUNCTIONALITY
    // ====================================================================

    editExpense(expenseId) {
        // Find the expense to edit
        const expense = this.expenses.find(e => e.id == expenseId);
        if (!expense) {
            showNotification('Transaction not found!', 'error');
            return;
        }

        // Populate edit form
        document.getElementById('edit-expense-id').value = expense.id;
        document.getElementById('edit-amount').value = expense.amount;
        document.getElementById('edit-description').value = expense.description;
        document.getElementById('edit-category').value = expense.category;
        
        // Format date for input field (convert from ISO to YYYY-MM-DD)
        const expenseDate = this.parseLocalDate(expense.date);
        document.getElementById('edit-date').value = this.getLocalDateString(expenseDate);

        // Populate category dropdown for edit form
        this.populateEditCategoryDropdown();

        // Show modal
        document.getElementById('edit-expense-modal').classList.remove('hidden');
    }

    populateEditCategoryDropdown() {
        const categorySelect = document.getElementById('edit-category');
        if (!categorySelect) return;
        
        // Ensure categories array exists
        if (!this.settings.categories) {
            this.settings.categories = Object.keys(this.settings.goals);
        }
        
        // Clear existing options except the default one
        categorySelect.innerHTML = '<option value="">Select a category</option>';
        
        // Add dynamic categories
        this.settings.categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            categorySelect.appendChild(option);
        });
    }

    async saveEditedExpense() {
        const expenseId = parseInt(document.getElementById('edit-expense-id').value);
        const amount = parseFloat(document.getElementById('edit-amount').value);
        const description = document.getElementById('edit-description').value;
        const category = document.getElementById('edit-category').value;
        const selectedDate = document.getElementById('edit-date').value;

        if (!amount || !description || !category || !selectedDate) {
            showNotification('Please fill in all fields', 'error');
            return;
        }

        // Find the expense in the array
        const expenseIndex = this.expenses.findIndex(e => e.id === expenseId);
        if (expenseIndex === -1) {
            showNotification('Transaction not found!', 'error');
            return;
        }

        // Create updated expense object
        const updatedExpense = {
            ...this.expenses[expenseIndex],
            amount: amount,
            description: description,
            category: category,
            date: selectedDate
        };

        // Update in local array
        this.expenses[expenseIndex] = updatedExpense;
        
        // Save to localStorage
        this.saveExpenses();
        
        // Save to Firebase if user is signed in
        if (currentUser) {
            await this.saveExpenseToFirebase(updatedExpense);
        }

        // Close modal
        this.closeEditModal();

        // Update UI
        this.updateDashboard();
        this.renderTransactions();
        
        showNotification('Transaction updated successfully!', 'success');
    }

    closeEditModal() {
        document.getElementById('edit-expense-modal').classList.add('hidden');
        document.getElementById('edit-expense-form').reset();
    }

    clearForm() {
        document.getElementById('expense-form').reset();
        // Reset date to today
        this.initializeDateField();
    }

    // ====================================================================
    // DASHBOARD UPDATES
    // ====================================================================

    updateDashboard() {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        
        const monthlyExpenses = this.expenses.filter(expense => {
            const d = this.parseLocalDate(expense.date);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        });

        const totalVariableExpenses = monthlyExpenses.reduce((sum, e) => sum + e.amount, 0);
        const totalFixedExpenses = this.settings.rent + this.settings.utilities + this.settings.insurance;

        // Big spending number + budget ring
        const monthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const el = (id) => document.getElementById(id);
        if (el('month-label')) el('month-label').textContent = monthLabel;
        if (el('big-spending-number')) el('big-spending-number').textContent = '$' + Math.round(totalVariableExpenses);

        // Budget ring
        const totalBudget = Object.values(this.settings.goals).reduce((s, v) => s + v, 0);
        const ring = el('budget-ring-progress');
        const ringLabel = el('budget-ring-label');
        if (ring && totalBudget > 0) {
            const pct = Math.min(totalVariableExpenses / totalBudget, 1.2);
            const circumference = 534.07;
            ring.style.strokeDashoffset = circumference * (1 - Math.min(pct, 1));
            ring.style.stroke = pct > 1 ? '#ef4444' : pct > 0.8 ? '#f59e0b' : '#22c55e';
            const ringLabel = el('budget-ring-label');
            if (ringLabel) ringLabel.textContent = `${Math.round(pct * 100)}% of $${Math.round(totalBudget)} budget`;
        }

        // Trend comparison vs last month
        const lastMonthExpenses = this.expenses.filter(e => {
            const d = this.parseLocalDate(e.date);
            return d.getMonth() === (currentMonth === 0 ? 11 : currentMonth - 1) && d.getFullYear() === (currentMonth === 0 ? currentYear - 1 : currentYear);
        });
        const lastMonthTotal = lastMonthExpenses.reduce((sum, e) => sum + e.amount, 0);
        const trendEl = el('spending-trend-text');
        if (trendEl && lastMonthTotal > 0) {
            const diff = totalVariableExpenses - lastMonthTotal;
            const pct = Math.abs(Math.round((diff / lastMonthTotal) * 100));
            trendEl.innerHTML = diff > 0
                ? `<span style="color:#cf6679">${pct}% more than last month</span>`
                : `<span style="color:var(--md-sys-color-primary)">${pct}% less than last month</span>`;
        } else if (trendEl) {
            trendEl.textContent = '';
        }

        // Fixed expenses (collapsed)
        if (el('rent-amount')) el('rent-amount').textContent = formatCurrency(this.settings.rent);
        if (el('utilities-amount')) el('utilities-amount').textContent = formatCurrency(this.settings.utilities);
        if (el('insurance-amount')) el('insurance-amount').textContent = formatCurrency(this.settings.insurance);
        if (el('fixed-total-collapsed')) el('fixed-total-collapsed').textContent = formatCurrency(totalFixedExpenses) + '/mo';

        // Spending trends (default: daily)
        this.currentTrendsView = this.currentTrendsView || 'daily';
        if (this.currentTrendsView === 'daily') {
            this.updateDailySpending('week');
        } else {
            this.updateWeeklySpending('recent');
        }

        // Streaks
        this.renderStreaks();

        // AI Insights
        this.renderInsights();

        // Pie chart
        this.renderPieChart(monthlyExpenses);
    }

    updateVariableExpenses(monthlyExpenses) {
        const expensesByCategory = {};
        
        // Group expenses by category
        monthlyExpenses.forEach(expense => {
            if (!expensesByCategory[expense.category]) {
                expensesByCategory[expense.category] = 0;
            }
            expensesByCategory[expense.category] += expense.amount;
        });

        // Render variable expenses list
        const container = document.getElementById('variable-expenses-list');
        container.innerHTML = '';

        // Sort categories by spending amount (highest to lowest)
        const sortedCategories = Object.keys(this.settings.goals).sort((a, b) => {
            const spentA = expensesByCategory[a] || 0;
            const spentB = expensesByCategory[b] || 0;
            return spentB - spentA; // Sort descending
        });

        sortedCategories.forEach(category => {
            const spent = expensesByCategory[category] || 0;
            const goal = this.settings.goals[category];
            const percentage = goal > 0 ? Math.min((spent / goal) * 100, 100) : 0;

            const expenseItem = document.createElement('div');
            expenseItem.className = 'flex justify-between items-center py-2';
            expenseItem.innerHTML = `
                <div class="flex-1">
                    <div class="flex justify-between text-sm">
                        <span style="color:var(--md-sys-color-on-surface-variant)">${category}</span>
                        <span class="font-medium">${formatCurrency(spent)}/${formatCurrency(goal)}</span>
                    </div>
                    <div class="w-full rounded-full h-2 mt-1" style="background:rgba(255,255,255,0.08)">
                        <div class="bg-primary-500 h-2 rounded-full transition-all duration-300" style="width: ${percentage}%"></div>
                    </div>
                </div>
            `;
            container.appendChild(expenseItem);
        });
    }

    updateRecentTransactions() {
        const container = document.getElementById('recent-transactions');
        const recentExpenses = [...this.expenses]
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 5);

        if (recentExpenses.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8" style="color:var(--md-sys-color-outline)">
                    No transactions yet. <button onclick="expenseTracker.showPage('add-expense')" class="text-primary-600 hover:text-primary-700">Add your first expense</button>
                </div>
            `;
            return;
        }

        container.innerHTML = recentExpenses.map(expense => `
            <div class="flex items-center justify-between p-3 rounded-lg">
                <div class="flex items-center space-x-3">
                    <div class="w-2 h-2 bg-primary-500 rounded-full"></div>
                    <div>
                        <p class="font-medium " style="color:var(--md-sys-color-on-surface)">${expense.description}</p>
                        <p class="text-sm " style="color:var(--md-sys-color-outline)">${expense.category} • ${formatDate(expense.date)}</p>
                    </div>
                </div>
                <span class="font-semibold " style="color:var(--md-sys-color-on-surface-variant)">-${formatCurrency(expense.amount)}</span>
            </div>
        `).join('');
    }

    // ====================================================================
    // TRANSACTIONS RENDERING
    // ====================================================================

    renderTransactions() {
        const container = document.getElementById('all-transactions');
        const sortedExpenses = [...this.expenses].sort((a, b) => b.timestamp - a.timestamp);

        if (sortedExpenses.length === 0) {
            container.innerHTML = `
                <div class="p-8 text-center" style="color:var(--md-sys-color-outline)">
                    No transactions yet. <button onclick="expenseTracker.showPage('add-expense')" class="text-primary-600 hover:text-primary-700">Add your first expense</button>
                </div>
            `;
            return;
        }

        // Group transactions by date
        const groupedByDate = this.groupTransactionsByDate(sortedExpenses);
        
        // Render grouped transactions
        const catColors = {Food:'#f5576c',Coffee:'#f093fb',Transportation:'#4facfe',Entertainment:'#667eea',Shopping:'#43e97b',Bills:'#fccb90',Other:'#a18cd1'};
        container.innerHTML = groupedByDate.map(dateGroup => {
            const transactionsHtml = dateGroup.transactions.map(expense => {
                const c = catColors[expense.category] || '#a18cd1';
                return `
                <div class="flex items-center justify-between px-4 py-3.5">
                    <div class="flex items-center space-x-3">
                        <div class="w-9 h-9 rounded-full flex items-center justify-center" style="background:${c}30">
                            <span style="color:${c};font-weight:600" class="text-xs">${expense.category.charAt(0)}</span>
                        </div>
                        <div>
                            <p class="font-medium text-sm" style="color:var(--md-sys-color-on-surface)">${expense.description}</p>
                            <p class="text-xs" style="color:${c}">${expense.category}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="font-semibold text-sm" style="color:var(--md-sys-color-on-surface)">${formatCurrency(expense.amount)}</span>
                        <button onclick="expenseTracker.editExpense(${expense.id})" class="p-1 rounded" style="color:var(--md-sys-color-outline)">
                            <span class="material-symbols-rounded text-base">edit</span>
                        </button>
                        <button onclick="expenseTracker.deleteExpense(${expense.id})" class="p-1 rounded" style="color:var(--md-sys-color-outline)">
                            <span class="material-symbols-rounded text-base">delete</span>
                        </button>
                    </div>
                </div>
            `}).join('');

            return `
                <div class="mb-2">
                    <div class="px-4 py-2.5">
                        <div class="flex justify-between items-center">
                            <div>
                                <h3 class="font-medium text-sm" style="color:var(--md-sys-color-on-surface)">${dateGroup.dateLabel}</h3>
                                <p class="text-xs" style="color:var(--md-sys-color-outline)">${dateGroup.transactions.length} transaction${dateGroup.transactions.length !== 1 ? 's' : ''}</p>
                            </div>
                            <p class="font-medium text-sm" style="color:var(--md-sys-color-on-surface-variant)">-${formatCurrency(dateGroup.totalAmount)}</p>
                        </div>
                    </div>
                    <div>${transactionsHtml}</div>
                </div>
            `;
        }).join('');
    }

    groupTransactionsByDate(expenses) {
        const groups = {};
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);

        expenses.forEach(expense => {
            const expenseDate = this.parseLocalDate(expense.date);
            const dateString = this.getLocalDateString(expenseDate);
            
            if (!groups[dateString]) {
                groups[dateString] = {
                    date: dateString,
                    dateObj: expenseDate,
                    transactions: [],
                    totalAmount: 0
                };
            }
            
            groups[dateString].transactions.push(expense);
            groups[dateString].totalAmount += expense.amount;
        });

        // Convert to array and sort by date (newest first)
        return Object.values(groups)
            .sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime())
            .map(group => {
                // Create user-friendly date labels
                const todayString = this.getLocalDateString(today);
                const yesterdayString = this.getLocalDateString(yesterday);
                
                let dateLabel;
                if (group.date === todayString) {
                    dateLabel = 'Today';
                } else if (group.date === yesterdayString) {
                    dateLabel = 'Yesterday';
                } else {
                    // Check if it's this week
                    const weekAgo = new Date(today);
                    weekAgo.setDate(today.getDate() - 7);
                    
                    if (group.dateObj > weekAgo) {
                        dateLabel = group.dateObj.toLocaleDateString('en-US', { 
                            weekday: 'long',
                            month: 'short',
                            day: 'numeric'
                        });
                    } else {
                        dateLabel = group.dateObj.toLocaleDateString('en-US', { 
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                        });
                    }
                }

                return {
                    ...group,
                    dateLabel
                };
            });
    }

    // ====================================================================
    // SETTINGS MANAGEMENT
    // ====================================================================

    renderCategoryGoalsSettings() {
        const container = document.getElementById('category-goals-settings');
        container.innerHTML = Object.keys(this.settings.goals).map(category => `
            <div>
                <label class="block text-sm font-medium mb-2" style="color:var(--md-sys-color-on-surface-variant)">${category} Goal</label>
                <div class="relative">
                    <span class="absolute left-3 top-1/2 transform -translate-y-1/2 " style="color:var(--md-sys-color-outline)">$</span>
                    <input type="number" id="goal-${category.toLowerCase()}" step="0.01" placeholder="0.00" 
                           value="${this.settings.goals[category]}"
                           class="pl-8 block w-full rounded-lg border-0 shadow-sm focus:border-primary-500 focus:ring-primary-500">
                </div>
            </div>
        `).join('');
    }

    loadSettings() {
        document.getElementById('setting-rent').value = this.settings.rent;
        document.getElementById('setting-utilities').value = this.settings.utilities;
        document.getElementById('setting-insurance').value = this.settings.insurance;
        document.getElementById('setting-income').value = this.settings.income;
        
        // Load privacy toggle
        document.getElementById('privacy-toggle').checked = this.settings.privacyMode;
        this.applyPrivacyMode();
        
        // Load category goals
        Object.keys(this.settings.goals).forEach(category => {
            const input = document.getElementById(`goal-${category.toLowerCase()}`);
            if (input) {
                input.value = this.settings.goals[category];
            }
        });
    }

    saveSettings() {
        this.settings.rent = parseFloat(document.getElementById('setting-rent').value) || 0;
        this.settings.utilities = parseFloat(document.getElementById('setting-utilities').value) || 0;
        this.settings.insurance = parseFloat(document.getElementById('setting-insurance').value) || 0;
        this.settings.income = parseFloat(document.getElementById('setting-income').value) || 0;

        // Save category goals
        Object.keys(this.settings.goals).forEach(category => {
            const input = document.getElementById(`goal-${category.toLowerCase()}`);
            if (input) {
                this.settings.goals[category] = parseFloat(input.value) || 0;
            }
        });

        // Save to localStorage (always)
        localStorage.setItem('settings', JSON.stringify(this.settings));
        
        // Save to Firebase if user is signed in
        if (currentUser) {
            this.saveSettingsToFirebase();
        }
        
        this.updateDashboard();
        showNotification('Settings saved successfully!', 'success');
    }

    // ====================================================================
    // FIREBASE DATA METHODS
    // ====================================================================

    async loadUserData() {
        if (!currentUser) return;

        try {
            // Load expenses from Firebase
            const expensesSnapshot = await db.collection('users')
                .doc(currentUser.uid)
                .collection('expenses')
                .orderBy('timestamp', 'desc')
                .get();
            
            this.expenses = expensesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Load settings from Firebase
            const settingsDoc = await db.collection('users')
                .doc(currentUser.uid)
                .collection('settings')
                .doc('data')
                .get();
            
            if (settingsDoc.exists) {
                this.settings = { ...this.getDefaultSettings(), ...settingsDoc.data() };
                // Restore API key from synced settings
                if (this.settings.geminiApiKey) {
                    localStorage.setItem('gemini_api_key', this.settings.geminiApiKey);
                    if (window.llmParser) window.llmParser.configure(this.settings.geminiApiKey);
                }
            }

            // Update UI
            this.loadSettings();
            this.updateDashboard();
            this.renderTransactions();
            
            // Set up real-time listener
            this.setupRealtimeListeners();
            
            // Check for local data to migrate
            const localExpenses = JSON.parse(localStorage.getItem('expenses')) || [];
            if (localExpenses.length > 0) {
                this.migrateLocalDataToFirebase(localExpenses);
            }

        } catch (error) {
            console.error('Error loading user data:', error);
            showNotification('Failed to load data from cloud', 'error');
            this.loadLocalData();
        }
    }

    loadLocalData() {
        // Load from localStorage when not signed in
        this.expenses = JSON.parse(localStorage.getItem('expenses')) || [];
        this.settings = JSON.parse(localStorage.getItem('settings')) || this.getDefaultSettings();
        
        this.loadSettings();
        this.updateDashboard();
        this.renderTransactions();
    }

    async saveExpenseToFirebase(expense) {
        if (!currentUser) return;

        try {
            await db.collection('users')
                .doc(currentUser.uid)
                .collection('expenses')
                .doc(expense.id.toString())
                .set(expense);
        } catch (error) {
            console.error('Error saving expense to Firebase:', error);
        }
    }

    async saveSettingsToFirebase() {
        if (!currentUser) return;

        try {
            await db.collection('users')
                .doc(currentUser.uid)
                .collection('settings')
                .doc('data')
                .set(this.settings);
        } catch (error) {
            console.error('Error saving settings to Firebase:', error);
        }
    }

    async deleteExpenseFromFirebase(expenseId) {
        if (!currentUser) return;

        try {
            await db.collection('users')
                .doc(currentUser.uid)
                .collection('expenses')
                .doc(expenseId.toString())
                .delete();
        } catch (error) {
            console.error('Error deleting expense from Firebase:', error);
        }
    }

    setupRealtimeListeners() {
        if (!currentUser) return;

        // Listen for real-time expense updates
        this.expensesListener = db.collection('users')
            .doc(currentUser.uid)
            .collection('expenses')
            .orderBy('timestamp', 'desc')
            .onSnapshot((snapshot) => {
                this.expenses = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                
                this.updateDashboard();
                this.renderTransactions();
            }, (error) => {
                console.error('Realtime listener error:', error);
            });
    }

    async migrateLocalDataToFirebase(localExpenses) {
        if (!currentUser) return;

        try {
            showNotification('Migrating your data to cloud...', 'success');
            
            // Migrate expenses
            for (const expense of localExpenses) {
                await this.saveExpenseToFirebase(expense);
            }

            // Clear localStorage after successful migration
            localStorage.removeItem('expenses');
            showNotification('Data successfully migrated to cloud!', 'success');
            
        } catch (error) {
            console.error('Error migrating data:', error);
            showNotification('Failed to migrate some data', 'error');
        }
    }

    // ====================================================================
    // DATA EXPORT
    // ====================================================================

    exportCSV() {
        if (this.expenses.length === 0) {
            alert('No transactions to export');
            return;
        }

        const headers = ['Date', 'Description', 'Category', 'Amount'];
        const csvContent = [
            headers.join(','),
            ...this.expenses.map(expense => [
                formatDate(expense.date),
                `"${expense.description}"`,
                expense.category,
                expense.amount
            ].join(','))
        ].join('\n');

        downloadFile(csvContent, `expenses_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
        showNotification('Expenses exported successfully!', 'success');
    }

    // ====================================================================
    // UTILITIES & LOCAL STORAGE
    // ====================================================================

    saveExpenses() {
        localStorage.setItem('expenses', JSON.stringify(this.expenses));
    }

    // ====================================================================
    // HISTORY PAGE FUNCTIONALITY
    // ====================================================================

    initializeHistoryPage() {
        this.populateHistoryYearSelector();
        this.setDefaultHistoryDate();
    }

    populateHistoryYearSelector() {
        const yearSelect = document.getElementById('history-year');
        const currentYear = new Date().getFullYear();
        const startYear = 2020; // Reasonable start year

        yearSelect.innerHTML = '';
        for (let year = currentYear; year >= startYear; year--) {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            if (year === currentYear) {
                option.selected = true;
            }
            yearSelect.appendChild(option);
        }
    }

    setDefaultHistoryDate() {
        const monthSelect = document.getElementById('history-month');
        const currentMonth = new Date().getMonth();
        monthSelect.value = currentMonth;
    }

    getHistoricalData(month, year) {
        // Filter expenses for the selected month and year
        const historicalExpenses = this.expenses.filter(expense => {
            const expenseDate = this.parseLocalDate(expense.date);
            return expenseDate.getMonth() === parseInt(month) && expenseDate.getFullYear() === parseInt(year);
        });

        // Calculate totals
        const totalVariableExpenses = historicalExpenses.reduce((sum, expense) => sum + expense.amount, 0);
        const totalFixedExpenses = this.settings.rent + this.settings.utilities + this.settings.insurance;
        const totalExpenses = totalVariableExpenses + totalFixedExpenses;
        const totalSavings = this.settings.income - totalExpenses;

        // Group expenses by category
        const expensesByCategory = {};
        historicalExpenses.forEach(expense => {
            if (!expensesByCategory[expense.category]) {
                expensesByCategory[expense.category] = 0;
            }
            expensesByCategory[expense.category] += expense.amount;
        });

        return {
            expenses: historicalExpenses,
            totals: {
                income: this.settings.income,
                totalExpenses,
                variableExpenses: totalVariableExpenses,
                fixedExpenses: totalFixedExpenses,
                savings: totalSavings
            },
            byCategory: expensesByCategory
        };
    }

    getCurrentMonthData() {
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        return this.getHistoricalData(currentMonth, currentYear);
    }

    updateHistoryView() {
        const selectedMonth = document.getElementById('history-month').value;
        const selectedYear = document.getElementById('history-year').value;
        
        if (!selectedMonth || !selectedYear) return;

        const historicalData = this.getHistoricalData(selectedMonth, selectedYear);
        const currentData = this.getCurrentMonthData();

        // Update summary cards
        document.getElementById('history-income').textContent = formatCurrency(historicalData.totals.income);
        document.getElementById('history-total-expenses').textContent = formatCurrency(historicalData.totals.totalExpenses);
        document.getElementById('history-variable-only').textContent = formatCurrency(historicalData.totals.variableExpenses);
        document.getElementById('history-savings').textContent = formatCurrency(historicalData.totals.savings);

        // Update category breakdown
        this.updateHistoryCategoryBreakdown(historicalData.byCategory);

        // Update comparison
        this.updateHistoryComparison(historicalData, currentData, selectedMonth, selectedYear);

        // Update historical transactions
        this.updateHistoryTransactions(historicalData.expenses, selectedMonth, selectedYear);
    }

    updateHistoryCategoryBreakdown(expensesByCategory) {
        const container = document.getElementById('history-category-breakdown');
        
        if (Object.keys(expensesByCategory).length === 0) {
            container.innerHTML = '<div class="text-center py-8" style="color:var(--md-sys-color-outline)">No expenses found for selected month</div>';
            return;
        }

        container.innerHTML = Object.keys(this.settings.goals).map(category => {
            const spent = expensesByCategory[category] || 0;
            const goal = this.settings.goals[category];
            const percentage = goal > 0 ? Math.min((spent / goal) * 100, 100) : 0;

            return `
                <div class="flex justify-between items-center py-2">
                    <div class="flex-1">
                        <div class="flex justify-between text-sm">
                            <span style="color:var(--md-sys-color-on-surface-variant)">${category}</span>
                            <span class="font-medium">${formatCurrency(spent)}/${formatCurrency(goal)}</span>
                        </div>
                        <div class="w-full rounded-full h-2 mt-1" style="background:rgba(255,255,255,0.08)">
                            <div class="bg-primary-500 h-2 rounded-full transition-all duration-300" style="width: ${percentage}%"></div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    updateHistoryComparison(historicalData, currentData, selectedMonth, selectedYear) {
        const container = document.getElementById('history-comparison');
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();

        // Check if selected month is current month
        const isCurrentMonth = (parseInt(selectedMonth) === currentMonth && parseInt(selectedYear) === currentYear);

        if (isCurrentMonth) {
            container.innerHTML = '<div class="text-center py-8" style="color:var(--md-sys-color-outline)">This is the current month</div>';
            return;
        }

        const selectedMonthName = getMonthName(selectedMonth);
        const currentMonthName = getMonthName(currentMonth);

        const variableDiff = currentData.totals.variableExpenses - historicalData.totals.variableExpenses;
        const totalDiff = currentData.totals.totalExpenses - historicalData.totals.totalExpenses;
        const savingsDiff = currentData.totals.savings - historicalData.totals.savings;

        container.innerHTML = `
            <div class="space-y-4">
                <div class="flex justify-between items-center py-2 " style="border-bottom:1px solid rgba(255,255,255,0.06)"">
                    <span style="color:var(--md-sys-color-on-surface-variant)">Variable Expenses</span>
                    <div class="text-right">
                        <div class="font-medium">${formatCurrency(Math.abs(variableDiff))}</div>
                        <div class="text-sm" style="color:${variableDiff > 0 ? '#cf6679' : 'var(--md-sys-color-primary)'}">
                            ${variableDiff > 0 ? 'More' : 'Less'} than ${selectedMonthName}
                        </div>
                    </div>
                </div>
                <div class="flex justify-between items-center py-2" style="border-bottom:1px solid rgba(255,255,255,0.06)">
                    <span style="color:var(--md-sys-color-on-surface-variant)">Total Expenses</span>
                    <div class="text-right">
                        <div class="font-medium">${formatCurrency(Math.abs(totalDiff))}</div>
                        <div class="text-sm" style="color:${totalDiff > 0 ? '#cf6679' : 'var(--md-sys-color-primary)'}">
                            ${totalDiff > 0 ? 'More' : 'Less'} than ${selectedMonthName}
                        </div>
                    </div>
                </div>
                <div class="flex justify-between items-center py-2">
                    <span style="color:var(--md-sys-color-on-surface-variant)">Savings</span>
                    <div class="text-right">
                        <div class="font-medium">${formatCurrency(Math.abs(savingsDiff))}</div>
                        <div class="text-sm" style="color:${savingsDiff > 0 ? 'var(--md-sys-color-primary)' : '#cf6679'}">
                            ${savingsDiff > 0 ? 'More' : 'Less'} than ${selectedMonthName}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    updateHistoryTransactions(expenses, selectedMonth, selectedYear) {
        const container = document.getElementById('history-transactions');
        
        if (expenses.length === 0) {
            container.innerHTML = '<div class="p-8 text-center" style="color:var(--md-sys-color-outline)">No transactions found for selected month</div>';
            return;
        }

        const selectedMonthName = getMonthName(selectedMonth);
        const sortedExpenses = [...expenses].sort((a, b) => b.timestamp - a.timestamp);

        container.innerHTML = `
            <div class="p-4 border-b">
                <h4 class="font-medium " style="color:var(--md-sys-color-on-surface)">${selectedMonthName} ${selectedYear} - ${expenses.length} transactions</h4>
            </div>
            ${sortedExpenses.map(expense => `
                <div class="flex items-center justify-between p-4">
                    <div class="flex items-center space-x-4">
                        <div class="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                            <span class="text-primary-600 font-medium text-sm">${expense.category.charAt(0)}</span>
                        </div>
                        <div>
                            <p class="font-medium " style="color:var(--md-sys-color-on-surface)">${expense.description}</p>
                            <p class="text-sm " style="color:var(--md-sys-color-outline)">${expense.category} • ${formatDate(expense.date)}</p>
                        </div>
                    </div>
                    <span class="font-semibold " style="color:var(--md-sys-color-on-surface-variant)">-${formatCurrency(expense.amount)}</span>
                </div>
            `).join('')}
        `;
    }

    // ====================================================================
    // PRIVACY MODE FUNCTIONALITY
    // ====================================================================

    togglePrivacyMode() {
        this.settings.privacyMode = document.getElementById('privacy-toggle').checked;
        this.applyPrivacyMode();
        
        // Save settings immediately
        localStorage.setItem('settings', JSON.stringify(this.settings));
        if (currentUser) {
            this.saveSettingsToFirebase();
        }
        
        showNotification(
            this.settings.privacyMode ? 'Privacy mode enabled' : 'Privacy mode disabled', 
            'success'
        );
    }

    applyPrivacyMode() {
        const isPrivate = this.settings.privacyMode;
        document.body.classList.toggle('privacy-mode', isPrivate);
    }

    // ====================================================================
    // DATE FIELD INITIALIZATION
    // ====================================================================

    initializeDateField() {
        const dateInput = document.getElementById('expense-date');
        if (dateInput) {
            // Set today's date as default using local timezone
            const today = this.getLocalDateString(new Date());
            dateInput.value = today;
        }
    }

    // ====================================================================
    // DAILY SPENDING FUNCTIONALITY
    // ====================================================================

    updateDailySpending(period = 'week') {
        const container = document.getElementById('trends-content');
        const averageElement = document.getElementById('trends-average');
        const avgLabel = document.getElementById('trends-avg-label');
        
        if (!container || !averageElement) return;
        if (avgLabel) avgLabel.textContent = 'Avg per day';

        const dailyData = this.getDailySpendingData(period);
        
        if (dailyData.days.length === 0) {
            container.innerHTML = '<div class="text-center py-8" style="color:var(--md-sys-color-outline)">No expenses found for this period</div>';
            averageElement.textContent = '$0.00';
            return;
        }

        // Calculate average
        const totalAmount = dailyData.days.reduce((sum, day) => sum + day.amount, 0);
        const average = dailyData.days.length > 0 ? totalAmount / dailyData.days.length : 0;
        averageElement.textContent = formatCurrency(average);

        // Update title
        const titleElement = container.previousElementSibling.querySelector('h3');
        if (titleElement) {
            titleElement.textContent = `Daily Spending (${period === 'week' ? 'This Week' : 'This Month'})`;
        }

        // Render daily spending items
        container.innerHTML = dailyData.days.map(day => {
            const percentage = dailyData.maxAmount > 0 ? (day.amount / dailyData.maxAmount) * 100 : 0;
            
            return `
                <div class="flex items-center justify-between py-3 px-2 rounded-lg">
                    <div class="flex items-center space-x-3">
                        <div class="text-sm font-medium w-20" style="color:var(--md-sys-color-on-surface)">${day.dayName}</div>
                        <div class="flex-1">
                            <div class="text-xs mb-1" style="color:var(--md-sys-color-outline)">${day.transactionCount} transaction${day.transactionCount !== 1 ? 's' : ''}</div>
                            <div class="w-full rounded-full h-2" style="background:rgba(255,255,255,0.08)">
                                <div class="bg-primary-500 h-2 rounded-full transition-all duration-300" style="width: ${percentage}%"></div>
                            </div>
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="font-semibold " style="color:var(--md-sys-color-on-surface)">${formatCurrency(day.amount)}</div>
                        ${day.isToday ? '<div class="text-xs text-primary-600">Today</div>' : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    getDailySpendingData(period) {
        const today = new Date();
        const days = [];
        let startDate, endDate;

        if (period === 'week') {
            // Get current week (Sunday to Saturday)
            const dayOfWeek = today.getDay();
            startDate = new Date(today);
            startDate.setDate(today.getDate() - dayOfWeek);
            endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 6);
            
            // Generate 7 days for the week
            for (let i = 0; i < 7; i++) {
                const date = new Date(startDate);
                date.setDate(startDate.getDate() + i);
                days.push(this.getDaySpendingData(date));
            }
        } else {
            // Get current month
            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            
            // Generate all days in the current month
            const daysInMonth = endDate.getDate();
            for (let i = 1; i <= daysInMonth; i++) {
                const date = new Date(today.getFullYear(), today.getMonth(), i);
                days.push(this.getDaySpendingData(date));
            }
        }

        // Find max amount for percentage calculation
        const maxAmount = Math.max(...days.map(day => day.amount), 0);

        return { days, maxAmount };
    }

    getDaySpendingData(date) {
        // Use local date strings to avoid timezone issues
        const dateString = this.getLocalDateString(date);
        const today = this.getLocalDateString(new Date());
        
        // Filter expenses for this specific date
        const dayExpenses = this.expenses.filter(expense => {
            const expenseDate = this.getLocalDateString(this.parseLocalDate(expense.date));
            return expenseDate === dateString;
        });

        const amount = dayExpenses.reduce((sum, expense) => sum + expense.amount, 0);
        
        return {
            date: dateString,
            dayName: this.formatDayName(date),
            amount: amount,
            transactionCount: dayExpenses.length,
            isToday: dateString === today,
            expenses: dayExpenses
        };
    }

    // Helper function to get consistent local date strings (avoiding timezone issues)
    getLocalDateString(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // Parse date string as local date (not UTC). Handles both YYYY-MM-DD and ISO strings
    parseLocalDate(dateStr) {
        if (dateStr instanceof Date) return dateStr;
        const s = String(dateStr);
        // YYYY-MM-DD (no time) — parse as local
        const parts = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (parts) return new Date(parseInt(parts[1]), parseInt(parts[2])-1, parseInt(parts[3]));
        // ISO string with T — also parse as local to avoid shift
        const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})T/);
        if (iso) return new Date(parseInt(iso[1]), parseInt(iso[2])-1, parseInt(iso[3]));
        return new Date(s);
    }

    formatDayName(date) {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        
        // Use local date strings to avoid timezone issues
        const dateString = this.getLocalDateString(date);
        const todayString = this.getLocalDateString(today);
        const yesterdayString = this.getLocalDateString(yesterday);
        
        if (dateString === todayString) {
            return 'Today';
        } else if (dateString === yesterdayString) {
            return 'Yesterday';
        } else {
            // Return day name and date for current week, or just date for month view
            return date.toLocaleDateString('en-US', { 
                weekday: 'short', 
                month: 'short', 
                day: 'numeric' 
            });
        }
    }

    // ====================================================================
    // WEEKLY SPENDING FUNCTIONALITY
    // ====================================================================

    updateWeeklySpending(period = 'recent') {
        const container = document.getElementById('trends-content');
        const averageElement = document.getElementById('trends-average');
        const avgLabel = document.getElementById('trends-avg-label');
        
        if (!container || !averageElement) return;
        if (avgLabel) avgLabel.textContent = 'Avg per week';

        const weeklyData = this.getWeeklySpendingData(period);
        
        if (weeklyData.weeks.length === 0) {
            container.innerHTML = '<div class="text-center py-8" style="color:var(--md-sys-color-outline)">No weekly data available</div>';
            averageElement.textContent = '$0.00';
            return;
        }

        // Calculate average
        const totalAmount = weeklyData.weeks.reduce((sum, week) => sum + week.amount, 0);
        const average = weeklyData.weeks.length > 0 ? totalAmount / weeklyData.weeks.length : 0;
        averageElement.textContent = formatCurrency(average);

        // Render weekly spending items
        container.innerHTML = weeklyData.weeks.map(week => {
            const percentage = weeklyData.maxAmount > 0 ? (week.amount / weeklyData.maxAmount) * 100 : 0;
            
            return `
                <div class="flex items-center justify-between py-3 px-2 rounded-lg">
                    <div class="flex items-center space-x-3">
                        <div class="text-sm font-medium w-32" style="color:var(--md-sys-color-on-surface)">${week.weekName}</div>
                        <div class="flex-1">
                            <div class="text-xs mb-1" style="color:var(--md-sys-color-outline)">${week.transactionCount} transaction${week.transactionCount !== 1 ? 's' : ''}</div>
                            <div class="w-full rounded-full h-2" style="background:rgba(255,255,255,0.08)">
                                <div class="h-2 rounded-full transition-all duration-300" style="background:var(--accent-gradient)" style="width: ${percentage}%"></div>
                            </div>
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="font-semibold " style="color:var(--md-sys-color-on-surface)">${formatCurrency(week.amount)}</div>
                        ${week.isCurrentWeek ? '<div class="text-xs " style="color:var(--md-sys-color-primary)">Current</div>' : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    getWeeklySpendingData(period) {
        const today = new Date();
        const weeks = [];

        if (period === 'recent') {
            // Get last 4 weeks including current week
            for (let i = 3; i >= 0; i--) {
                const weekStart = new Date(today);
                weekStart.setDate(today.getDate() - (today.getDay()) - (i * 7));
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekStart.getDate() + 6);
                
                weeks.push(this.getWeekSpendingData(weekStart, weekEnd));
            }
        } else {
            // Get all weeks in current month
            const currentMonth = today.getMonth();
            const currentYear = today.getFullYear();
            
            // Start from the first day of the month
            let weekStart = new Date(currentYear, currentMonth, 1);
            
            // Adjust to start from Sunday
            weekStart.setDate(weekStart.getDate() - weekStart.getDay());
            
            while (weekStart.getMonth() <= currentMonth || weekStart.getDate() === 1) {
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekStart.getDate() + 6);
                
                // Only include weeks that have days in current month
                if (weekStart.getMonth() === currentMonth || weekEnd.getMonth() === currentMonth) {
                    weeks.push(this.getWeekSpendingData(weekStart, weekEnd));
                }
                
                // Move to next week
                weekStart.setDate(weekStart.getDate() + 7);
                
                // Break if we've moved beyond current month
                if (weekStart.getMonth() > currentMonth && weekStart.getFullYear() >= currentYear) {
                    break;
                }
            }
        }

        // Find max amount for percentage calculation
        const maxAmount = Math.max(...weeks.map(week => week.amount), 0);

        return { weeks, maxAmount };
    }

    getWeekSpendingData(weekStart, weekEnd) {
        const weekStartString = weekStart.toISOString().split('T')[0];
        const weekEndString = weekEnd.toISOString().split('T')[0];
        
        // Filter expenses for this week
        const weekExpenses = this.expenses.filter(expense => {
            const expenseDate = this.getLocalDateString(this.parseLocalDate(expense.date));
            return expenseDate >= weekStartString && expenseDate <= weekEndString;
        });

        const amount = weekExpenses.reduce((sum, expense) => sum + expense.amount, 0);
        
        return {
            weekStart: weekStartString,
            weekEnd: weekEndString,
            weekName: this.formatWeekName(weekStart, weekEnd),
            amount: amount,
            transactionCount: weekExpenses.length,
            isCurrentWeek: this.isCurrentWeek(weekStart, weekEnd),
            expenses: weekExpenses
        };
    }

    formatWeekName(weekStart, weekEnd) {
        const today = new Date();
        
        // Check if this is current week
        if (this.isCurrentWeek(weekStart, weekEnd)) {
            return 'This Week';
        }
        
        // Check if this is last week
        const lastWeekStart = new Date(today);
        lastWeekStart.setDate(today.getDate() - today.getDay() - 7);
        const lastWeekEnd = new Date(lastWeekStart);
        lastWeekEnd.setDate(lastWeekStart.getDate() + 6);
        
        if (weekStart.getTime() === lastWeekStart.getTime()) {
            return 'Last Week';
        }
        
        // Format as date range
        const startMonth = weekStart.toLocaleDateString('en-US', { month: 'short' });
        const startDay = weekStart.getDate();
        const endMonth = weekEnd.toLocaleDateString('en-US', { month: 'short' });
        const endDay = weekEnd.getDate();
        
        if (startMonth === endMonth) {
            return `${startMonth} ${startDay}-${endDay}`;
        } else {
            return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
        }
    }

    isCurrentWeek(weekStart, weekEnd) {
        const today = new Date();
        const todayString = today.toISOString().split('T')[0];
        const weekStartString = weekStart.toISOString().split('T')[0];
        const weekEndString = weekEnd.toISOString().split('T')[0];
        
        return todayString >= weekStartString && todayString <= weekEndString;
    }

    // ====================================================================
    // DYNAMIC CATEGORY MANAGEMENT
    // ====================================================================

    renderExistingCategories() {
        const container = document.getElementById('existing-categories');
        if (!container) return;
        
        // Ensure categories array exists
        if (!this.settings.categories) {
            this.settings.categories = Object.keys(this.settings.goals);
        }
        
        container.innerHTML = this.settings.categories.map(category => `
            <div class="flex items-center justify-between p-3 rounded-lg">
                <div class="flex items-center space-x-3">
                    <div class="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                        <span class="text-primary-600 font-medium text-xs">${category.charAt(0)}</span>
                    </div>
                    <span class="text-sm font-medium " style="color:var(--md-sys-color-on-surface)">${category}</span>
                </div>
                <div class="flex items-center space-x-2">
                    <button onclick="editCategory('${category}')" 
                            class="text-blue-500 hover:text-blue-700 p-1 hover:bg-blue-50 rounded">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                        </svg>
                    </button>
                    <button onclick="deleteCategory('${category}')" 
                            class="p-1 rounded" style="color:var(--md-sys-color-outline)">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `).join('');
    }

    updateCategoryDropdown() {
        const categorySelect = document.getElementById('category');
        if (!categorySelect) return;
        
        // Clear existing options except the default one
        categorySelect.innerHTML = '<option value="">Select a category</option>';
        
        // Add dynamic categories
        this.settings.categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            categorySelect.appendChild(option);
        });
    }

    addCategory() {
        const newCategoryInput = document.getElementById('new-category-name');
        const categoryName = newCategoryInput.value.trim();
        
        if (!categoryName) {
            showNotification('Please enter a category name', 'error');
            return;
        }
        
        // Check if category already exists (case-insensitive)
        const existingCategory = this.settings.categories.find(cat => 
            cat.toLowerCase() === categoryName.toLowerCase()
        );
        
        if (existingCategory) {
            showNotification('Category already exists!', 'error');
            return;
        }
        
        // Add to categories array
        this.settings.categories.push(categoryName);
        
        // Add to goals with default value
        this.settings.goals[categoryName] = 100;
        
        // Save settings
        localStorage.setItem('settings', JSON.stringify(this.settings));
        if (currentUser) {
            this.saveSettingsToFirebase();
        }
        
        // Update UI
        this.renderExistingCategories();
        this.renderCategoryGoalsSettings();
        this.updateCategoryDropdown();
        this.updateDashboard(); // Refresh dashboard to show new category
        
        // Clear input
        newCategoryInput.value = '';
        
        showNotification(`Category "${categoryName}" added successfully!`, 'success');
    }

    editCategory(oldCategoryName) {
        const newName = prompt('Enter new category name:', oldCategoryName);
        
        if (!newName || newName.trim() === '') {
            return;
        }
        
        const newCategoryName = newName.trim();
        
        // Check if new name already exists (case-insensitive)
        const existingCategory = this.settings.categories.find(cat => 
            cat.toLowerCase() === newCategoryName.toLowerCase() && cat !== oldCategoryName
        );
        
        if (existingCategory) {
            showNotification('Category name already exists!', 'error');
            return;
        }
        
        // Update categories array
        const categoryIndex = this.settings.categories.indexOf(oldCategoryName);
        if (categoryIndex !== -1) {
            this.settings.categories[categoryIndex] = newCategoryName;
        }
        
        // Update goals object
        if (this.settings.goals[oldCategoryName] !== undefined) {
            this.settings.goals[newCategoryName] = this.settings.goals[oldCategoryName];
            delete this.settings.goals[oldCategoryName];
        }
        
        // Update existing expenses with the new category name
        this.expenses.forEach(expense => {
            if (expense.category === oldCategoryName) {
                expense.category = newCategoryName;
            }
        });
        
        // Save data
        localStorage.setItem('settings', JSON.stringify(this.settings));
        localStorage.setItem('expenses', JSON.stringify(this.expenses));
        
        if (currentUser) {
            this.saveSettingsToFirebase();
            // Update all expenses in Firebase
            this.expenses.forEach(expense => {
                if (expense.category === newCategoryName) {
                    this.saveExpenseToFirebase(expense);
                }
            });
        }
        
        // Update UI
        this.renderExistingCategories();
        this.renderCategoryGoalsSettings();
        this.updateCategoryDropdown();
        this.updateDashboard();
        this.renderTransactions();
        
        showNotification(`Category renamed to "${newCategoryName}"!`, 'success');
    }

    deleteCategory(categoryName) {
        // Check if there are expenses using this category
        const expensesUsingCategory = this.expenses.filter(expense => expense.category === categoryName);
        
        let confirmMessage = `Are you sure you want to delete the "${categoryName}" category?`;
        if (expensesUsingCategory.length > 0) {
            confirmMessage += `\n\nThis will affect ${expensesUsingCategory.length} existing expense(s). They will be moved to "Other" category.`;
        }
        
        if (!confirm(confirmMessage)) {
            return;
        }
        
        // Remove from categories array
        this.settings.categories = this.settings.categories.filter(cat => cat !== categoryName);
        
        // Remove from goals
        delete this.settings.goals[categoryName];
        
        // Move existing expenses to "Other" category
        this.expenses.forEach(expense => {
            if (expense.category === categoryName) {
                expense.category = 'Other';
            }
        });
        
        // Ensure "Other" exists in categories and goals
        if (!this.settings.categories.includes('Other')) {
            this.settings.categories.push('Other');
            this.settings.goals['Other'] = 100;
        }
        
        // Save data
        localStorage.setItem('settings', JSON.stringify(this.settings));
        localStorage.setItem('expenses', JSON.stringify(this.expenses));
        
        if (currentUser) {
            this.saveSettingsToFirebase();
            // Update affected expenses in Firebase
            expensesUsingCategory.forEach(expense => {
                expense.category = 'Other';
                this.saveExpenseToFirebase(expense);
            });
        }
        
        // Update UI
        this.renderExistingCategories();
        this.renderCategoryGoalsSettings();
        this.updateCategoryDropdown();
        this.updateDashboard();
        this.renderTransactions();
        
        showNotification(`Category "${categoryName}" deleted successfully!`, 'success');
    }
}


// ====================================================================
// NEW: UNIFIED TRENDS TOGGLE
// ====================================================================

function switchTrendsView(view) {
    expenseTracker.currentTrendsView = view;
    const dailyBtn = document.getElementById('trends-daily-btn');
    const weeklyBtn = document.getElementById('trends-weekly-btn');
    if (view === 'daily') {
        dailyBtn.className = 'trends-toggle-btn active px-3 py-1 text-xs font-medium rounded-md';
        weeklyBtn.className = 'trends-toggle-btn px-3 py-1 text-xs font-medium rounded-md';
        expenseTracker.updateDailySpending('week');
    } else {
        weeklyBtn.className = 'trends-toggle-btn active px-3 py-1 text-xs font-medium rounded-md';
        dailyBtn.className = 'trends-toggle-btn px-3 py-1 text-xs font-medium rounded-md';
        expenseTracker.updateWeeklySpending('recent');
    }
}

// ====================================================================
// NEW: STREAK TRACKING SYSTEM
// ====================================================================

ExpenseTracker.prototype.renderStreaks = function() {
    const countEl = document.getElementById('streak-count');
    const labelEl = document.getElementById('streak-label');
    if (!countEl) return;

    const days = this.calculateFoodStreak();
    countEl.textContent = days;

    if (days === 0) {
        labelEl.textContent = 'You ate out today — streak reset';
    } else if (days === 1) {
        labelEl.textContent = '1 day without eating out';
    } else {
        labelEl.textContent = days + ' days without eating out';
    }
};

ExpenseTracker.prototype.calculateFoodStreak = function() {
    const today = new Date();
    let days = 0;
    for (let i = 0; i < 365; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(today.getDate() - i);
        const dateStr = this.getLocalDateString(checkDate);
        const ateOut = this.expenses.some(e =>
            e.category === 'Food' && this.getLocalDateString(this.parseLocalDate(e.date)) === dateStr
        );
        if (ateOut) break;
        days++;
    }
    return days;
};

// ====================================================================
// AI INSIGHTS
// ====================================================================

ExpenseTracker.prototype.buildSpendingSummary = function() {
    const now = new Date();
    const year = now.getFullYear(), month = now.getMonth();
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const thisMonth = this.expenses.filter(e => {
        const d = this.parseLocalDate(e.date);
        return d.getMonth() === month && d.getFullYear() === year;
    });

    // Last month same point
    const lastMonth = this.expenses.filter(e => {
        const d = this.parseLocalDate(e.date);
        return d.getMonth() === (month === 0 ? 11 : month - 1) &&
               d.getFullYear() === (month === 0 ? year - 1 : year) &&
               d.getDate() <= dayOfMonth;
    });

    const thisMonthTotal = thisMonth.reduce((s, e) => s + e.amount, 0);
    const lastMonthSamePoint = lastMonth.reduce((s, e) => s + e.amount, 0);
    const dailyAvg = dayOfMonth > 0 ? thisMonthTotal / dayOfMonth : 0;
    const projection = dailyAvg * daysInMonth;

    // Day of week breakdown
    const dayTotals = [0,0,0,0,0,0,0], dayCounts = [0,0,0,0,0,0,0];
    thisMonth.forEach(e => {
        const dow = this.parseLocalDate(e.date).getDay();
        dayTotals[dow] += e.amount;
        dayCounts[dow]++;
    });
    const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const dayAvgs = dayTotals.map((t, i) => ({ day: dayNames[i], avg: dayCounts[i] ? t / dayCounts[i] : 0 }));
    const topDay = dayAvgs.reduce((a, b) => b.avg > a.avg ? b : a);

    // Top categories
    const catTotals = {};
    thisMonth.forEach(e => { catTotals[e.category] = (catTotals[e.category] || 0) + e.amount; });
    const topCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]).slice(0, 3)
        .map(([name, amount]) => ({ name, amount: Math.round(amount) }));

    // This week vs last week
    const todayStart = new Date(year, month, dayOfMonth);
    const weekStart = new Date(todayStart); weekStart.setDate(todayStart.getDate() - todayStart.getDay());
    const lastWeekStart = new Date(weekStart); lastWeekStart.setDate(weekStart.getDate() - 7);
    const thisWeek = thisMonth.filter(e => this.parseLocalDate(e.date) >= weekStart).reduce((s, e) => s + e.amount, 0);
    const lastWeek = thisMonth.filter(e => { const d = this.parseLocalDate(e.date); return d >= lastWeekStart && d < weekStart; }).reduce((s, e) => s + e.amount, 0);

    const budget = this.settings.monthlyBudget || 0;
    const streak = this.calculateFoodStreak();

    return {
        thisMonthTotal: Math.round(thisMonthTotal),
        lastMonthSamePoint: Math.round(lastMonthSamePoint),
        dailyAvg: Math.round(dailyAvg),
        projection: Math.round(projection),
        dayOfMonth, daysInMonth,
        topSpendingDay: topDay.avg > 0 ? { day: topDay.day, avg: Math.round(topDay.avg) } : null,
        topCategories: topCats,
        thisWeek: Math.round(thisWeek),
        lastWeek: Math.round(lastWeek),
        budget,
        noEatOutStreak: streak,
        transactionCount: thisMonth.length
    };
};

ExpenseTracker.prototype.renderInsights = function() {
    const container = document.getElementById('insights-content');
    if (!container) return;
    if (this.expenses.length < 3) {
        container.innerHTML = '<p class="text-sm" style="color:var(--md-sys-color-outline)">Add a few more expenses to unlock insights</p>';
        return;
    }

    const summary = this.buildSpendingSummary();

    // Check cache — refresh once per day or when expense count changes
    const cacheKey = `insights_${summary.dayOfMonth}_${summary.transactionCount}`;
    if (this._insightsCache === cacheKey && this._insightsHtml) {
        container.innerHTML = this._insightsHtml;
        return;
    }

    // Try Gemini, fall back to templates
    const apiKey = localStorage.getItem('gemini_api_key') || '';
    const badge = document.getElementById('insights-badge');
    if (apiKey) {
        this.fetchGeminiInsights(summary, apiKey).then(insights => {
            this._insightsCache = cacheKey;
            this._insightsHtml = this.formatInsights(insights);
            container.innerHTML = this._insightsHtml;
            if (badge) { badge.textContent = 'AI'; badge.style.background = 'linear-gradient(135deg,rgba(102,126,234,0.15),rgba(118,75,162,0.15))'; badge.style.color = 'var(--md-sys-color-primary)'; }
        }).catch(() => {
            this._insightsCache = cacheKey;
            this._insightsHtml = this.formatInsights(this.templateInsights(summary));
            container.innerHTML = this._insightsHtml;
            if (badge) { badge.textContent = 'Local'; badge.style.background = 'rgba(255,255,255,0.06)'; badge.style.color = 'var(--md-sys-color-outline)'; }
        });
    } else {
        this._insightsCache = cacheKey;
        this._insightsHtml = this.formatInsights(this.templateInsights(summary));
        container.innerHTML = this._insightsHtml;
        if (badge) { badge.textContent = 'Local'; badge.style.background = 'rgba(255,255,255,0.06)'; badge.style.color = 'var(--md-sys-color-outline)'; }
    }
};

ExpenseTracker.prototype.fetchGeminiInsights = async function(summary, apiKey) {
    const prompt = `You're a supportive but honest personal spending coach. Based on this spending data, give exactly 3 short behavioral insights (1-2 sentences each). Be specific with dollar amounts. Focus on patterns the user can act on. No generic advice. No bullet points or numbering — just 3 separate observations.

Data:
- This month so far: $${summary.thisMonthTotal} over ${summary.dayOfMonth} days (${summary.transactionCount} transactions)
- Daily average: $${summary.dailyAvg}
- Projected month total: $${summary.projection}${summary.budget ? ` (budget: $${summary.budget})` : ''}
- Same point last month: $${summary.lastMonthSamePoint}
- This week: $${summary.thisWeek}, last week: $${summary.lastWeek}
- Top categories: ${summary.topCategories.map(c => c.name + ' $' + c.amount).join(', ')}
${summary.topSpendingDay ? `- Highest spending day: ${summary.topSpendingDay.day} (avg $${summary.topSpendingDay.avg})` : ''}
- Days without eating out: ${summary.noEatOutStreak}

Return ONLY a JSON array of 3 strings. Example: ["insight 1", "insight 2", "insight 3"]`;

    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 300 }
        })
    });

    if (!resp.ok) throw new Error('API error');
    const data = await resp.json();
    const text = data.candidates[0].content.parts[0].text.trim();
    const match = text.match(/\[[\s\S]*\]/);
    return match ? JSON.parse(match[0]) : this.templateInsights(summary);
};

ExpenseTracker.prototype.templateInsights = function(s) {
    const insights = [];

    // Projection vs budget
    if (s.budget && s.projection > 0) {
        const diff = s.projection - s.budget;
        insights.push(diff > 0
            ? `At your current pace, you'll hit $${s.projection} this month — about $${Math.abs(diff)} over budget. A few lighter days could close that gap.`
            : `You're on track to spend $${s.projection} this month — $${Math.abs(diff)} under budget. Whatever you're doing, keep it up.`);
    } else if (s.projection > 0) {
        insights.push(`At $${s.dailyAvg}/day, you're on track to spend $${s.projection} this month.`);
    }

    // vs last month
    if (s.lastMonthSamePoint > 0) {
        const pct = Math.round(((s.thisMonthTotal - s.lastMonthSamePoint) / s.lastMonthSamePoint) * 100);
        insights.push(pct > 5
            ? `You're spending ${pct}% more than this point last month. Might be worth checking where the extra is going.`
            : pct < -5
            ? `You're ${Math.abs(pct)}% under where you were last month at this point — real progress.`
            : `Spending is about the same as last month at this point.`);
    }

    // Top spending day
    if (s.topSpendingDay && s.topSpendingDay.avg > s.dailyAvg * 1.3) {
        insights.push(`${s.topSpendingDay.day}s are your biggest spending day — averaging $${s.topSpendingDay.avg}. Planning ahead for that day could save you.`);
    } else if (s.thisWeek > 0 && s.lastWeek > 0) {
        const diff = Math.round(((s.thisWeek - s.lastWeek) / s.lastWeek) * 100);
        insights.push(diff > 10
            ? `This week's spending ($${s.thisWeek}) is up ${diff}% from last week.`
            : diff < -10
            ? `This week you've spent $${s.thisWeek} — ${Math.abs(diff)}% less than last week. Nice restraint.`
            : `This week's spending is steady at $${s.thisWeek}.`);
    }

    return insights.slice(0, 3);
};

ExpenseTracker.prototype.formatInsights = function(insights) {
    const icons = ['trending_up', 'calendar_month', 'lightbulb'];
    return insights.map((text, i) => `
        <div class="flex gap-3 items-start">
            <div class="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style="background:rgba(102,126,234,0.1)">
                <span class="material-symbols-rounded" style="color:var(--md-sys-color-primary);font-size:16px">${icons[i] || 'insights'}</span>
            </div>
            <p class="text-sm leading-relaxed" style="color:var(--md-sys-color-on-surface-variant)">${text}</p>
        </div>
    `).join('');
};

// ====================================================================
// NEW: PIE CHART WITH CLICKABLE CATEGORIES
// ====================================================================

ExpenseTracker.prototype.renderPieChart = function(monthlyExpenses) {
    const svg = document.getElementById('category-pie-chart');
    const breakdown = document.getElementById('category-breakdown');
    if (!svg || !breakdown) return;

    const catTotals = {};
    monthlyExpenses.forEach(e => {
        catTotals[e.category] = (catTotals[e.category] || 0) + e.amount;
    });

    const total = Object.values(catTotals).reduce((s, a) => s + a, 0);
    if (total === 0) {
        svg.innerHTML = '';
        breakdown.innerHTML = '<p class="text-center text-sm py-4" style="color:var(--md-sys-color-outline)">No expenses this month</p>';
        return;
    }

    const data = Object.entries(catTotals)
        .map(([name, amount]) => ({ name, amount, pct: ((amount / total) * 100).toFixed(1) }))
        .sort((a, b) => b.amount - a.amount);

    const colors = ['#667eea', '#f093fb', '#43e97b', '#f5576c', '#4facfe', '#fccb90', '#a18cd1'];
    let angle = -90;
    let svgContent = '';

    data.forEach((cat, i) => {
        const sweep = (parseFloat(cat.pct) / 100) * 360;
        const endAngle = angle + sweep;
        const color = colors[i % colors.length];
        const largeArc = sweep > 180 ? 1 : 0;
        
        const r = 90, ir = 60, cx = 100, cy = 100;
        const toXY = (a, rad) => ({ x: cx + rad * Math.cos((a - 90) * Math.PI / 180), y: cy + rad * Math.sin((a - 90) * Math.PI / 180) });
        const s1 = toXY(endAngle, r), e1 = toXY(angle, r), s2 = toXY(endAngle, ir), e2 = toXY(angle, ir);
        
        const path = `M ${s1.x} ${s1.y} A ${r} ${r} 0 ${largeArc} 0 ${e1.x} ${e1.y} L ${e2.x} ${e2.y} A ${ir} ${ir} 0 ${largeArc} 1 ${s2.x} ${s2.y} Z`;
        svgContent += `<path d="${path}" fill="${color}" class="pie-segment" data-category="${cat.name}" onclick="openCategoryFilter('${cat.name}')" style="cursor:pointer"/>`;
        angle = endAngle;
    });

    svg.innerHTML = svgContent;

    breakdown.innerHTML = data.map((cat, i) => {
        const color = colors[i % colors.length];
        return `
            <div class="flex items-center justify-between py-2.5 px-3 rounded-xl cursor-pointer transition-colors" style="background:transparent" onmouseover="this.style.background='rgba(255,255,255,0.04)'" onmouseout="this.style.background='transparent'" onclick="openCategoryFilter('${cat.name}')">
                <div class="flex items-center space-x-3">
                    <div class="w-8 h-8 rounded-full flex items-center justify-center" style="background:${color}25">
                        <span style="color:${color};font-weight:600;font-size:11px">${cat.name.charAt(0)}</span>
                    </div>
                    <span class="text-sm font-medium" style="color:${color}">${cat.name}</span>
                </div>
                <div class="text-right flex items-center gap-2">
                    <span class="text-sm font-semibold" style="color:var(--md-sys-color-on-surface)">${formatCurrency(cat.amount)}</span>
                    <span class="text-xs px-1.5 py-0.5 rounded-full" style="background:rgba(255,255,255,0.06);color:var(--md-sys-color-outline)">${cat.pct}%</span>
                </div>
            </div>
        `;
    }).join('');
};

// ====================================================================
// NEW: CATEGORY FILTER MODAL
// ====================================================================

function openCategoryFilter(category) {
    const modal = document.getElementById('category-filter-modal');
    const title = document.getElementById('filter-modal-title');
    const summary = document.getElementById('filter-modal-summary');
    const container = document.getElementById('filter-modal-transactions');
    if (!modal || !container) return;

    title.textContent = category;

    const filtered = expenseTracker.expenses
        .filter(e => e.category === category)
        .sort((a, b) => expenseTracker.parseLocalDate(b.date) - expenseTracker.parseLocalDate(a.date));

    const total = filtered.reduce((s, e) => s + e.amount, 0);
    summary.textContent = `${filtered.length} transaction${filtered.length !== 1 ? 's' : ''} · ${formatCurrency(total)} total`;

    if (filtered.length === 0) {
        container.innerHTML = '<div class="py-8 text-center text-sm" style="color:var(--md-sys-color-outline)">No transactions</div>';
    } else {
        const grouped = expenseTracker.groupTransactionsByDate(filtered);
        container.innerHTML = grouped.map(g => `
            <div class="mb-3">
                <div class="flex justify-between items-center py-2 px-1">
                    <span class="text-xs font-medium" style="color:var(--md-sys-color-outline)">${g.dateLabel}</span>
                    <span class="text-xs font-medium" style="color:var(--md-sys-color-outline)">${formatCurrency(g.totalAmount)}</span>
                </div>
                ${g.transactions.map(e => `
                    <div class="flex justify-between items-center px-3 py-3 mb-1 rounded-xl" style="background:var(--md-sys-color-surface-container)">
                        <span class="text-sm" style="color:var(--md-sys-color-on-surface)">${e.description}</span>
                        <span class="text-sm font-semibold" style="color:var(--md-sys-color-on-surface)">${formatCurrency(e.amount)}</span>
                    </div>
                `).join('')}
            </div>
        `).join('');
    }

    modal.classList.remove('hidden');
}

function closeCategoryFilter() {
    document.getElementById('category-filter-modal')?.classList.add('hidden');
}

// ====================================================================
// NEW: FIXED EXPENSES TOGGLE
// ====================================================================

function toggleFixedExpenses() {
    const details = document.getElementById('fixed-expenses-details');
    const chevron = document.getElementById('fixed-chevron');
    if (!details) return;
    details.classList.toggle('hidden');
    if (chevron) chevron.style.transform = details.classList.contains('hidden') ? '' : 'rotate(180deg)';
}

// ====================================================================
// KEEP: Global function wrappers (updated)
// ====================================================================

function updateDailyView(period) {
    expenseTracker.updateDailySpending(period);
}

function updateWeeklyView(period) {
    expenseTracker.updateWeeklySpending(period);
}

// ====================================================================
// GLOBAL FUNCTIONS FOR HTML ONCLICK EVENTS
// ====================================================================

function showPage(pageId) {
    expenseTracker.showPage(pageId);
}

function clearForm() {
    expenseTracker.clearForm();
}

function exportCSV() {
    expenseTracker.exportCSV();
}

function saveSettings() {
    expenseTracker.saveSettings();
}

function updateHistoryView() {
    expenseTracker.updateHistoryView();
}

function togglePrivacyMode() {
    expenseTracker.togglePrivacyMode();
}

function addCategory() {
    expenseTracker.addCategory();
}

function editCategory(categoryName) {
    expenseTracker.editCategory(categoryName);
}

function deleteCategory(categoryName) {
    expenseTracker.deleteCategory(categoryName);
}

function updateDailyView(period) {
    expenseTracker.updateDailySpending(period);
}

function updateWeeklyView(period) {
    expenseTracker.updateWeeklySpending(period);
}

function closeEditModal() {
    expenseTracker.closeEditModal();
}

// ====================================================================
// APPLICATION INITIALIZATION
// ====================================================================

// Initialize the application
var expenseTracker = new ExpenseTracker();
window.expenseTracker = expenseTracker;

// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then((registration) => {
                console.log('SW registered: ', registration);
            })
            .catch((registrationError) => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}


// Enhanced Overview Page Functions
// (Removed - merged into Home page)

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
            btn.classList.remove('text-primary-600', 'border-b-2', 'border-primary-600');
            btn.classList.add('text-gray-500', 'hover:text-gray-700');
        });
        
        // Highlight active nav button
        const activeBtn = document.querySelector(`[onclick="showPage('${pageId}')"]`);
        if (activeBtn) {
            activeBtn.classList.remove('text-gray-500', 'hover:text-gray-700');
            activeBtn.classList.add('text-primary-600', 'border-b-2', 'border-primary-600');
        }
        
        this.currentPage = pageId;
        
        // Update Glass UI pages when they're shown
        if (pageId === 'glass-home') {
            this.updateGlassHomePage();
        } else if (pageId === 'glass-overview') {
            this.updateGlassOverviewPage();
        }
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
        const expenseDate = new Date(selectedDate + 'T00:00:00');
        
        const expense = {
            id: Date.now(),
            amount: amount,
            description: description,
            category: category,
            date: expenseDate.toISOString(),
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
        const expenseDate = new Date(expense.date);
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
        const expenseDate = new Date(selectedDate + 'T00:00:00');
        const updatedExpense = {
            ...this.expenses[expenseIndex], // Keep original id and timestamp
            amount: amount,
            description: description,
            category: category,
            date: expenseDate.toISOString()
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
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        
        // Filter expenses for current month
        const monthlyExpenses = this.expenses.filter(expense => {
            const expenseDate = new Date(expense.date);
            return expenseDate.getMonth() === currentMonth && expenseDate.getFullYear() === currentYear;
        });

        // Calculate totals
        const totalVariableExpenses = monthlyExpenses.reduce((sum, expense) => sum + expense.amount, 0);
        const totalFixedExpenses = this.settings.rent + this.settings.utilities + this.settings.insurance;
        const totalExpenses = totalVariableExpenses + totalFixedExpenses;
        const totalSavings = this.settings.income - totalExpenses;
        const budgetLeft = getTotalBudget(this.settings.goals) - totalVariableExpenses;

        // Update summary cards
        document.getElementById('total-income').textContent = formatCurrency(this.settings.income);
        document.getElementById('total-expenses').textContent = formatCurrency(totalExpenses);
        document.getElementById('variable-expenses-only').textContent = formatCurrency(totalVariableExpenses);
        document.getElementById('total-savings').textContent = formatCurrency(totalSavings);
        document.getElementById('budget-left').textContent = formatCurrency(budgetLeft);

        // Update fixed expenses
        document.getElementById('rent-amount').textContent = formatCurrency(this.settings.rent);
        document.getElementById('utilities-amount').textContent = formatCurrency(this.settings.utilities);
        document.getElementById('insurance-amount').textContent = formatCurrency(this.settings.insurance);
        document.getElementById('total-fixed').textContent = formatCurrency(totalFixedExpenses);

        // Update variable expenses by category
        this.updateVariableExpenses(monthlyExpenses);
        document.getElementById('total-variable').textContent = formatCurrency(totalVariableExpenses);

        // Update daily spending view
        this.updateDailySpending('week');

        // Update weekly spending view
        this.updateWeeklySpending('recent');

        // Update recent transactions
        this.updateRecentTransactions();
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
                        <span class="text-gray-600">${category}</span>
                        <span class="font-medium">${formatCurrency(spent)}/${formatCurrency(goal)}</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2 mt-1">
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
                <div class="text-gray-500 text-center py-8">
                    No transactions yet. <button onclick="expenseTracker.showPage('add-expense')" class="text-primary-600 hover:text-primary-700">Add your first expense</button>
                </div>
            `;
            return;
        }

        container.innerHTML = recentExpenses.map(expense => `
            <div class="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg">
                <div class="flex items-center space-x-3">
                    <div class="w-2 h-2 bg-primary-500 rounded-full"></div>
                    <div>
                        <p class="font-medium text-gray-900">${expense.description}</p>
                        <p class="text-sm text-gray-500">${expense.category} • ${formatDate(expense.date)}</p>
                    </div>
                </div>
                <span class="font-semibold text-red-600">-${formatCurrency(expense.amount)}</span>
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
                <div class="p-8 text-center text-gray-500">
                    No transactions yet. <button onclick="expenseTracker.showPage('add-expense')" class="text-primary-600 hover:text-primary-700">Add your first expense</button>
                </div>
            `;
            return;
        }

        // Group transactions by date
        const groupedByDate = this.groupTransactionsByDate(sortedExpenses);
        
        // Render grouped transactions
        container.innerHTML = groupedByDate.map(dateGroup => {
            const transactionsHtml = dateGroup.transactions.map(expense => `
                <div class="flex items-center justify-between p-4 hover:bg-gray-50 border-l-2 border-transparent hover:border-l-primary-200">
                    <div class="flex items-center space-x-4">
                        <div class="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                            <span class="text-primary-600 font-medium text-sm">${expense.category.charAt(0)}</span>
                        </div>
                        <div>
                            <p class="font-medium text-gray-900">${expense.description}</p>
                            <p class="text-sm text-gray-500">${expense.category}</p>
                        </div>
                    </div>
                    <div class="flex items-center space-x-3">
                        <span class="font-semibold text-red-600">-${formatCurrency(expense.amount)}</span>
                        <button onclick="expenseTracker.editExpense(${expense.id})" 
                                class="text-blue-500 hover:text-blue-700 p-1 hover:bg-blue-50 rounded">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                            </svg>
                        </button>
                        <button onclick="expenseTracker.deleteExpense(${expense.id})" 
                                class="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            `).join('');

            return `
                <div class="mb-6">
                    <!-- Date Header -->
                    <div class="sticky top-16 bg-gray-100 px-4 py-3 border-b border-gray-200 z-10">
                        <div class="flex justify-between items-center">
                            <div>
                                <h3 class="font-semibold text-gray-900 text-sm">${dateGroup.dateLabel}</h3>
                                <p class="text-xs text-gray-500">${dateGroup.transactions.length} transaction${dateGroup.transactions.length !== 1 ? 's' : ''}</p>
                            </div>
                            <div class="text-right">
                                <p class="font-semibold text-red-600">-${formatCurrency(dateGroup.totalAmount)}</p>
                                <p class="text-xs text-gray-500">Total for day</p>
                            </div>
                        </div>
                    </div>
                    <!-- Transactions for this date -->
                    <div class="divide-y divide-gray-100">
                        ${transactionsHtml}
                    </div>
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
            const expenseDate = new Date(expense.date);
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
                <label class="block text-sm font-medium text-gray-700 mb-2">${category} Goal</label>
                <div class="relative">
                    <span class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                    <input type="number" id="goal-${category.toLowerCase()}" step="0.01" placeholder="0.00" 
                           value="${this.settings.goals[category]}"
                           class="pl-8 block w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500">
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
            const expenseDate = new Date(expense.date);
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
            container.innerHTML = '<div class="text-gray-500 text-center py-8">No expenses found for selected month</div>';
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
                            <span class="text-gray-600">${category}</span>
                            <span class="font-medium">${formatCurrency(spent)}/${formatCurrency(goal)}</span>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-2 mt-1">
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
            container.innerHTML = '<div class="text-gray-500 text-center py-8">This is the current month</div>';
            return;
        }

        const selectedMonthName = getMonthName(selectedMonth);
        const currentMonthName = getMonthName(currentMonth);

        const variableDiff = currentData.totals.variableExpenses - historicalData.totals.variableExpenses;
        const totalDiff = currentData.totals.totalExpenses - historicalData.totals.totalExpenses;
        const savingsDiff = currentData.totals.savings - historicalData.totals.savings;

        container.innerHTML = `
            <div class="space-y-4">
                <div class="flex justify-between items-center py-2 border-b border-gray-100">
                    <span class="text-gray-600">Variable Expenses</span>
                    <div class="text-right">
                        <div class="font-medium">${formatCurrency(Math.abs(variableDiff))}</div>
                        <div class="text-sm ${variableDiff > 0 ? 'text-red-500' : 'text-green-500'}">
                            ${variableDiff > 0 ? 'More' : 'Less'} than ${selectedMonthName}
                        </div>
                    </div>
                </div>
                <div class="flex justify-between items-center py-2 border-b border-gray-100">
                    <span class="text-gray-600">Total Expenses</span>
                    <div class="text-right">
                        <div class="font-medium">${formatCurrency(Math.abs(totalDiff))}</div>
                        <div class="text-sm ${totalDiff > 0 ? 'text-red-500' : 'text-green-500'}">
                            ${totalDiff > 0 ? 'More' : 'Less'} than ${selectedMonthName}
                        </div>
                    </div>
                </div>
                <div class="flex justify-between items-center py-2">
                    <span class="text-gray-600">Savings</span>
                    <div class="text-right">
                        <div class="font-medium">${formatCurrency(Math.abs(savingsDiff))}</div>
                        <div class="text-sm ${savingsDiff > 0 ? 'text-green-500' : 'text-red-500'}">
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
            container.innerHTML = '<div class="p-8 text-center text-gray-500">No transactions found for selected month</div>';
            return;
        }

        const selectedMonthName = getMonthName(selectedMonth);
        const sortedExpenses = [...expenses].sort((a, b) => b.timestamp - a.timestamp);

        container.innerHTML = `
            <div class="p-4 bg-gray-50 border-b">
                <h4 class="font-medium text-gray-900">${selectedMonthName} ${selectedYear} - ${expenses.length} transactions</h4>
            </div>
            ${sortedExpenses.map(expense => `
                <div class="flex items-center justify-between p-4 hover:bg-gray-50">
                    <div class="flex items-center space-x-4">
                        <div class="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                            <span class="text-primary-600 font-medium text-sm">${expense.category.charAt(0)}</span>
                        </div>
                        <div>
                            <p class="font-medium text-gray-900">${expense.description}</p>
                            <p class="text-sm text-gray-500">${expense.category} • ${formatDate(expense.date)}</p>
                        </div>
                    </div>
                    <span class="font-semibold text-red-600">-${formatCurrency(expense.amount)}</span>
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
        const privacyText = '••••••';
        const isPrivate = this.settings.privacyMode;
        
        // Elements to hide/show based on privacy mode
        const sensitiveElements = [
            'total-income',
            'total-savings',
            'history-income', 
            'history-savings'
        ];
        
        sensitiveElements.forEach(elementId => {
            const element = document.getElementById(elementId);
            if (element) {
                if (isPrivate && !element.textContent.includes('••••••')) {
                    element.setAttribute('data-original', element.textContent);
                    element.textContent = privacyText;
                } else if (!isPrivate && element.hasAttribute('data-original')) {
                    element.textContent = element.getAttribute('data-original');
                    element.removeAttribute('data-original');
                }
            }
        });
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
        const container = document.getElementById('daily-spending-content');
        const averageElement = document.getElementById('daily-average');
        
        if (!container || !averageElement) return;

        // Update button states
        const weekBtn = document.getElementById('week-btn');
        const monthBtn = document.getElementById('month-btn');
        
        if (weekBtn && monthBtn) {
            if (period === 'week') {
                weekBtn.className = 'px-3 py-1 text-sm bg-primary-100 text-primary-700 rounded-lg font-medium';
                monthBtn.className = 'px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded-lg';
            } else {
                weekBtn.className = 'px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded-lg';
                monthBtn.className = 'px-3 py-1 text-sm bg-primary-100 text-primary-700 rounded-lg font-medium';
            }
        }

        const dailyData = this.getDailySpendingData(period);
        
        if (dailyData.days.length === 0) {
            container.innerHTML = '<div class="text-gray-500 text-center py-8">No expenses found for this period</div>';
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
                <div class="flex items-center justify-between py-3 px-2 hover:bg-gray-50 rounded-lg">
                    <div class="flex items-center space-x-3">
                        <div class="text-sm font-medium text-gray-900 w-20">${day.dayName}</div>
                        <div class="flex-1">
                            <div class="text-xs text-gray-500 mb-1">${day.transactionCount} transaction${day.transactionCount !== 1 ? 's' : ''}</div>
                            <div class="w-full bg-gray-200 rounded-full h-2">
                                <div class="bg-primary-500 h-2 rounded-full transition-all duration-300" style="width: ${percentage}%"></div>
                            </div>
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="font-semibold text-gray-900">${formatCurrency(day.amount)}</div>
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
            const expenseDate = this.getLocalDateString(new Date(expense.date));
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
        const container = document.getElementById('weekly-spending-content');
        const averageElement = document.getElementById('weekly-average');
        
        if (!container || !averageElement) return;

        // Update button states
        const recentBtn = document.getElementById('recent-weeks-btn');
        const monthlyBtn = document.getElementById('monthly-weeks-btn');
        
        if (recentBtn && monthlyBtn) {
            if (period === 'recent') {
                recentBtn.className = 'px-3 py-1 text-sm bg-primary-100 text-primary-700 rounded-lg font-medium';
                monthlyBtn.className = 'px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded-lg';
            } else {
                recentBtn.className = 'px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded-lg';
                monthlyBtn.className = 'px-3 py-1 text-sm bg-primary-100 text-primary-700 rounded-lg font-medium';
            }
        }

        const weeklyData = this.getWeeklySpendingData(period);
        
        if (weeklyData.weeks.length === 0) {
            container.innerHTML = '<div class="text-gray-500 text-center py-8">No weekly data available</div>';
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
                <div class="flex items-center justify-between py-3 px-2 hover:bg-gray-50 rounded-lg">
                    <div class="flex items-center space-x-3">
                        <div class="text-sm font-medium text-gray-900 w-32">${week.weekName}</div>
                        <div class="flex-1">
                            <div class="text-xs text-gray-500 mb-1">${week.transactionCount} transaction${week.transactionCount !== 1 ? 's' : ''}</div>
                            <div class="w-full bg-gray-200 rounded-full h-2">
                                <div class="bg-green-500 h-2 rounded-full transition-all duration-300" style="width: ${percentage}%"></div>
                            </div>
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="font-semibold text-gray-900">${formatCurrency(week.amount)}</div>
                        ${week.isCurrentWeek ? '<div class="text-xs text-green-600">Current</div>' : ''}
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
            const expenseDate = new Date(expense.date).toISOString().split('T')[0];
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
            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div class="flex items-center space-x-3">
                    <div class="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                        <span class="text-primary-600 font-medium text-xs">${category.charAt(0)}</span>
                    </div>
                    <span class="text-sm font-medium text-gray-900">${category}</span>
                </div>
                <div class="flex items-center space-x-2">
                    <button onclick="editCategory('${category}')" 
                            class="text-blue-500 hover:text-blue-700 p-1 hover:bg-blue-50 rounded">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                        </svg>
                    </button>
                    <button onclick="deleteCategory('${category}')" 
                            class="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded">
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

    // ====================================================================
    // GLASS UI PAGE UPDATES
    // ====================================================================

    updateGlassHomePage() {
        // Update greeting based on time
        const now = new Date();
        const hour = now.getHours();
        let greeting = 'Good morning';
        if (hour >= 12 && hour < 17) {
            greeting = 'Good afternoon';
        } else if (hour >= 17) {
            greeting = 'Good evening';
        }
        
        const greetingElement = document.getElementById('glass-greeting');
        if (greetingElement) {
            greetingElement.textContent = `${greeting}, User`;
        }

        // Update date
        const dateElement = document.getElementById('glass-date');
        if (dateElement) {
            dateElement.textContent = now.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric'
            });
        }

        // Calculate current month data
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        const monthlyExpenses = this.expenses.filter(expense => {
            const expenseDate = new Date(expense.date);
            return expenseDate.getMonth() === currentMonth && expenseDate.getFullYear() === currentYear;
        });

        const totalVariableExpenses = monthlyExpenses.reduce((sum, expense) => sum + expense.amount, 0);
        const totalBudget = getTotalBudget(this.settings.goals);
        const percentage = totalBudget > 0 ? Math.min((totalVariableExpenses / totalBudget) * 100, 100) : 0;

        // Update spending gauge with proper calculation
        const gaugeProgress = document.getElementById('glass-gauge-progress');
        const amountSpent = document.getElementById('glass-amount-spent');
        const amountTotal = document.getElementById('glass-amount-total');
        const percentageElement = document.getElementById('glass-percentage');
        const statusElement = document.getElementById('glass-status');

        if (gaugeProgress) {
            // Ensure we have clean percentage values
            const cleanPercentage = Math.max(0, Math.min(percentage, 100));
            const remaining = Math.max(0, 100 - cleanPercentage);
            
            // Update the stroke-dasharray for pathLength="100" SVG
            gaugeProgress.style.strokeDasharray = `${cleanPercentage} ${remaining}`;
            
            // Add smooth transition
            gaugeProgress.style.transition = 'stroke-dasharray 0.6s ease-in-out';
        }
        
        if (amountSpent) {
            amountSpent.textContent = formatCurrency(totalVariableExpenses);
        }
        if (amountTotal) {
            amountTotal.textContent = `of ${formatCurrency(totalBudget)}`;
        }
        if (percentageElement) {
            percentageElement.textContent = `${Math.round(percentage)}%`;
        }
        if (statusElement) {
            const statusSpan = statusElement.querySelector('span');
            if (statusSpan) {
                if (percentage < 50) {
                    statusElement.className = 'status-indicator good';
                    statusSpan.textContent = 'On track for month';
                } else if (percentage < 80) {
                    statusElement.className = 'status-indicator warning';
                    statusSpan.textContent = 'Approaching limit';
                } else {
                    statusElement.className = 'status-indicator danger';
                    statusSpan.textContent = 'Over budget';
                }
            }
        }

        // Update this week data
        const weekData = this.getGlassWeeklyData();
        const weekAmountElement = document.getElementById('glass-week-amount');
        const weekComparisonElement = document.getElementById('glass-week-comparison');

        if (weekAmountElement) {
            weekAmountElement.textContent = formatCurrency(weekData.thisWeek);
        }
        if (weekComparisonElement) {
            const diff = weekData.thisWeek - weekData.lastWeek;
            const changePercentage = weekData.lastWeek > 0 ? ((diff / weekData.lastWeek) * 100) : 0;
            weekComparisonElement.textContent = `vs ${formatCurrency(weekData.lastWeek)} last week`;
        }

        // Update recent transactions
        this.updateGlassRecentTransactions();
    }

    updateGlassOverviewPage() {
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        const monthlyExpenses = this.expenses.filter(expense => {
            const expenseDate = new Date(expense.date);
            return expenseDate.getMonth() === currentMonth && expenseDate.getFullYear() === currentYear;
        });

        const totalVariableExpenses = monthlyExpenses.reduce((sum, expense) => sum + expense.amount, 0);
        const totalFixedExpenses = this.settings.rent + this.settings.utilities + this.settings.insurance;
        const totalExpenses = totalVariableExpenses + totalFixedExpenses;
        const totalSavings = this.settings.income - totalExpenses;
        const budgetLeft = getTotalBudget(this.settings.goals) - totalVariableExpenses;

        // Update overview summary cards
        this.updateGlassOverviewCard('glass-overview-income', this.settings.income);
        this.updateGlassOverviewCard('glass-overview-expenses', totalExpenses);
        this.updateGlassOverviewCard('glass-overview-savings', totalSavings);
        this.updateGlassOverviewCard('glass-overview-budget', budgetLeft);

        // Update category breakdown
        this.updateGlassCategoryBreakdown(monthlyExpenses);

        // Update daily average
        const dailyAverage = totalVariableExpenses / new Date().getDate();
        const dailyAverageElement = document.getElementById('glass-daily-average');
        if (dailyAverageElement) {
            dailyAverageElement.textContent = formatCurrency(dailyAverage);
        }

        // Update weekly amount
        const weekData = this.getGlassWeeklyData();
        const weeklyAmountElement = document.getElementById('glass-weekly-amount');
        if (weeklyAmountElement) {
            weeklyAmountElement.textContent = formatCurrency(weekData.thisWeek);
        }

        // Update 3-month trend chart
        this.updateGlass3MonthChart();
    }

    updateGlassOverviewCard(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = formatCurrency(value);
        }
    }

    updateGlassCategoryBreakdown(monthlyExpenses) {
        const expensesByCategory = {};
        monthlyExpenses.forEach(expense => {
            if (!expensesByCategory[expense.category]) {
                expensesByCategory[expense.category] = 0;
            }
            expensesByCategory[expense.category] += expense.amount;
        });

        const container = document.getElementById('glass-category-breakdown');
        if (!container) return;

        // Update existing category items
        const categoryItems = container.querySelectorAll('.category-item');
        categoryItems.forEach(item => {
            const nameElement = item.querySelector('.category-name');
            const progressBar = item.querySelector('.progress-fill');
            const spentElement = item.querySelector('.spent-amount');
            const budgetElement = item.querySelector('.budget-amount');

            if (nameElement) {
                const categoryName = nameElement.textContent.trim();
                const spent = expensesByCategory[categoryName] || 0;
                const budget = this.settings.goals[categoryName] || 0;
                const percentage = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;

                if (progressBar) {
                    // Animate the progress bar
                    setTimeout(() => {
                        progressBar.style.width = `${percentage}%`;
                    }, 100);
                }
                if (spentElement) {
                    spentElement.textContent = formatCurrency(spent);
                }
                if (budgetElement) {
                    budgetElement.textContent = `of ${formatCurrency(budget)}`;
                }
            }
        });
    }

    updateGlass3MonthChart() {
        const now = new Date();
        const months = [];
        
        // Get last 3 months including current
        for (let i = 2; i >= 0; i--) {
            const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
            months.push(month);
        }

        const chartBars = document.querySelectorAll('.expense-bar');
        const chartAmounts = document.querySelectorAll('.month-amount');
        
        let maxAmount = 0;
        const monthlyTotals = months.map(month => {
            const monthExpenses = this.expenses.filter(expense => {
                const expenseDate = new Date(expense.date);
                return expenseDate.getMonth() === month.getMonth() && 
                       expenseDate.getFullYear() === month.getFullYear();
            });
            const total = monthExpenses.reduce((sum, expense) => sum + expense.amount, 0);
            maxAmount = Math.max(maxAmount, total);
            return total;
        });

        // Update chart bars with animation
        chartBars.forEach((bar, index) => {
            if (index < monthlyTotals.length) {
                const percentage = maxAmount > 0 ? (monthlyTotals[index] / maxAmount) * 100 : 0;
                setTimeout(() => {
                    bar.style.height = `${percentage}%`;
                }, index * 200);
            }
        });

        // Update amounts
        chartAmounts.forEach((amount, index) => {
            if (index < monthlyTotals.length) {
                amount.textContent = formatCurrency(monthlyTotals[index]);
            }
        });
    }

    getGlassWeeklyData() {
        const today = new Date();
        const thisWeekStart = new Date(today);
        thisWeekStart.setDate(today.getDate() - today.getDay());
        const thisWeekEnd = new Date(thisWeekStart);
        thisWeekEnd.setDate(thisWeekStart.getDate() + 6);

        const lastWeekStart = new Date(thisWeekStart);
        lastWeekStart.setDate(thisWeekStart.getDate() - 7);
        const lastWeekEnd = new Date(lastWeekStart);
        lastWeekEnd.setDate(lastWeekStart.getDate() + 6);

        const thisWeekExpenses = this.expenses.filter(expense => {
            const expenseDate = new Date(expense.date);
            return expenseDate >= thisWeekStart && expenseDate <= thisWeekEnd;
        });

        const lastWeekExpenses = this.expenses.filter(expense => {
            const expenseDate = new Date(expense.date);
            return expenseDate >= lastWeekStart && expenseDate <= lastWeekEnd;
        });

        return {
            thisWeek: thisWeekExpenses.reduce((sum, expense) => sum + expense.amount, 0),
            lastWeek: lastWeekExpenses.reduce((sum, expense) => sum + expense.amount, 0)
        };
    }

    updateGlassRecentTransactions() {
        const container = document.getElementById('glass-recent-transactions');
        if (!container) return;

        const recentExpenses = [...this.expenses]
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 4);

        if (recentExpenses.length === 0) {
            container.innerHTML = `
                <div class="text-white/50 text-center py-4">
                    No transactions yet
                </div>
            `;
            return;
        }

        // Define category emojis
        const categoryEmojis = {
            'Food': '🍽️',
            'Transportation': '🚗',
            'Entertainment': '🎬',
            'Coffee': '☕',
            'Shopping': '🛒',
            'Bills': '💳',
            'Other': '📝'
        };

        container.innerHTML = recentExpenses.map(expense => {
            const emoji = categoryEmojis[expense.category] || '📝';
            const timeAgo = this.getTimeAgo(expense.timestamp);
            
            return `
                <div class="flex items-center justify-between p-3 hover:bg-white/5 rounded-lg transition-colors">
                    <div class="flex items-center space-x-3">
                        <div class="text-lg">${emoji}</div>
                        <div>
                            <div class="text-white font-medium">${expense.description}</div>
                            <div class="text-white/60 text-sm">${timeAgo}</div>
                        </div>
                    </div>
                    <div class="text-red-400 font-semibold">-${formatCurrency(expense.amount)}</div>
                </div>
            `;
        }).join('');
    }

    getTimeAgo(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / (1000 * 60));
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (minutes < 60) {
            return minutes <= 1 ? 'Just now' : `${minutes} minutes ago`;
        } else if (hours < 24) {
            return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
        } else if (days === 1) {
            return 'Yesterday';
        } else {
            return `${days} days ago`;
        }
    }
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
const expenseTracker = new ExpenseTracker();

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

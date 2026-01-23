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
        
        // Initialize Overview components if navigating to overview page
        if (pageId === 'overview') {
            setTimeout(() => {
                // Check saved tab preference
                const savedTab = localStorage.getItem('activeOverviewTab') || 'overview';
                
                if (savedTab === 'overview') {
                    if (typeof initializeOverviewComponents === 'function') {
                        initializeOverviewComponents();
                    }
                } else if (savedTab === 'analysis') {
                    // Initialize analysis tab and set it as active
                    if (typeof initializeAnalysisTab === 'function') {
                        // Set analysis tab as active
                        const overviewBtn = document.getElementById('overview-tab-btn');
                        const analysisBtn = document.getElementById('analysis-tab-btn');
                        const overviewTab = document.getElementById('overview-data-tab');
                        const analysisTab = document.getElementById('analysis-data-tab');
                        
                        if (overviewBtn && analysisBtn && overviewTab && analysisTab) {
                            overviewBtn.classList.remove('active');
                            analysisBtn.classList.add('active');
                            overviewTab.classList.add('hidden');
                            analysisTab.classList.remove('hidden');
                        }
                        
                        initializeAnalysisTab();
                    }
                }
            }, 100);
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

        // updateRecentTransactions method removed as the element was removed from the dashboard
        
        // Update Overview components if on overview page
        if (this.currentPage === 'overview' && typeof initializeOverviewComponents === 'function') {
            setTimeout(() => {
                initializeOverviewComponents();
            }, 100);
        }
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

    // updateRecentTransactions method removed as the recent-transactions element was removed from the dashboard

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
window.expenseTracker = expenseTracker; // Expose to window for smart-input.js

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
function switchOverviewTab(tabName) {
    // Get elements
    const overviewBtn = document.getElementById('overview-tab-btn');
    const analysisBtn = document.getElementById('analysis-tab-btn');
    const overviewTab = document.getElementById('overview-data-tab');
    const analysisTab = document.getElementById('analysis-data-tab');
    
    // Determine which tab is currently active
    const currentTab = overviewTab.classList.contains('hidden') ? analysisTab : overviewTab;
    const targetTab = tabName === 'overview' ? overviewTab : analysisTab;
    
    // If clicking the same tab, do nothing
    if (currentTab === targetTab) {
        return;
    }
    
    // Step 1: Fade out current tab
    currentTab.classList.add('fade-out');
    
    // Step 2: After fade-out completes, switch tabs
    setTimeout(() => {
        // Update button states
        if (tabName === 'overview') {
            overviewBtn.classList.add('active');
            analysisBtn.classList.remove('active');
            
            // Hide current, show target
            analysisTab.classList.add('hidden');
            analysisTab.classList.remove('fade-out');
            overviewTab.classList.remove('hidden');
        } else if (tabName === 'analysis') {
            analysisBtn.classList.add('active');
            overviewBtn.classList.remove('active');
            
            // Hide current, show target
            overviewTab.classList.add('hidden');
            overviewTab.classList.remove('fade-out');
            analysisTab.classList.remove('hidden');
        }
        
        // Step 3: Fade in new tab
        targetTab.classList.add('fade-in');
        
        // Clean up fade-in class after animation
        setTimeout(() => {
            targetTab.classList.remove('fade-in');
        }, 300);
    }, 300); // Match CSS transition duration
    
    // Save tab preference
    localStorage.setItem('activeOverviewTab', tabName);
    
    // Initialize components based on which tab is being shown
    if (tabName === 'overview' && window.expenseTracker) {
        setTimeout(() => {
            initializeOverviewComponents();
        }, 350);
    } else if (tabName === 'analysis' && window.expenseTracker && typeof initializeAnalysisTab === 'function') {
        setTimeout(() => {
            initializeAnalysisTab();
        }, 350);
    }
}

// ====================================================================
// OVERVIEW TAB COMPONENTS
// ====================================================================

let currentTimePeriod = '1M';
let lineGraphData = [];

function initializeOverviewComponents() {
    // Initialize all Overview tab components
    setupTimePeriodSelector();
    renderLineGraph();
    renderHealthGauge();
    renderHeatmap();
    renderPieChart();
}

// ====================================================================
// 1. ROBINHOOD-STYLE LINE GRAPH (Tasks 2.1-2.8)
// ====================================================================

function setupTimePeriodSelector() {
    const buttons = document.querySelectorAll('.time-period-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active state
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Update period and re-render
            currentTimePeriod = btn.dataset.period;
            renderLineGraph();
        });
    });
}

function getLineGraphData(period) {
    if (!window.expenseTracker) return [];
    
    const now = new Date();
    const cutoffDate = getDateCutoff(now, period);
    
    // Filter expenses by date
    const filteredExpenses = window.expenseTracker.expenses.filter(expense => {
        const expenseDate = new Date(expense.date);
        return expenseDate >= cutoffDate;
    });
    
    // Group by date and calculate daily totals
    const dailyTotals = {};
    filteredExpenses.forEach(expense => {
        const dateStr = new Date(expense.date).toISOString().split('T')[0];
        if (!dailyTotals[dateStr]) {
            dailyTotals[dateStr] = 0;
        }
        dailyTotals[dateStr] += expense.amount;
    });
    
    // Convert to array and sort by date
    const dataPoints = Object.keys(dailyTotals)
        .map(date => ({
            date: new Date(date),
            amount: dailyTotals[date]
        }))
        .sort((a, b) => a.date - b.date);
    
    return dataPoints;
}

function getDateCutoff(now, period) {
    const cutoffs = {
        '1W': new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        '1M': new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()),
        '3M': new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()),
        '6M': new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()),
        '1Y': new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()),
        'ALL': new Date(0)
    };
    return cutoffs[period] || cutoffs['1M'];
}

function renderLineGraph() {
    const svg = document.getElementById('spending-line-graph');
    if (!svg) return;
    
    const data = getLineGraphData(currentTimePeriod);
    lineGraphData = data;
    
    if (data.length === 0) {
        svg.innerHTML = '<text x="50%" y="50%" text-anchor="middle" fill="#9ca3af" font-size="14">No data for this period</text>';
        document.getElementById('graph-current').textContent = '$0';
        document.getElementById('graph-average').textContent = '$0';
        return;
    }
    
    // Calculate dimensions
    const padding = 40;
    const width = svg.clientWidth || 400;
    const height = svg.clientHeight || 250;
    const graphWidth = width - padding * 2;
    const graphHeight = height - padding * 2;
    
    // Find min/max values
    const amounts = data.map(d => d.amount);
    const maxAmount = Math.max(...amounts);
    const minAmount = Math.min(...amounts, 0);
    const range = maxAmount - minAmount || 1;
    
    // Create scales
    const xScale = (index) => padding + (index / (data.length - 1 || 1)) * graphWidth;
    const yScale = (amount) => padding + graphHeight - ((amount - minAmount) / range) * graphHeight;
    
    // Create line path
    const linePath = data.map((d, i) => {
        const x = xScale(i);
        const y = yScale(d.amount);
        return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
    }).join(' ');
    
    // Create area path
    const areaPath = linePath + 
        ` L ${xScale(data.length - 1)} ${padding + graphHeight}` +
        ` L ${xScale(0)} ${padding + graphHeight} Z`;
    
    // Build SVG content
    let svgContent = `
        <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#007AFF"/>
                <stop offset="100%" stop-color="#34C759"/>
            </linearGradient>
            <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#007AFF" stop-opacity="0.3"/>
                <stop offset="100%" stop-color="#007AFF" stop-opacity="0.05"/>
            </linearGradient>
        </defs>
        
        <!-- Area fill -->
        <path d="${areaPath}" class="graph-area"/>
        
        <!-- Line -->
        <path d="${linePath}" class="graph-line" stroke-dasharray="1000" stroke-dashoffset="1000"/>
        
        <!-- Points -->
    `;
    
    data.forEach((d, i) => {
        const x = xScale(i);
        const y = yScale(d.amount);
        svgContent += `<circle cx="${x}" cy="${y}" r="4" class="graph-point" 
                        data-amount="${d.amount}" data-date="${d.date.toLocaleDateString()}"
                        style="animation-delay: ${i * 0.05}s"/>`;
    });
    
    svg.innerHTML = svgContent;
    
    // Animate line drawing
    const line = svg.querySelector('.graph-line');
    if (line) {
        setTimeout(() => {
            line.style.strokeDashoffset = '0';
            line.style.transition = 'stroke-dashoffset 1s ease-out';
        }, 100);
    }
    
    // Add tooltip interactions
    addGraphTooltips();
    
    // Update stats
    const current = data[data.length - 1]?.amount || 0;
    const average = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
    document.getElementById('graph-current').textContent = formatCurrency(current);
    document.getElementById('graph-average').textContent = formatCurrency(average);
}

function addGraphTooltips() {
    const points = document.querySelectorAll('.graph-point');
    let tooltip = document.querySelector('.graph-tooltip');
    
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.className = 'graph-tooltip';
        document.getElementById('line-graph-container').appendChild(tooltip);
    }
    
    points.forEach(point => {
        point.addEventListener('mouseenter', (e) => {
            const amount = e.target.dataset.amount;
            const date = e.target.dataset.date;
            tooltip.innerHTML = `<div><strong>${formatCurrency(parseFloat(amount))}</strong></div><div>${date}</div>`;
            tooltip.classList.add('show');
            
            const rect = e.target.getBoundingClientRect();
            const container = document.getElementById('line-graph-container').getBoundingClientRect();
            tooltip.style.left = (rect.left - container.left) + 'px';
            tooltip.style.top = (rect.top - container.top - 50) + 'px';
        });
        
        point.addEventListener('mouseleave', () => {
            tooltip.classList.remove('show');
        });
    });
}

// ====================================================================
// 2. FINANCIAL HEALTH SCORE GAUGE (Tasks 3.1-3.7)
// ====================================================================

function renderHealthGauge() {
    if (!window.expenseTracker) return;
    
    const score = calculateHealthScore();
    const progressCircle = document.getElementById('health-gauge-progress');
    const scoreElement = document.getElementById('health-score');
    const statusElement = document.getElementById('health-status');
    const messageElement = document.getElementById('health-message');
    
    if (!progressCircle || !scoreElement) return;
    
    // Calculate stroke-dasharray for progress (circumference = 2 * π * r = 2 * π * 40 ≈ 251.2)
    const circumference = 251.2;
    const progress = (score / 100) * circumference;
    
    // Animate count-up
    animateCountUp(scoreElement, 0, score, 1200);
    
    // Animate progress ring
    setTimeout(() => {
        progressCircle.style.strokeDasharray = `${progress} ${circumference}`;
        progressCircle.style.transition = 'stroke-dasharray 1.2s ease-out';
    }, 100);
    
    // Update status and color
    let status, message, gradientColors;
    if (score >= 80) {
        status = 'Excellent';
        message = 'Strong financial health with consistent savings';
        gradientColors = ['#34C759', '#00C853'];
    } else if (score >= 60) {
        status = 'Good';
        message = 'Solid financial position with room for improvement';
        gradientColors = ['#007AFF', '#0051D5'];
    } else if (score >= 40) {
        status = 'Fair';
        message = 'Consider reviewing spending habits';
        gradientColors = ['#FF9F0A', '#FF8C00'];
    } else {
        status = 'Needs Attention';
        message = 'Focus on reducing expenses and increasing savings';
        gradientColors = ['#FF453A', '#DC143C'];
    }
    
    statusElement.textContent = status;
    messageElement.textContent = message;
    
    // Update gradient colors
    const gradient = document.querySelector('#healthGradient');
    if (gradient) {
        gradient.innerHTML = `
            <stop offset="0%" stop-color="${gradientColors[0]}"/>
            <stop offset="100%" stop-color="${gradientColors[1]}"/>
        `;
    }
}

function calculateHealthScore() {
    if (!window.expenseTracker) return 0;
    
    const settings = window.expenseTracker.settings;
    const expenses = window.expenseTracker.expenses;
    
    // Get current month expenses
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const monthlyExpenses = expenses.filter(e => {
        const d = new Date(e.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    
    const totalExpenses = monthlyExpenses.reduce((sum, e) => sum + e.amount, 0);
    const income = settings.income || 1;
    const fixedExpenses = (settings.rent || 0) + (settings.utilities || 0) + (settings.insurance || 0);
    const variableExpenses = totalExpenses - fixedExpenses;
    const savings = income - totalExpenses;
    
    // Calculate components (40% savings rate, 40% budget adherence, 20% trend)
    const savingsRate = Math.max(0, Math.min(100, (savings / income) * 100));
    const savingsScore = (savingsRate / 100) * 40;
    
    const totalBudget = getTotalBudget(settings.goals);
    const budgetAdherence = totalBudget > 0 ? Math.max(0, 100 - (variableExpenses / totalBudget * 100)) : 50;
    const budgetScore = (budgetAdherence / 100) * 40;
    
    // Trend score (simplified - compare to previous month)
    const trendScore = 20; // Default neutral score
    
    const finalScore = Math.round(savingsScore + budgetScore + trendScore);
    return Math.max(0, Math.min(100, finalScore));
}

function animateCountUp(element, start, end, duration) {
    const startTime = Date.now();
    const range = end - start;
    
    function update() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3); // Cubic ease-out
        const current = Math.round(start + range * easeOut);
        
        element.textContent = current;
        
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    
    requestAnimationFrame(update);
}

// ====================================================================
// 3. WEEKLY SPENDING HEATMAP (Tasks 4.1-4.7)
// ====================================================================

function renderHeatmap() {
    const container = document.getElementById('heatmap-container');
    if (!container || !window.expenseTracker) return;
    
    const heatmapData = getHeatmapData();
    
    // Build grid HTML
    let html = '<div class="heatmap-label"></div>'; // Empty corner
    
    // Day headers
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    days.forEach(day => {
        html += `<div class="heatmap-label">${day}</div>`;
    });
    
    // Week rows
    heatmapData.weeks.forEach((week, weekIndex) => {
        html += `<div class="heatmap-label">W${weekIndex + 1}</div>`;
        
        week.forEach((day, dayIndex) => {
            const intensity = getIntensityColor(day.amount, heatmapData.maxAmount);
            const cellClass = day.amount > 0 ? 'heatmap-cell' : 'heatmap-cell empty';
            const title = day.amount > 0 
                ? `${day.date}: ${formatCurrency(day.amount)} (${day.count} transactions)`
                : `${day.date}: No spending`;
            
            // Show amount text in cell if there's spending
            const amountText = day.amount > 0 ? `$${day.amount < 100 ? day.amount.toFixed(0) : Math.round(day.amount)}` : '';
            
            html += `
                <div class="${cellClass}" style="background: ${intensity};" title="${title}" data-amount="${day.amount}" data-count="${day.count}" data-date="${day.date}">
                    <div class="heatmap-amount">${amountText}</div>
                    ${day.count > 0 ? `<div class="heatmap-count">${day.count}</div>` : ''}
                </div>
            `;
        });
    });
    
    container.innerHTML = html;
    
    // Add enhanced hover interactions
    addHeatmapInteractions();
}

function getHeatmapData() {
    if (!window.expenseTracker) return { weeks: [], maxAmount: 0 };
    
    const today = new Date();
    const weeks = [];
    let maxAmount = 0;
    
    // Generate 4 weeks of data
    for (let weekIndex = 3; weekIndex >= 0; weekIndex--) {
        const week = [];
        
        for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
            const date = new Date(today);
            date.setDate(today.getDate() - (weekIndex * 7 + (6 - dayIndex)));
            
            const dateStr = date.toISOString().split('T')[0];
            const dayExpenses = window.expenseTracker.expenses.filter(e => {
                return new Date(e.date).toISOString().split('T')[0] === dateStr;
            });
            
            const amount = dayExpenses.reduce((sum, e) => sum + e.amount, 0);
            maxAmount = Math.max(maxAmount, amount);
            
            week.push({
                date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                amount: amount,
                count: dayExpenses.length
            });
        }
        
        weeks.push(week);
    }
    
    return { weeks, maxAmount };
}

function getIntensityColor(amount, maxAmount) {
    if (amount === 0) return 'rgba(0, 0, 0, 0.03)';
    
    const intensity = amount / (maxAmount || 1);
    
    if (intensity < 0.25) {
        return 'rgba(0, 122, 255, 0.15)';
    } else if (intensity < 0.50) {
        return 'rgba(0, 122, 255, 0.35)';
    } else if (intensity < 0.75) {
        return 'rgba(0, 122, 255, 0.60)';
    } else {
        return 'rgba(0, 122, 255, 0.85)';
    }
}

function addHeatmapInteractions() {
    const cells = document.querySelectorAll('.heatmap-cell');
    let tooltip = document.querySelector('.heatmap-tooltip');
    
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.className = 'heatmap-tooltip';
        document.getElementById('heatmap-container').parentNode.appendChild(tooltip);
    }
    
    cells.forEach(cell => {
        cell.addEventListener('mouseenter', (e) => {
            const amount = parseFloat(e.currentTarget.dataset.amount);
            const count = parseInt(e.currentTarget.dataset.count) || 0;
            const date = e.currentTarget.dataset.date;
            
            if (amount > 0) {
                const expenseDetails = getExpenseDetailsForDate(date);
                let tooltipContent = `
                    <div class="tooltip-header">
                        <strong>${date}</strong>
                    </div>
                    <div class="tooltip-summary">
                        Total: <strong>${formatCurrency(amount)}</strong> • ${count} transaction${count !== 1 ? 's' : ''}
                    </div>
                `;
                
                if (expenseDetails.length > 0) {
                    tooltipContent += '<div class="tooltip-breakdown">';
                    expenseDetails.slice(0, 3).forEach(expense => {
                        tooltipContent += `
                            <div class="tooltip-item">
                                <span class="expense-desc">${expense.description}</span>
                                <span class="expense-amount">${formatCurrency(expense.amount)}</span>
                            </div>
                        `;
                    });
                    
                    if (expenseDetails.length > 3) {
                        tooltipContent += `<div class="tooltip-more">+${expenseDetails.length - 3} more</div>`;
                    }
                    tooltipContent += '</div>';
                }
                
                tooltip.innerHTML = tooltipContent;
                tooltip.classList.add('show');
                
                const rect = e.currentTarget.getBoundingClientRect();
                const container = document.getElementById('heatmap-container').getBoundingClientRect();
                tooltip.style.left = (rect.left - container.left + rect.width / 2) + 'px';
                tooltip.style.top = (rect.top - container.top - 10) + 'px';
            }
        });
        
        cell.addEventListener('mouseleave', () => {
            tooltip.classList.remove('show');
        });
    });
}

function getExpenseDetailsForDate(dateStr) {
    if (!window.expenseTracker) return [];
    
    return window.expenseTracker.expenses.filter(expense => {
        const expenseDate = new Date(expense.date).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
        });
        return expenseDate === dateStr;
    });
}

// ====================================================================
// 4. CATEGORY SPENDING PIE CHART (Tasks 5.1-5.8)
// ====================================================================

function renderPieChart() {
    const svg = document.getElementById('category-pie-chart');
    const breakdownContainer = document.getElementById('category-breakdown');
    
    if (!svg || !breakdownContainer || !window.expenseTracker) return;
    
    const categoryData = getCategoryData();
    
    if (categoryData.length === 0) {
        svg.innerHTML = '<text x="50" y="50" text-anchor="middle" fill="#9ca3af" font-size="6">No data</text>';
        breakdownContainer.innerHTML = '<div class="text-gray-500 text-center py-4">No expenses this month</div>';
        return;
    }
    
    // Draw pie chart
    drawPieChart(svg, categoryData);
    
    // Draw breakdown bars
    drawCategoryBreakdown(breakdownContainer, categoryData);
}

function getCategoryData() {
    if (!window.expenseTracker) return [];
    
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const monthlyExpenses = window.expenseTracker.expenses.filter(e => {
        const d = new Date(e.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    
    const categoryTotals = {};
    monthlyExpenses.forEach(e => {
        if (!categoryTotals[e.category]) {
            categoryTotals[e.category] = 0;
        }
        categoryTotals[e.category] += e.amount;
    });
    
    const total = Object.values(categoryTotals).reduce((sum, amount) => sum + amount, 0);
    
    // Convert to array and sort by amount (top 5)
    const categories = Object.keys(categoryTotals)
        .map(name => ({
            name,
            amount: categoryTotals[name],
            percentage: (categoryTotals[name] / total * 100).toFixed(1)
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);
    
    return categories;
}

function drawPieChart(svg, data) {
    const centerX = 50;
    const centerY = 50;
    const radius = 35;
    const innerRadius = 20; // Donut chart
    
    let currentAngle = -90; // Start at top
    let svgContent = '';
    
    const colors = [
        '#FF9F0A', // Orange
        '#007AFF', // Blue
        '#34C759', // Green
        '#FF453A', // Red
        '#AF52DE', // Purple
    ];
    
    data.forEach((category, index) => {
        const angle = (parseFloat(category.percentage) / 100) * 360;
        const endAngle = currentAngle + angle;
        
        const path = describeArc(centerX, centerY, radius, innerRadius, currentAngle, endAngle);
        const color = colors[index % colors.length];
        
        svgContent += `<path d="${path}" fill="${color}" class="pie-segment" 
                        data-category="${category.name}"
                        style="animation: fadeInUp 0.6s ease-out ${index * 0.1}s both"/>`;
        
        currentAngle = endAngle;
    });
    
    svg.innerHTML = svgContent;
    
    // Add hover effects
    const segments = svg.querySelectorAll('.pie-segment');
    segments.forEach(segment => {
        segment.addEventListener('mouseenter', () => {
            segments.forEach(s => s.classList.remove('highlighted'));
            segment.classList.add('highlighted');
        });
        
        segment.addEventListener('mouseleave', () => {
            segment.classList.remove('highlighted');
        });
    });
}

function describeArc(x, y, radius, innerRadius, startAngle, endAngle) {
    const start = polarToCartesian(x, y, radius, endAngle);
    const end = polarToCartesian(x, y, radius, startAngle);
    const innerStart = polarToCartesian(x, y, innerRadius, endAngle);
    const innerEnd = polarToCartesian(x, y, innerRadius, startAngle);
    
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
    
    return [
        'M', start.x, start.y,
        'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y,
        'L', innerEnd.x, innerEnd.y,
        'A', innerRadius, innerRadius, 0, largeArcFlag, 1, innerStart.x, innerStart.y,
        'Z'
    ].join(' ');
}

function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
    return {
        x: centerX + (radius * Math.cos(angleInRadians)),
        y: centerY + (radius * Math.sin(angleInRadians))
    };
}

function drawCategoryBreakdown(container, data) {
    const colors = [
        '#FF9F0A', '#007AFF', '#34C759', '#FF453A', '#AF52DE'
    ];
    
    const html = data.map((category, index) => {
        const color = colors[index % colors.length];
        return `
            <div class="category-bar-item" style="animation-delay: ${index * 0.1}s">
                <div class="flex justify-between items-center mb-2">
                    <div class="flex items-center gap-2">
                        <div class="w-3 h-3 rounded-full" style="background: ${color};"></div>
                        <span class="font-medium text-gray-900">${category.name}</span>
                    </div>
                    <div class="text-right">
                        <div class="font-semibold text-gray-900">${formatCurrency(category.amount)}</div>
                        <div class="text-xs text-gray-500">${category.percentage}%</div>
                    </div>
                </div>
                <div class="category-bar-progress">
                    <div class="category-bar-fill" style="width: ${category.percentage}%; background: ${color};"></div>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = html;
}

// Initialize Overview components when page loads
document.addEventListener('DOMContentLoaded', () => {
    // Check if we're on the overview page
    const overviewPage = document.getElementById('overview-page');
    if (overviewPage && !overviewPage.classList.contains('hidden')) {
        // Load saved tab preference
        const savedTab = localStorage.getItem('activeOverviewTab') || 'overview';
        if (savedTab === 'overview') {
            setTimeout(() => {
                initializeOverviewComponents();
            }, 500);
        }
    }
});

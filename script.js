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
        this.loadSettings();
        this.updateDashboard();
        this.renderTransactions();
        this.initializeHistoryPage();
        this.showPage('dashboard');
    }

    setupEventListeners() {
        // Form submission
        document.getElementById('expense-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addExpense();
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
    }

    // ====================================================================
    // EXPENSE MANAGEMENT
    // ====================================================================

    async addExpense() {
        const amount = parseFloat(document.getElementById('amount').value);
        const description = document.getElementById('description').value;
        const category = document.getElementById('category').value;

        if (!amount || !description || !category) return;

        const expense = {
            id: Date.now(),
            amount: amount,
            description: description,
            category: category,
            date: new Date().toISOString(),
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

    clearForm() {
        document.getElementById('expense-form').reset();
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

        Object.keys(this.settings.goals).forEach(category => {
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

        container.innerHTML = sortedExpenses.map(expense => `
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
                <div class="flex items-center space-x-3">
                    <span class="font-semibold text-red-600">-${formatCurrency(expense.amount)}</span>
                    <button onclick="expenseTracker.deleteExpense(${expense.id})" 
                            class="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `).join('');
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

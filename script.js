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
        this.expenses = this.expenses.map(e => (e.tripId === undefined ? { ...e, tripId: null } : e));
        this.settings = JSON.parse(localStorage.getItem('settings')) || this.getDefaultSettings();
        this.currentPage = 'dashboard';
        this.currentTrendsOffset = 0; // For navigating through time periods
        this.currentTrendsView = 'daily'; // 'daily' or 'weekly'
        this.currentHistoryOffset = 0; // For history month navigation
        this.categoryDistributionView = 'month'; // 'month' or 'year'
        
        // DISABLE sample data generation in production
        // Sample data should only be for development, never production
        if (this.expenses.length === 0) {
            console.log('No expenses found - waiting for Firebase sync instead of adding sample data');
            // Don't add sample data - let Firebase sync handle it
        } else {
            console.log('Found existing expenses:', this.expenses.length);
        }
        
        // Temporary sample data removal function
        window.removeSampleData = async () => {
            console.log('🔍 Checking Firebase connection...');
            
            if (!window.firebaseDb) {
                console.error('❌ Firebase not initialized');
                return 'Error: Firebase not available';
            }
            
            if (!firebaseAuth?.currentUser) {
                console.error('❌ Not signed in');
                return 'Error: Must be signed in';
            }
            
            console.log('✅ Firebase available, user signed in');

            const sampleData = [
                {date: '2026-04-05', description: 'Starbucks Coffee', amount: 6.50},
                {date: '2026-04-04', description: 'Whole Foods Market', amount: 125.30},
                {date: '2026-04-03', description: 'Shell Gas Station', amount: 52.00},
                {date: '2026-04-02', description: 'Netflix Subscription', amount: 15.99},
                {date: '2026-04-01', description: 'Amazon Prime Order', amount: 89.99},
                {date: '2026-04-06', description: 'Chipotle Lunch', amount: 12.50},
                {date: '2026-04-05', description: 'Uber Ride', amount: 18.75},
                {date: '2026-04-04', description: 'Starbucks Coffee', amount: 5.25},
                {date: '2026-04-03', description: 'Target Shopping', amount: 67.45},
                {date: '2026-04-02', description: 'Movie Theater', amount: 28.00},
                {date: '2026-04-01', description: 'Grocery Store', amount: 78.90},
                {date: '2026-03-28', description: 'Starbucks Coffee', amount: 5.75},
                {date: '2026-03-27', description: 'Safeway Groceries', amount: 98.45},
                {date: '2026-03-26', description: 'Gas Station Fill-up', amount: 48.50},
                {date: '2026-03-25', description: 'Spotify Premium', amount: 9.99},
                {date: '2026-03-24', description: 'Best Buy Electronics', amount: 156.78},
                {date: '2026-03-23', description: 'Pizza Delivery', amount: 32.50},
                {date: '2026-03-22', description: 'Car Repair Service', amount: 420.00},
                {date: '2026-03-21', description: 'Dunkin Coffee', amount: 4.25},
                {date: '2026-03-20', description: 'Lyft Ride', amount: 22.30},
                {date: '2026-03-19', description: 'Costco Shopping', amount: 145.67},
                {date: '2026-03-18', description: 'Restaurant Dinner', amount: 65.80},
                {date: '2026-03-17', description: 'Medical Copay', amount: 35.00},
                {date: '2026-02-28', description: 'Coffee Shop', amount: 7.50},
                {date: '2026-02-27', description: 'Trader Joes', amount: 87.25},
                {date: '2026-02-26', description: 'Metro Card Refill', amount: 30.00},
                {date: '2026-02-25', description: 'Disney+ Subscription', amount: 7.99},
                {date: '2026-02-24', description: 'Online Shopping', amount: 78.90},
                {date: '2026-02-23', description: 'Sushi Restaurant', amount: 45.60}
            ];
            
            // Clean localStorage first (always works)
            const original = expenseTracker.expenses.length;
            expenseTracker.expenses = expenseTracker.expenses.filter(expense => {
                return !sampleData.some(sample => 
                    expense.date === sample.date && 
                    expense.description === sample.description && 
                    expense.amount === sample.amount
                );
            });
            
            const localRemoved = original - expenseTracker.expenses.length;
            localStorage.setItem('expenses', JSON.stringify(expenseTracker.expenses));
            console.log(`✅ Removed ${localRemoved} from localStorage`);
            
            // Try Firebase deletion with timeout
            try {
                console.log('🗑️ Attempting Firebase deletion...');
                
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout')), 10000)
                );
                
                const deletePromise = (async () => {
                    const snapshot = await window.firebaseDb.collection('users')
                        .doc(firebaseAuth.currentUser.uid)
                        .collection('expenses')
                        .get();
                    
                    console.log(`Found ${snapshot.docs.length} expenses in Firebase`);
                    
                    let deletedCount = 0;
                    const batch = window.firebaseDb.batch();
                    
                    snapshot.docs.forEach(doc => {
                        const expense = doc.data();
                        const isSample = sampleData.some(sample => 
                            expense.date === sample.date && 
                            expense.description === sample.description && 
                            expense.amount === sample.amount
                        );
                        
                        if (isSample) {
                            console.log(`Deleting: ${expense.description} - $${expense.amount}`);
                            batch.delete(doc.ref);
                            deletedCount++;
                        }
                    });
                    
                    await batch.commit();
                    return deletedCount;
                })();
                
                const deletedCount = await Promise.race([deletePromise, timeoutPromise]);
                console.log(`✅ Deleted ${deletedCount} from Firebase`);
                
                return `Success: ${localRemoved} from localStorage, ${deletedCount} from Firebase`;
                
            } catch (error) {
                console.warn(`⚠️ Firebase deletion failed: ${error.message}`);
                console.log('✅ Local cleanup completed successfully');
                return `Partial success: ${localRemoved} from localStorage (Firebase failed: ${error.message})`;
            }
        };
        
        // Backup function to download all transactions
        window.downloadBackup = () => {
            const backup = {
                expenses: expenseTracker.expenses,
                settings: expenseTracker.settings,
                exportDate: new Date().toISOString(),
                totalTransactions: expenseTracker.expenses.length
            };
            
            const dataStr = JSON.stringify(backup, null, 2);
            const dataBlob = new Blob([dataStr], {type: 'application/json'});
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = `ledgr-backup-${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            
            console.log(`✅ Downloaded backup with ${backup.totalTransactions} transactions`);
            return `Backup downloaded: ${backup.totalTransactions} transactions`;
        };
        
        this.init();
    }

    addSampleData() {
        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        
        // Sample data for April 2026 (current month)
        const aprilSamples = [
            { description: 'Starbucks Coffee', amount: 6.50, category: 'Coffee', date: '2026-04-05' },
            { description: 'Whole Foods Market', amount: 125.30, category: 'Food', date: '2026-04-04' },
            { description: 'Shell Gas Station', amount: 52.00, category: 'Transportation', date: '2026-04-03' },
            { description: 'Netflix Subscription', amount: 15.99, category: 'Entertainment', date: '2026-04-02' },
            { description: 'Amazon Prime Order', amount: 89.99, category: 'Shopping', date: '2026-04-01' },
            { description: 'Chipotle Lunch', amount: 12.50, category: 'Food', date: '2026-04-06' },
            { description: 'Uber Ride', amount: 18.75, category: 'Transportation', date: '2026-04-05' },
            { description: 'Starbucks Coffee', amount: 5.25, category: 'Coffee', date: '2026-04-04' },
            { description: 'Target Shopping', amount: 67.45, category: 'Shopping', date: '2026-04-03' },
            { description: 'Movie Theater', amount: 28.00, category: 'Entertainment', date: '2026-04-02' },
            { description: 'Grocery Store', amount: 78.90, category: 'Food', date: '2026-04-01' },
        ];

        // Sample data for March 2026 (previous month)
        const marchSamples = [
            { description: 'Starbucks Coffee', amount: 5.75, category: 'Coffee', date: '2026-03-28' },
            { description: 'Safeway Groceries', amount: 98.45, category: 'Food', date: '2026-03-27' },
            { description: 'Gas Station Fill-up', amount: 48.50, category: 'Transportation', date: '2026-03-26' },
            { description: 'Spotify Premium', amount: 9.99, category: 'Entertainment', date: '2026-03-25' },
            { description: 'Best Buy Electronics', amount: 156.78, category: 'Shopping', date: '2026-03-24' },
            { description: 'Pizza Delivery', amount: 32.50, category: 'Food', date: '2026-03-23' },
            { description: 'Car Repair Service', amount: 420.00, category: 'Other', date: '2026-03-22', excludeFromBudget: true },
            { description: 'Dunkin Coffee', amount: 4.25, category: 'Coffee', date: '2026-03-21' },
            { description: 'Lyft Ride', amount: 22.30, category: 'Transportation', date: '2026-03-20' },
            { description: 'Costco Shopping', amount: 145.67, category: 'Shopping', date: '2026-03-19' },
            { description: 'Restaurant Dinner', amount: 65.80, category: 'Food', date: '2026-03-18' },
            { description: 'Medical Copay', amount: 35.00, category: 'Other', date: '2026-03-17', excludeFromBudget: true },
        ];

        // Sample data for February 2026 (two months ago)
        const februarySamples = [
            { description: 'Coffee Shop', amount: 7.50, category: 'Coffee', date: '2026-02-28' },
            { description: 'Trader Joes', amount: 87.25, category: 'Food', date: '2026-02-27' },
            { description: 'Metro Card Refill', amount: 30.00, category: 'Transportation', date: '2026-02-26' },
            { description: 'Disney+ Subscription', amount: 7.99, category: 'Entertainment', date: '2026-02-25' },
            { description: 'Online Shopping', amount: 78.90, category: 'Shopping', date: '2026-02-24' },
            { description: 'Sushi Restaurant', amount: 45.60, category: 'Food', date: '2026-02-23' },
        ];

        // Add sample expenses with IDs and timestamps
        [...aprilSamples, ...marchSamples, ...februarySamples].forEach((sample, index) => {
            this.expenses.push({
                id: Date.now() + index,
                ...sample,
                timestamp: Date.now() + index,
                excludeFromBudget: sample.excludeFromBudget || false
            });
        });

        // Save sample data to localStorage
        localStorage.setItem('expenses', JSON.stringify(this.expenses));
        console.log('Added comprehensive sample data for April, March, and February 2026');
    }

    getDefaultSettings() {
        return {
            income: 4000, // Default income — used for any month without an override
            incomeOverrides: {}, // { "YYYY-MM": amount } for one-off months
            rent: 1200,
            utilities: 150,
            insurance: 200,
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

    getIncomeFor(year, month) {
        const key = `${year}-${String(month + 1).padStart(2, '0')}`;
        return this.settings.incomeOverrides?.[key] ?? this.settings.income ?? 0;
    }

    setIncomeOverride(year, month, amount) {
        if (!this.settings.incomeOverrides) this.settings.incomeOverrides = {};
        const key = `${year}-${String(month + 1).padStart(2, '0')}`;
        if (amount == null) delete this.settings.incomeOverrides[key];
        else this.settings.incomeOverrides[key] = parseFloat(amount);
        this.saveSettingsToFirebase?.();
        localStorage.setItem('settings', JSON.stringify(this.settings));
        this.updateDashboard();
        return this.settings.incomeOverrides;
    }

    // ====================================================================
    // APPLICATION INITIALIZATION
    // ====================================================================

    init() {
        this.setupEventListeners();
        this.loadSettings();
        this.renderCategoryGoalsSettings();
        this.renderExistingCategories();
        this.updateCategoryDropdown();
        this.updateDashboard();
        this.renderTransactions();
        this.initializeDateField();
        this.showPage('dashboard');
    }

    setupEventListeners() {
        // Form submission
        safeAddEventListener('expense-form', 'submit', async (e) => {
            e.preventDefault();
            await this.addExpense();
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
        // pageId can be 'dashboard' | 'trips' | 'trip-dashboard' | 'transactions' | 'history' | 'add-expense' | 'settings'
        document.querySelectorAll('.page-content').forEach(page => { page.classList.add('hidden'); });
        const map = {
            'dashboard': 'dashboard-page',
            'trips': 'trips-page',
            'trip-dashboard': 'trip-dashboard-page',
            'transactions': 'transactions-page',
            'history': 'history-page',
            'add-expense': 'add-expense-page',
            'settings': 'settings-page'
        };
        const elId = map[pageId];
        if (elId) {
            const el = document.getElementById(elId);
            if (el) el.classList.remove('hidden');
        }
        // Update nav active state
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        const navBtnId = { dashboard: 'nav-home', trips: 'nav-trips', 'trip-dashboard': 'nav-trips', transactions: 'nav-txns', history: 'nav-history' }[pageId];
        if (navBtnId) {
            const btn = document.getElementById(navBtnId);
            if (btn) btn.classList.add('active');
        }
        // Renderer hooks
        if (pageId === 'trips' && typeof renderTripsIndex === 'function') renderTripsIndex();
        if (pageId === 'trip-dashboard' && typeof renderTripDashboard === 'function') renderTripDashboard();
        if (pageId === 'history' && typeof renderHistoryPage === 'function') renderHistoryPage();
        if (pageId === 'add-expense' && typeof renderAddExpensePage === 'function') renderAddExpensePage();
        window.scrollTo({ top: 0, behavior: 'instant' });

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
            timestamp: Date.now(),
            excludeFromBudget: false,
            tripId: null
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
        
        // Award XP for logging an expense
        if (window.gamification) {
            window.gamification.addXP(5, 'expense-logged');
            window.gamification.updateStreak();
            if (typeof updateGamificationUI === 'function') updateGamificationUI();
        }

        // Show success message
        showNotification('Expense added successfully!', 'success');
        
        // Redirect to dashboard
        this.showPage('dashboard');
    }

    addExpenseProgrammatically(expense) {
        if (expense.tripId === undefined) expense.tripId = null;
        this.expenses.push(expense);
        if (currentUser) {
            this.saveExpenseToFirebase(expense);
        } else {
            this.saveExpenses();
        }
        this.updateDashboard();
        this.renderTransactions();
    }

    addExpensesBatch(expenses) {
        for (const e of expenses) {
            if (e.tripId === undefined) e.tripId = null;
        }
        this.expenses.push(...expenses);
        if (currentUser && expenses.length > 0) {
            const batch = db.batch();
            expenses.forEach(e => {
                const ref = db.collection('users').doc(currentUser.uid)
                    .collection('expenses').doc(e.id.toString());
                batch.set(ref, e);
            });
            batch.commit().catch(err => console.error('Batch write failed:', err));
        } else if (expenses.length > 0) {
            this.saveExpenses();
        }
        this.updateDashboard();
        this.renderTransactions();
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

    toggleExcludeExpense(expenseId) {
        const expense = this.expenses.find(e => e.id === expenseId);
        if (!expense) return;

        expense.excludeFromBudget = !expense.excludeFromBudget;
        
        // Add smooth transition effect
        const transactionRow = document.querySelector(`[data-expense-id="${expenseId}"]`);
        if (transactionRow) {
            transactionRow.style.transition = 'opacity 0.3s ease';
            transactionRow.style.opacity = expense.excludeFromBudget ? '0.5' : '1';
        }
        
        // Save to localStorage
        this.saveExpenses();
        
        // Update Firebase if user is signed in
        if (currentUser) {
            this.saveExpenseToFirebase(expense);
        }

        this.updateDashboard();
        
        // Show feedback
        const status = expense.excludeFromBudget ? 'excluded from' : 'included in';
        showNotification(`Transaction ${status} budget`, 'success');
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
        const _f = document.getElementById('expense-form'); if (_f) _f.reset();
        // Reset date to today
        this.initializeDateField();
    }

    // ====================================================================
    // DAILY ENGAGEMENT HELPERS
    // ====================================================================

    getFoodCategories() {
        const cats = this.settings.categories || [];
        const matched = cats.filter(c => /food|dining|restaurant|eat|takeout|coffee|grocery|groceries/i.test(c));
        return matched.length ? matched : ['Food', 'Dining'];
    }

    getWeekId() {
        const now = new Date();
        const jan1 = new Date(now.getFullYear(), 0, 1);
        const week = Math.ceil(((now - jan1) / 86400000 + jan1.getDay() + 1) / 7);
        return `${now.getFullYear()}-W${week}`;
    }

    getWeeklyFoodStats() {
        const foodCats = this.getFoodCategories();
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
        const startStr = this.getLocalDateString(startOfWeek);
        const todayStr = this.getLocalDateString(now);

        const thisWeekFood = this.expenses
            .filter(e => e.date >= startStr && e.date <= todayStr && foodCats.some(c => e.category === c))
            .reduce((s, e) => s + e.amount, 0);

        const lastWeekStart = new Date(startOfWeek.getTime() - 7 * 86400000);
        const lastWeekEnd = new Date(startOfWeek.getTime() - 86400000);
        const lastWeekFood = this.expenses
            .filter(e => e.date >= this.getLocalDateString(lastWeekStart) && e.date <= this.getLocalDateString(lastWeekEnd) && foodCats.some(c => e.category === c))
            .reduce((s, e) => s + e.amount, 0);

        const fourWeeksAgo = new Date(startOfWeek.getTime() - 28 * 86400000);
        const pastFoodTotal = this.expenses
            .filter(e => e.date >= this.getLocalDateString(fourWeeksAgo) && e.date < startStr && foodCats.some(c => e.category === c))
            .reduce((s, e) => s + e.amount, 0);
        const weeklyAvg = pastFoodTotal / 4;

        return { thisWeekFood, weeklyAvg, lastWeekFood };
    }

    renderTodaysWin() {
        const card = document.getElementById('today-win-card');
        const textEl = document.getElementById('today-win-text');
        if (!card || !textEl) return;

        const now = new Date();
        const g = window.gamification?.data;
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        const foodCats = this.getFoodCategories();

        const wins = [];

        // Best-ever streak
        if (g?.streak?.current > 0 && g.streak.current === g.streak.best && g.streak.current >= 2) {
            wins.push({ msg: `Best streak ever — ${g.streak.current} days in a row`, weight: 25 });
        }
        // Active streak
        if (g?.streak?.current >= 3) {
            wins.push({ msg: `${g.streak.current}-day logging streak — consistency is everything`, weight: 18 });
        }

        // Food spending down vs last month
        const thisMonthFood = this.expenses
            .filter(e => { const d = this.parseLocalDate(e.date); return d.getMonth() === currentMonth && d.getFullYear() === currentYear && foodCats.some(c => e.category === c); })
            .reduce((s, e) => s + e.amount, 0);
        const lastMonthFood = this.expenses
            .filter(e => { const d = this.parseLocalDate(e.date); return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear && foodCats.some(c => e.category === c); })
            .reduce((s, e) => s + e.amount, 0);
        if (lastMonthFood > 0 && thisMonthFood < lastMonthFood) {
            const pct = Math.round(((lastMonthFood - thisMonthFood) / lastMonthFood) * 100);
            if (pct >= 5) wins.push({ msg: `Food spending down ${pct}% vs last month — great control`, weight: 20 });
        }

        // Days tracked this month
        const daysLogged = Object.keys(g?.dailyLog || {}).filter(d => {
            const date = new Date(d + 'T00:00:00');
            return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
        }).length;
        if (daysLogged >= 7) wins.push({ msg: `${daysLogged} days tracked this month — building a real habit`, weight: 12 });
        else if (daysLogged >= 3) wins.push({ msg: `${daysLogged} days tracked this month — keep the momentum`, weight: 8 });

        // Level milestone
        if (g?.level >= 5) wins.push({ msg: `Level ${g.level} — you're one of the consistent ones`, weight: 6 });

        // Defaults (always available)
        wins.push({ msg: `Every dollar you track is a dollar you control`, weight: 2 });
        wins.push({ msg: `Awareness is the first step to financial freedom`, weight: 1 });

        wins.sort((a, b) => b.weight - a.weight);
        const topWeight = wins[0].weight;
        const topWins = wins.filter(w => w.weight === topWeight);
        const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
        const pick = topWins[dayOfYear % topWins.length];

        textEl.textContent = pick.msg;
        card.classList.remove('hidden');
    }

    renderDailyPulse() {
        const card = document.getElementById('daily-pulse-card');
        if (!card) return;

        const now = new Date();
        const income = this.getIncomeFor(now.getFullYear(), now.getMonth());
        if (!income) { card.classList.add('hidden'); return; }

        const fixed = (this.settings.rent || 0) + (this.settings.utilities || 0) + (this.settings.insurance || 0);
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const daysLeft = Math.max(daysInMonth - now.getDate() + 1, 1);

        const totalBudget = Object.values(this.settings.goals || {}).reduce((s, v) => s + v, 0);
        // Use category budgets as baseline — far more accurate than income ÷ days.
        // Falls back to (income − fixed) ÷ days only if no category goals are set.
        const baselineDaily = totalBudget > 0
            ? totalBudget / daysInMonth
            : Math.max(income - fixed, 0) / daysInMonth;

        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const monthlySpent = this.expenses
            .filter(e => { const d = this.parseLocalDate(e.date); return d.getMonth() === currentMonth && d.getFullYear() === currentYear && !e.excludeFromBudget; })
            .reduce((s, e) => s + e.amount, 0);

        const remaining = totalBudget - monthlySpent;
        const isOverMonthly = totalBudget > 0 && remaining < 0;

        // Always forward-looking: if over monthly budget show daily baseline (what you should aim for),
        // otherwise spread what's left evenly across days remaining.
        const dailyTarget = isOverMonthly
            ? baselineDaily
            : totalBudget > 0
                ? Math.min(remaining / daysLeft, baselineDaily * 2)
                : baselineDaily;

        const todaySpend = this.getTodayStats().total;
        const pct = dailyTarget > 0 ? todaySpend / dailyTarget : 0;
        const barWidth = Math.min(pct * 100, 100).toFixed(1);
        const barColor = pct >= 1 ? '#f59e0b' : pct >= 0.75 ? '#a8c7fa' : '#43e97b';

        const sublabel = isOverMonthly
            ? 'daily average to stay on track'
            : `$${Math.round(remaining)} left · ${daysLeft} day${daysLeft !== 1 ? 's' : ''} to go`;
        const headroom = dailyTarget - todaySpend;
        const statusMsg = pct >= 1
            ? "You've reached today's target"
            : `$${headroom.toFixed(0)} left for today`;

        card.classList.remove('hidden');
        card.innerHTML = `
            <div class="flex items-center justify-between mb-3">
                <div>
                    <p class="text-xs font-bold tracking-widest uppercase" style="color:var(--md-sys-color-outline)">Today's target</p>
                    <p class="text-xs mt-0.5" style="color:var(--md-sys-color-outline);opacity:0.6">${sublabel}</p>
                </div>
                <p class="text-2xl font-extrabold" style="color:var(--md-sys-color-on-surface)">$${Math.round(dailyTarget)}</p>
            </div>
            <div class="w-full h-1.5 rounded-full mb-2" style="background:rgba(255,255,255,0.06)">
                <div class="h-1.5 rounded-full transition-all duration-700" style="width:${barWidth}%;background:${barColor}"></div>
            </div>
            <div class="flex justify-between items-center">
                <span class="text-xs" style="color:var(--md-sys-color-outline)">${statusMsg}</span>
                <span class="text-xs font-semibold" style="color:var(--md-sys-color-on-surface-variant)">$${todaySpend.toFixed(0)} spent today</span>
            </div>`;
    }

    renderWeeklyQuest() {
        const card = document.getElementById('weekly-quest-card');
        if (!card) return;

        const g = window.gamification;
        if (!g?.data) return;
        const weekId = this.getWeekId();
        const { thisWeekFood, weeklyAvg, lastWeekFood } = this.getWeeklyFoodStats();

        // Target priority: food budget goal ÷ 4.3 → 4-week avg → last week → 150
        const foodBudgetMonthly = this.getFoodCategories()
            .reduce((s, c) => s + (this.settings.goals?.[c] || 0), 0);
        const calcTarget = () => {
            if (foodBudgetMonthly > 0) return Math.round(foodBudgetMonthly / 4.3 / 5) * 5;
            if (weeklyAvg > 0) return Math.round(weeklyAvg * 0.85 / 5) * 5;
            if (lastWeekFood > 0) return Math.round(lastWeekFood * 0.9 / 5) * 5;
            return 150;
        };

        const needsNewQuest = !g.data.weeklyQuest || g.data.weeklyQuest.weekId !== weekId;
        // Also reset if target was set with no data and now we have spending history
        const targetClearlyWrong = g.data.weeklyQuest &&
            g.data.weeklyQuest.weekId === weekId &&
            thisWeekFood > g.data.weeklyQuest.target * 4 &&
            (weeklyAvg > g.data.weeklyQuest.target * 2 || lastWeekFood > g.data.weeklyQuest.target * 2);

        if (needsNewQuest || targetClearlyWrong) {
            g.data.weeklyQuest = {
                weekId,
                type: 'food-limit',
                target: Math.max(calcTarget(), 20),
                completed: false,
                xpRewarded: false
            };
            g.save();
        }

        const quest = g.data.weeklyQuest;
        const isOver = thisWeekFood > quest.target;
        const pct = quest.target > 0 ? thisWeekFood / quest.target : 0;
        const barWidth = Math.min(pct * 100, 100).toFixed(1);
        const barColor = isOver ? '#f59e0b' : pct >= 0.75 ? '#a8c7fa' : '#43e97b';

        const now = new Date();
        const daysLeftInWeek = Math.max(7 - now.getDay(), 1); // days including today until Sunday
        const daysLeftText = daysLeftInWeek === 1 ? 'last day' : `${daysLeftInWeek} days left`;

        // Award XP on Sunday if quest completed
        if (now.getDay() === 0 && !isOver && !quest.xpRewarded && thisWeekFood > 0) {
            quest.xpRewarded = true;
            quest.completed = true;
            g.save();
            g.addXP(30, 'weekly-quest');
            updateGamificationUI();
            showNotification('Weekly quest complete — +30 XP', 'success');
        }

        // Calculate week date range for context
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        const fmtDate = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const weekRange = `${fmtDate(weekStart)} – ${fmtDate(weekEnd)}`;

        const wayOver = pct > 1.5; // more than 150% — progress bar is meaningless

        card.classList.remove('hidden');

        // When WAY over goal mid-week: flip to week-vs-week view (no guilt %)
        if (wayOver && lastWeekFood > 0) {
            const wowDiff = thisWeekFood - lastWeekFood;
            const wowColor = wowDiff > 0 ? '#f59e0b' : '#43e97b';
            const wowIcon = wowDiff > 0 ? 'trending_up' : 'trending_down';
            const wowLabel = wowDiff > 0
                ? `$${wowDiff.toFixed(0)} more than last week`
                : `$${Math.abs(wowDiff).toFixed(0)} less than last week`;
            card.innerHTML = `
                <div class="flex items-center gap-2 mb-3" style="border-bottom:1px solid rgba(255,255,255,0.06);padding-bottom:10px">
                    <span class="material-symbols-rounded" style="font-size:16px;font-variation-settings:'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24;color:#f59e0b">restaurant</span>
                    <span class="text-xs font-bold tracking-widest uppercase" style="color:var(--md-sys-color-outline)">Food This Week</span>
                    <span class="text-xs ml-auto" style="color:var(--md-sys-color-outline)">${weekRange}</span>
                </div>
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-2xl font-extrabold" style="color:var(--md-sys-color-on-surface)">$${thisWeekFood.toFixed(0)}</p>
                        <p class="text-xs mt-0.5" style="color:var(--md-sys-color-outline)">this week · ${daysLeftText}</p>
                    </div>
                    <div class="text-right">
                        <div class="flex items-center gap-1 justify-end">
                            <span class="material-symbols-rounded" style="font-size:14px;color:${wowColor}">${wowIcon}</span>
                            <span class="text-sm font-semibold" style="color:${wowColor}">${wowLabel}</span>
                        </div>
                        <p class="text-xs mt-0.5" style="color:var(--md-sys-color-outline)">Last week: $${lastWeekFood.toFixed(0)}</p>
                    </div>
                </div>`;
            return;
        }

        // Normal view: under goal or slightly over
        const overAmount = thisWeekFood - quest.target;
        const underAmount = quest.target - thisWeekFood;
        const contextLine = isOver
            ? `<span style="color:#f59e0b">$${overAmount.toFixed(0)} above goal</span> · ${daysLeftText}`
            : underAmount < 5
                ? `<span style="color:#43e97b">Right on target</span> · ${daysLeftText}`
                : `<span style="color:#43e97b">$${underAmount.toFixed(0)} under goal</span> · ${daysLeftText}`;

        card.innerHTML = `
            <div class="flex items-center gap-2 mb-3" style="border-bottom:1px solid rgba(255,255,255,0.06);padding-bottom:10px">
                <span class="material-symbols-rounded" style="font-size:16px;font-variation-settings:'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24;color:#43e97b">restaurant</span>
                <span class="text-xs font-bold tracking-widest uppercase" style="color:var(--md-sys-color-outline)">Food This Week</span>
                <span class="text-xs ml-auto" style="color:var(--md-sys-color-outline)">${lastWeekFood > 0 ? `Last week: $${lastWeekFood.toFixed(0)}` : weekRange}</span>
            </div>
            <div class="flex items-end justify-between mb-2">
                <div>
                    <span class="text-2xl font-extrabold" style="color:var(--md-sys-color-on-surface)">$${thisWeekFood.toFixed(0)}</span>
                    <span class="text-xs ml-1.5" style="color:var(--md-sys-color-outline)">of $${quest.target} goal</span>
                </div>
                <span class="text-xs font-semibold" style="color:${barColor}">${daysLeftText}</span>
            </div>
            <div class="w-full h-1.5 rounded-full mb-2.5" style="background:rgba(255,255,255,0.06)">
                <div class="h-1.5 rounded-full transition-all duration-700" style="width:${barWidth}%;background:${barColor}"></div>
            </div>
            <p class="text-xs" style="color:var(--md-sys-color-outline)">${contextLine}</p>`;
    }

    // ====================================================================
    // DASHBOARD UPDATES
    // ====================================================================

    updateDashboard() {
        const now = new Date();
        const Y = now.getFullYear();
        const M = now.getMonth();
        const monthName = now.toLocaleDateString('en-US', { month: 'long' });
        const dayOfMonth = now.getDate();
        const daysInMonth = new Date(Y, M + 1, 0).getDate();
        const daysLeft = daysInMonth - dayOfMonth;

        const regularThisMonth = this.getRegularMonthExpenses(Y, M);
        const monthTotalRegular = regularThisMonth.reduce((s, e) => s + Number(e.amount || 0), 0);
        const monthCombined = this.getMonthCombinedExpenses(Y, M).reduce((s, e) => s + Number(e.amount || 0), 0);
        const tripExpensesThisMonth = monthCombined - monthTotalRegular;

        const SOFT = 1000, HARD = 2000, FOOD = 400;
        const monthFood = regularThisMonth.filter(e => e.category === 'Food').reduce((s, e) => s + Number(e.amount || 0), 0);
        const aim = this._computeAimToday({ monthTotal: monthTotalRegular, monthFood, daysLeft, SOFT, HARD, FOOD });

        const todayStr = this.getLocalDateString(now);
        const todayTotal = regularThisMonth.filter(e => e.date === todayStr).reduce((s, e) => s + Number(e.amount || 0), 0);
        const avgPerDay = dayOfMonth > 0 ? Math.round(monthTotalRegular / dayOfMonth) : 0;

        try { this.renderHomeGreeting(now); } catch (e) { console.warn(e); }
        try { this.renderHomeMonthHero({ monthName, year: Y, dayOfMonth, daysInMonth, daysLeft, monthTotalRegular, todayTotal, avgPerDay, aim, tripExpensesThisMonth, SOFT, HARD }); } catch (e) { console.warn(e); }
        try { this.renderHomeInsight({ monthName, aim, monthTotalRegular, SOFT }); } catch (e) { console.warn(e); }
        try { this.renderHomeTripTeaser(); } catch (e) { console.warn(e); }
        try { this.renderHomeHabit(); } catch (e) { console.warn(e); }
        try { this.renderHomeCategories(regularThisMonth); } catch (e) { console.warn(e); }
        try { this.renderHomeTrend({ regularThisMonth, daysInMonth, dayOfMonth, monthName, aim }); } catch (e) { console.warn(e); }
    }

    _computeAimToday({ monthTotal, monthFood, daysLeft, SOFT, HARD, FOOD }) {
        const dl = Math.max(1, daysLeft);
        if (monthTotal > HARD) return { state: 'HARD_OVER', dailyTotal: 0, dailyFood: 0 };
        if (monthTotal > SOFT) return { state: 'SOFT_OVER', dailyTotal: Math.round((HARD - monthTotal) / dl), dailyFood: 0 };
        if (monthFood > FOOD) return { state: 'FOOD_OVER', dailyTotal: Math.round((SOFT - monthTotal) / dl), dailyFood: 0 };
        return { state: 'HEALTHY', dailyTotal: Math.round((SOFT - monthTotal) / dl), dailyFood: Math.round((FOOD - monthFood) / dl) };
    }

    getTodayStats() {
        const today = this.getLocalDateString(new Date());
        const todayExpenses = this.expenses.filter(e => e.date === today && !e.excludeFromBudget);
        const needsCategories = ['Bills', 'Transportation'];
        const needsTotal = todayExpenses.filter(e => needsCategories.includes(e.category)).reduce((s, e) => s + e.amount, 0);
        const wantsTotal = todayExpenses.filter(e => !needsCategories.includes(e.category)).reduce((s, e) => s + e.amount, 0);
        return { total: needsTotal + wantsTotal, needs: needsTotal, wants: wantsTotal, count: todayExpenses.length };
    }

    renderTodayPanel() {
        const card = document.getElementById('today-panel');
        if (!card) return;

        const stats = this.getTodayStats();
        const now = new Date();
        const dayLabel = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        const fmt = v => '$' + v.toFixed(2);

        // Daily target logic (from renderDailyPulse)
        const income = this.getIncomeFor(now.getFullYear(), now.getMonth());
        const totalBudget = Object.values(this.settings.goals || {}).reduce((s, v) => s + v, 0);
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const daysLeft = Math.max(daysInMonth - now.getDate() + 1, 1);
        const fixed = (this.settings.rent || 0) + (this.settings.utilities || 0) + (this.settings.insurance || 0);
        const baselineDaily = totalBudget > 0
            ? totalBudget / daysInMonth
            : income > 0 ? Math.max(income - fixed, 0) / daysInMonth : 0;
        const showTarget = baselineDaily > 0;

        const currentMonth = now.getMonth(), currentYear = now.getFullYear();
        const monthlySpent = this.expenses
            .filter(e => { const d = this.parseLocalDate(e.date); return d.getMonth() === currentMonth && d.getFullYear() === currentYear && !e.excludeFromBudget; })
            .reduce((s, e) => s + e.amount, 0);
        const remaining = totalBudget - monthlySpent;
        const isOverMonthly = totalBudget > 0 && remaining < 0;
        const dailyTarget = showTarget
            ? (isOverMonthly ? baselineDaily : totalBudget > 0 ? Math.min(remaining / daysLeft, baselineDaily * 2) : baselineDaily)
            : 0;

        // Beat Yesterday
        const yesterdayStr = this.getLocalDateString(new Date(Date.now() - 86400000));
        const yesterdayTotal = this.expenses
            .filter(e => e.date === yesterdayStr && !e.excludeFromBudget)
            .reduce((s, e) => s + e.amount, 0);
        const showBeatYesterday = yesterdayTotal > 0;
        const beating = stats.total < yesterdayTotal;
        const beatDiff = Math.abs(stats.total - yesterdayTotal);

        const beatRow = showBeatYesterday ? `
            <div class="flex items-center justify-between mt-3 pt-2.5" style="border-top:1px solid rgba(255,255,255,0.06)">
                <span class="text-xs" style="color:var(--md-sys-color-outline)">vs yesterday</span>
                <div class="flex items-center gap-1">
                    <span class="material-symbols-rounded" style="font-size:14px;color:${beating ? '#43e97b' : 'var(--md-sys-color-outline)'}">${beating ? 'trending_down' : 'trending_flat'}</span>
                    <span class="text-xs font-semibold" style="color:${beating ? '#43e97b' : 'var(--md-sys-color-outline)'}">
                        ${beating ? `-$${beatDiff.toFixed(0)} ahead` : stats.total === yesterdayTotal ? 'same pace' : `$${beatDiff.toFixed(0)} more`}
                    </span>
                </div>
            </div>` : '';

        if (stats.count === 0) {
            card.innerHTML = `
                <div class="flex items-center justify-between mb-1">
                    <span class="text-xs font-bold tracking-widest uppercase" style="color:var(--md-sys-color-outline)">Today · ${dayLabel}</span>
                </div>
                <p class="text-sm mt-1" style="color:var(--md-sys-color-outline)">Nothing logged yet</p>
                ${showTarget ? `<p class="text-xs mt-0.5" style="color:var(--md-sys-color-outline);opacity:0.6">Target: $${Math.round(dailyTarget)} today</p>` : ''}
                ${showBeatYesterday ? `<p class="text-xs mt-1" style="color:var(--md-sys-color-outline)">Yesterday: ${fmt(yesterdayTotal)} — can you beat it?</p>` : ''}`;
            return;
        }

        const pct = dailyTarget > 0 ? stats.total / dailyTarget : 0;
        const barWidth = Math.min(pct * 100, 100).toFixed(1);
        const barColor = pct >= 1 ? '#f59e0b' : pct >= 0.75 ? '#a8c7fa' : '#43e97b';
        const headroom = dailyTarget - stats.total;

        const targetSection = showTarget ? `
            <div class="w-full h-1.5 rounded-full my-3" style="background:rgba(255,255,255,0.06)">
                <div class="h-1.5 rounded-full transition-all duration-700" style="width:${barWidth}%;background:${barColor}"></div>
            </div>
            <div class="flex justify-between text-xs" style="color:var(--md-sys-color-outline)">
                <span>${pct >= 1 ? 'Target reached' : `$${headroom.toFixed(0)} left today`}</span>
                <span>of $${Math.round(dailyTarget)} target</span>
            </div>` : '';

        card.innerHTML = `
            <div class="flex items-center justify-between mb-3">
                <span class="text-xs font-bold tracking-widest uppercase" style="color:var(--md-sys-color-outline)">Today · ${dayLabel}</span>
                <span class="text-xs" style="color:var(--md-sys-color-outline)">${stats.count} transaction${stats.count !== 1 ? 's' : ''}</span>
            </div>
            <p class="text-3xl font-extrabold" style="color:var(--md-sys-color-on-surface)">${fmt(stats.total)}</p>
            ${stats.needs > 0 || stats.wants > 0 ? `
            <div class="flex gap-3 mt-1">
                ${stats.needs > 0 ? `<span class="text-xs" style="color:var(--md-sys-color-outline)">Needs ${fmt(stats.needs)}</span>` : ''}
                ${stats.wants > 0 ? `<span class="text-xs" style="color:var(--md-sys-color-outline)">Wants ${fmt(stats.wants)}</span>` : ''}
            </div>` : ''}
            ${targetSection}
            ${beatRow}`;
    }

    renderTodayCard() {
        const card = document.getElementById('today-card');
        if (!card) return;
        const stats = this.getTodayStats();
        const dayLabel = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        const fmt = v => '$' + v.toFixed(2);

        // Beat Yesterday — get yesterday's total (only if they had expenses)
        const yesterdayStr = this.getLocalDateString(new Date(Date.now() - 86400000));
        const yesterdayTotal = this.expenses
            .filter(e => e.date === yesterdayStr && !e.excludeFromBudget)
            .reduce((s, e) => s + e.amount, 0);
        const showBeatYesterday = yesterdayTotal > 0;
        const beating = stats.total < yesterdayTotal;
        const beatDiff = Math.abs(stats.total - yesterdayTotal);
        const beatRow = showBeatYesterday ? `
            <div class="flex items-center justify-between pt-2 mt-2" style="border-top:1px solid rgba(255,255,255,0.06)">
                <span class="text-xs" style="color:var(--md-sys-color-outline)">vs yesterday</span>
                <div class="flex items-center gap-1">
                    <span class="material-symbols-rounded" style="font-size:14px;color:${beating ? '#43e97b' : 'var(--md-sys-color-outline)'}">${beating ? 'trending_down' : 'trending_flat'}</span>
                    <span class="text-xs font-semibold" style="color:${beating ? '#43e97b' : 'var(--md-sys-color-outline)'}">
                        ${beating ? `-$${beatDiff.toFixed(0)} ahead` : stats.total === yesterdayTotal ? 'same pace' : `$${beatDiff.toFixed(0)} more`}
                    </span>
                </div>
            </div>` : '';

        if (stats.count === 0) {
            card.innerHTML = `
                <div class="flex items-center justify-between mb-1">
                    <span class="text-xs font-medium tracking-widest uppercase" style="color:var(--md-sys-color-outline)">Today · ${dayLabel}</span>
                </div>
                <p class="text-sm" style="color:var(--md-sys-color-outline)">Nothing logged yet today</p>
                ${showBeatYesterday ? `<p class="text-xs mt-2" style="color:var(--md-sys-color-outline)">Yesterday: ${fmt(yesterdayTotal)} — can you beat it?</p>` : ''}`;
            return;
        }

        card.innerHTML = `
            <div class="flex items-center justify-between mb-3">
                <span class="text-xs font-medium tracking-widest uppercase" style="color:var(--md-sys-color-outline)">Today · ${dayLabel}</span>
                <span class="text-xs" style="color:var(--md-sys-color-outline)">${stats.count} transaction${stats.count > 1 ? 's' : ''}</span>
            </div>
            <p class="text-2xl font-bold mb-3" style="color:var(--md-sys-color-on-surface)">${fmt(stats.total)}</p>
            <div class="space-y-1.5">
                ${stats.needs > 0 ? `<div class="flex justify-between text-sm"><span style="color:var(--md-sys-color-outline)">Needs</span><span style="color:var(--md-sys-color-on-surface-variant)">${fmt(stats.needs)}</span></div>` : ''}
                ${stats.wants > 0 ? `<div class="flex justify-between text-sm"><span style="color:var(--md-sys-color-outline)">Wants</span><span style="color:var(--md-sys-color-on-surface-variant)">${fmt(stats.wants)}</span></div>` : ''}
            </div>
            ${beatRow}`;
    }

    maybeShowEveningNotification() {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;
        const now = new Date();
        if (now.getHours() < 21) return;
        const today = this.getLocalDateString(now);
        if (localStorage.getItem('notification_shown_date') === today) return;
        const stats = this.getTodayStats();
        if (stats.count === 0) return;
        const fmt = v => '$' + v.toFixed(2);
        new Notification("Ledgr — Today's Summary", {
            body: `${fmt(stats.total)} spent · ${stats.count} transaction${stats.count > 1 ? 's' : ''} · ${fmt(stats.needs)} needs, ${fmt(stats.wants)} wants`,
            icon: '/icon_192.png',
            tag: 'daily-summary'
        });
        localStorage.setItem('notification_shown_date', today);
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
        if (!container) return;
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
        if (!container) return;
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
                const isExcluded = expense.excludeFromBudget;
                const transactionStyle = isExcluded ? 'opacity:0.5' : '';
                
                return `
                <div class="transaction-row flex items-center justify-between px-4 py-3.5" 
                     style="border-bottom:1px solid rgba(255,255,255,0.04);${transactionStyle};cursor:pointer" 
                     data-expense-id="${expense.id}"
                     ontouchstart="handleTouchStart(event)" 
                     ontouchmove="handleTouchMove(event)" 
                     ontouchend="handleTouchEnd(event)">
                    <div class="flex items-center space-x-3">
                        <div class="w-9 h-9 rounded-full flex items-center justify-center" style="background:${c}30">
                            <span style="color:${c};font-weight:600" class="text-xs">${expense.category.charAt(0)}</span>
                        </div>
                        <div>
                            <p class="font-medium text-sm" style="color:var(--md-sys-color-on-surface)">${expense.description}</p>
                            <p class="text-xs" style="color:${c}">${expense.category}${expense.source === 'gmail' ? ' <span class="material-symbols-rounded" style="font-size:12px;color:var(--md-sys-color-outline);vertical-align:middle">mail</span>' : ''}</p>
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
        const catColors = {Food:'#f5576c',Coffee:'#f093fb',Transportation:'#4facfe',Entertainment:'#667eea',Shopping:'#43e97b',Bills:'#fccb90',Other:'#a18cd1'};
        container.innerHTML = Object.keys(this.settings.goals).map(category => {
            const val = this.settings.goals[category] || 0;
            const c = catColors[category] || '#a18cd1';
            return `
            <div>
                <div class="flex justify-between items-center mb-2">
                    <div class="flex items-center gap-2">
                        <div class="w-3 h-3 rounded-full" style="background:${c}"></div>
                        <span class="text-sm" style="color:var(--md-sys-color-on-surface)">${category}</span>
                    </div>
                    <span class="text-sm font-semibold" style="color:${c}" id="goal-display-${category.toLowerCase()}">$${val}</span>
                </div>
                <input type="range" min="0" max="1000" step="25" value="${val}" id="goal-${category.toLowerCase()}"
                    oninput="document.getElementById('goal-display-${category.toLowerCase()}').textContent='$'+this.value"
                    style="width:100%;accent-color:${c};height:4px">
            </div>`;
        }).join('');
    }

    loadSettings() {
        document.getElementById('setting-rent').value = this.settings.rent;
        document.getElementById('setting-utilities').value = this.settings.utilities;
        document.getElementById('setting-insurance').value = this.settings.insurance;
        document.getElementById('setting-income').value = this.settings.income;
        
        // Month label
        const ml = document.getElementById('income-month-label');
        if (ml) { const d = new Date(); ml.textContent = `Setting for ${d.toLocaleString('default',{month:'long'})} ${d.getFullYear()}`; }
        
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
            
            // Check for local data to migrate (but not if data was just cleaned)
            const localExpenses = JSON.parse(localStorage.getItem('expenses')) || [];
            const dataCleaned = localStorage.getItem('data_cleaned');
            if (localExpenses.length > 0 && !dataCleaned) {
                this.migrateLocalDataToFirebase(localExpenses);
            } else if (dataCleaned) {
                console.log('Skipping migration - data was recently cleaned');
                localStorage.removeItem('data_cleaned'); // Remove flag after use
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
        this.expenses = this.expenses.map(e => (e.tripId === undefined ? { ...e, tripId: null } : e));
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
                this.expenses = this.expenses.map(e => (e.tripId === undefined ? { ...e, tripId: null } : e));

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
        const monthIncome = this.getIncomeFor(parseInt(year), parseInt(month));
        const totalSavings = monthIncome - totalExpenses;

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
                income: monthIncome,
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
            <div class="p-4" style="border-bottom:1px solid rgba(255,255,255,0.06)">
                <h4 class="font-medium " style="color:var(--md-sys-color-on-surface)">${selectedMonthName} ${selectedYear} - ${expenses.length} transactions</h4>
            </div>
            ${sortedExpenses.map(expense => {
                const catColors = {Food:'#f5576c',Coffee:'#f093fb',Transportation:'#4facfe',Entertainment:'#667eea',Shopping:'#43e97b',Bills:'#fccb90',Other:'#a18cd1'};
                const c = catColors[expense.category] || '#a18cd1';
                return `
                <div class="flex items-center justify-between p-4">
                    <div class="flex items-center space-x-4">
                        <div class="w-10 h-10 rounded-full flex items-center justify-center" style="background:${c}30">
                            <span style="color:${c};font-weight:600" class="text-sm">${expense.category.charAt(0)}</span>
                        </div>
                        <div>
                            <p class="font-medium " style="color:var(--md-sys-color-on-surface)">${expense.description}</p>
                            <p class="text-sm " style="color:var(--md-sys-color-outline)">${expense.category} • ${formatDate(expense.date)}</p>
                        </div>
                    </div>
                    <span class="font-semibold " style="color:var(--md-sys-color-on-surface-variant)">-${formatCurrency(expense.amount)}</span>
                </div>
            `}).join('')}
        `;
    }

    // ====================================================================
    // PRIVACY MODE FUNCTIONALITY
    // ====================================================================

    updateHistoryAnalytics() {
        console.log('updateHistoryAnalytics called');
        
        // Simple implementation for now
        const today = new Date();
        const currentMonth = today.getMonth() - this.currentHistoryOffset;
        const currentYear = today.getFullYear() + Math.floor(currentMonth / 12);
        const adjustedMonth = ((currentMonth % 12) + 12) % 12;

        console.log('Analyzing month:', adjustedMonth, 'year:', currentYear);

        // Update month navigation header
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                           'July', 'August', 'September', 'October', 'November', 'December'];
        const currentMonthEl = document.getElementById('history-current-month');
        if (currentMonthEl) {
            currentMonthEl.textContent = `${monthNames[adjustedMonth]} ${currentYear}`;
            console.log('Updated month header to:', monthNames[adjustedMonth], currentYear);
        }

        // Get current month expenses
        const monthExpenses = this.expenses.filter(expense => {
            const d = this.parseLocalDate(expense.date);
            return d.getMonth() === adjustedMonth && d.getFullYear() === currentYear;
        });

        console.log('Found expenses for current month:', monthExpenses.length, monthExpenses);

        const regularExpenses = monthExpenses.filter(e => !e.excludeFromBudget);
        const totalSpent = regularExpenses.reduce((sum, e) => sum + e.amount, 0);
        const activeDays = new Set(regularExpenses.map(e => e.date)).size;
        const dailyAvg = activeDays > 0 ? totalSpent / activeDays : 0;

        console.log('Regular expenses:', regularExpenses.length, 'Total:', totalSpent, 'Active days:', activeDays);

        // Update current month display
        const currentTotalEl = document.getElementById('history-current-total');
        const activeDaysEl = document.getElementById('history-active-days');
        const dailyAvgEl = document.getElementById('history-daily-avg');

        if (currentTotalEl) {
            currentTotalEl.textContent = formatCurrency(totalSpent);
            console.log('Updated current total to:', formatCurrency(totalSpent));
        }
        if (activeDaysEl) {
            activeDaysEl.textContent = `${activeDays} days`;
            console.log('Updated active days to:', activeDays);
        }
        if (dailyAvgEl) {
            dailyAvgEl.textContent = `${formatCurrency(dailyAvg)}/day`;
            console.log('Updated daily avg to:', formatCurrency(dailyAvg));
        }

        // Get previous month for comparison
        const prevMonth = adjustedMonth - 1;
        const prevYear = prevMonth < 0 ? currentYear - 1 : currentYear;
        const adjustedPrevMonth = prevMonth < 0 ? 11 : prevMonth;

        const prevMonthExpenses = this.expenses.filter(expense => {
            const d = this.parseLocalDate(expense.date);
            return d.getMonth() === adjustedPrevMonth && d.getFullYear() === prevYear;
        });

        console.log('Found expenses for previous month:', prevMonthExpenses.length, prevMonthExpenses);

        const prevRegularExpenses = prevMonthExpenses.filter(e => !e.excludeFromBudget);
        const prevTotalSpent = prevRegularExpenses.reduce((sum, e) => sum + e.amount, 0);

        // Update previous month display
        const prevTotalEl = document.getElementById('history-prev-total');
        const changePercentEl = document.getElementById('history-change-percent');

        if (prevTotalEl) {
            prevTotalEl.textContent = formatCurrency(prevTotalSpent);
            console.log('Updated prev total to:', formatCurrency(prevTotalSpent));
        }
        
        if (changePercentEl && prevTotalSpent > 0) {
            const change = ((totalSpent - prevTotalSpent) / prevTotalSpent) * 100;
            const isPositive = change >= 0;
            changePercentEl.textContent = `${isPositive ? '+' : ''}${change.toFixed(1)}%`;
            changePercentEl.style.color = isPositive ? '#cf6679' : '#43e97b'; // Red for increase, green for decrease
            console.log('Updated change percent to:', change.toFixed(1) + '%');
        } else if (changePercentEl) {
            changePercentEl.textContent = '—';
            changePercentEl.style.color = 'var(--md-sys-color-on-surface)';
        }

        console.log('History analytics update completed');
        
        // Update category grid
        this.updateCategoryGrid(monthExpenses, adjustedMonth, currentYear);
        
        // Update year overview
        this.updateYearOverview();
        
        // Update category distribution
        this.updateCategoryDistribution();
    }

    updateCategoryGrid(monthExpenses, month, year) {
        const container = document.getElementById('history-category-grid');
        if (!container) return;

        const categoryColors = {
            Food: '#f5576c', Coffee: '#f093fb', Transportation: '#4facfe',
            Entertainment: '#667eea', Shopping: '#43e97b', Bills: '#fccb90', Other: '#a18cd1'
        };

        // Group expenses by category (only regular expenses)
        const regularExpenses = monthExpenses.filter(e => !e.excludeFromBudget);
        const categories = {};
        
        regularExpenses.forEach(expense => {
            if (!categories[expense.category]) {
                categories[expense.category] = { amount: 0, count: 0, merchants: {} };
            }
            categories[expense.category].amount += expense.amount;
            categories[expense.category].count++;
            
            if (!categories[expense.category].merchants[expense.description]) {
                categories[expense.category].merchants[expense.description] = 0;
            }
            categories[expense.category].merchants[expense.description]++;
        });

        const sortedCategories = Object.entries(categories)
            .sort(([,a], [,b]) => b.amount - a.amount)
            .slice(0, 6); // Show top 6 categories

        console.log('Categories for month', month, ':', sortedCategories.map(([cat, data]) => `${cat}: ${formatCurrency(data.amount)}`));

        if (sortedCategories.length === 0) {
            container.innerHTML = '<div class="text-center py-8 text-sm" style="color:var(--md-sys-color-outline)">No expenses this month</div>';
            return;
        }

        container.innerHTML = sortedCategories.map(([category, data]) => {
            const color = categoryColors[category] || '#a18cd1';
            
            // Get top 2 merchants for this category
            const topMerchants = Object.entries(data.merchants)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 2)
                .map(([merchant]) => merchant);
            
            const merchantText = topMerchants.length > 0 ? topMerchants.join(', ') : 'Various merchants';

            return `
                <div class="card p-3 cursor-pointer transition-all hover:bg-opacity-80" onclick="showCategoryDetail('${category}')" style="border-left: 3px solid ${color}">
                    <div class="flex justify-between items-center">
                        <div class="flex items-center gap-2">
                            <div class="w-6 h-6 rounded-full flex items-center justify-center" style="background:${color}30">
                                <span style="color:${color};font-weight:600" class="text-xs">${category.charAt(0)}</span>
                            </div>
                            <div>
                                <h4 class="font-medium text-sm" style="color:var(--md-sys-color-on-surface)">${category}</h4>
                                <p class="text-xs" style="color:var(--md-sys-color-outline)">${data.count} transaction${data.count !== 1 ? 's' : ''}</p>
                            </div>
                        </div>
                        <span class="text-lg font-bold" style="color:var(--md-sys-color-on-surface)">${formatCurrency(data.amount)}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    updateYearOverview() {
        const currentYear = new Date().getFullYear();
        const yearData = this.getYearData(currentYear);

        // Update 4-pill summary
        const totalSpentEl = document.getElementById('year-total-spent');
        const avgMonthEl = document.getElementById('year-avg-month');
        const savedEl = document.getElementById('year-saved');
        const activeMonthsEl = document.getElementById('year-active-months');

        if (totalSpentEl) totalSpentEl.textContent = formatCurrency(yearData.totalSpent);
        if (avgMonthEl) avgMonthEl.textContent = formatCurrency(yearData.avgPerMonth);
        if (savedEl) savedEl.textContent = formatCurrency(yearData.totalSaved);
        if (activeMonthsEl) activeMonthsEl.textContent = `${yearData.activeMonths} mos`;

        // Update monthly breakdown - only show months up to current month
        const container = document.getElementById('year-monthly-breakdown');
        if (!container) return;

        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                           'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const currentMonth = new Date().getMonth();

        // Only show months from January up to current month
        const monthsToShow = yearData.months.slice(0, currentMonth + 1);

        container.innerHTML = monthsToShow.map((monthData, index) => {
            const isCurrentMonth = index === currentMonth;
            const barWidth = yearData.maxAmount > 0 ? (monthData.amount / yearData.maxAmount) * 100 : 0;

            return `
                <div class="flex items-center justify-between py-2">
                    <span class="text-sm font-medium w-8" style="color:var(--md-sys-color-on-surface)">${monthNames[index]}${isCurrentMonth ? '*' : ''}</span>
                    <div class="flex-1 mx-3">
                        <div class="w-full h-2 rounded-full" style="background:rgba(255,255,255,0.08)">
                            <div class="h-2 rounded-full transition-all duration-300" 
                                 style="width:${barWidth}%;background:var(--md-sys-color-primary)"></div>
                        </div>
                    </div>
                    <span class="text-sm font-medium w-12 text-right" style="color:var(--md-sys-color-on-surface)">
                        ${formatCurrency(monthData.amount)}
                    </span>
                </div>
            `;
        }).join('');
    }

    getYearData(year) {
        const currentMonth = new Date().getMonth();
        
        // Only calculate data for months up to current month
        const months = Array.from({length: 12}, (_, i) => {
            const monthExpenses = this.expenses.filter(expense => {
                const d = this.parseLocalDate(expense.date);
                return d.getMonth() === i && d.getFullYear() === year;
            });
            const regularExpenses = monthExpenses.filter(e => !e.excludeFromBudget);
            const amount = regularExpenses.reduce((sum, e) => sum + e.amount, 0);
            return { amount, count: regularExpenses.length };
        });

        // Only consider reached months for calculations
        const reachedMonths = months.slice(0, currentMonth + 1);
        const totalSpent = reachedMonths.reduce((sum, m) => sum + m.amount, 0);
        const activeMonths = reachedMonths.filter(m => m.amount > 0).length;
        const avgPerMonth = activeMonths > 0 ? totalSpent / activeMonths : 0;
        
        // Max amount only from reached months for proper bar scaling
        const maxAmount = Math.max(...reachedMonths.map(m => m.amount), 0);

        // Calculate total saved — sum of (per-month income) for reached active months minus total spent
        const reachedIncome = reachedMonths.reduce((sum, m, i) => {
            return m.amount > 0 ? sum + this.getIncomeFor(year, i) : sum;
        }, 0);
        const totalSaved = Math.max(0, reachedIncome - totalSpent);

        return { months, totalSpent, activeMonths, avgPerMonth, maxAmount, totalSaved };
    }

    updateCategoryDistribution() {
        const container = document.getElementById('category-distribution');
        if (!container) return;

        const isMonthView = this.categoryDistributionView === 'month';
        const data = isMonthView ? this.getCurrentMonthCategories() : this.getYearCategories();

        if (data.length === 0) {
            container.innerHTML = '<div class="text-center py-6 text-sm" style="color:var(--md-sys-color-outline)">No data available</div>';
            return;
        }

        const maxAmount = Math.max(...data.map(d => d.amount));

        container.innerHTML = data.map(category => {
            const percentage = maxAmount > 0 ? (category.amount / maxAmount) * 100 : 0;
            return `
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3 flex-1">
                        <span class="text-sm font-medium w-16" style="color:var(--md-sys-color-on-surface)">${category.name}</span>
                        <div class="flex-1">
                            <div class="w-full h-2 rounded-full" style="background:rgba(255,255,255,0.08)">
                                <div class="h-2 rounded-full transition-all duration-300" 
                                     style="width:${percentage}%;background:var(--md-sys-color-primary)"></div>
                            </div>
                        </div>
                    </div>
                    <span class="text-sm font-medium ml-3" style="color:var(--md-sys-color-on-surface)">${formatCurrency(category.amount)}</span>
                </div>
            `;
        }).join('');
    }

    getCurrentMonthCategories() {
        const today = new Date();
        const currentMonth = today.getMonth() - this.currentHistoryOffset;
        const currentYear = today.getFullYear() + Math.floor(currentMonth / 12);
        const adjustedMonth = ((currentMonth % 12) + 12) % 12;
        
        const monthExpenses = this.expenses.filter(expense => {
            const d = this.parseLocalDate(expense.date);
            return d.getMonth() === adjustedMonth && d.getFullYear() === currentYear;
        });

        const regularExpenses = monthExpenses.filter(e => !e.excludeFromBudget);
        const categories = {};
        
        regularExpenses.forEach(expense => {
            if (!categories[expense.category]) categories[expense.category] = 0;
            categories[expense.category] += expense.amount;
        });

        return Object.entries(categories)
            .map(([name, amount]) => ({ name, amount }))
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 4);
    }

    getYearCategories() {
        const currentYear = new Date().getFullYear();
        const categories = {};

        this.expenses.forEach(expense => {
            const d = this.parseLocalDate(expense.date);
            if (d.getFullYear() === currentYear && !expense.excludeFromBudget) {
                if (!categories[expense.category]) categories[expense.category] = 0;
                categories[expense.category] += expense.amount;
            }
        });

        return Object.entries(categories)
            .map(([name, amount]) => ({ name, amount }))
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 4);
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

        // Update title with correct period
        const titleElement = document.getElementById('trends-title');
        if (titleElement) {
            if (period === 'week') {
                const weekLabel = this.currentTrendsOffset === 0 ? 'This Week' : 
                                 this.currentTrendsOffset === 1 ? 'Last Week' : 
                                 `${this.currentTrendsOffset} weeks ago`;
                titleElement.textContent = `Daily Spending (${weekLabel})`;
            } else {
                const monthLabel = this.currentTrendsOffset === 0 ? 'This Month' : 
                                  this.currentTrendsOffset === 1 ? 'Last Month' : 
                                  `${this.currentTrendsOffset} months ago`;
                titleElement.textContent = `Daily Spending (${monthLabel})`;
            }
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
            // Calculate week based on offset (0 = current week, 1 = last week, etc.)
            const dayOfWeek = today.getDay();
            startDate = new Date(today);
            startDate.setDate(today.getDate() - dayOfWeek - (this.currentTrendsOffset * 7));
            endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 6);
            
            // Generate 7 days for the week
            for (let i = 0; i < 7; i++) {
                const date = new Date(startDate);
                date.setDate(startDate.getDate() + i);
                days.push(this.getDaySpendingData(date));
            }
        } else {
            // Calculate month based on offset (0 = current month, 1 = last month, etc.)
            const targetMonth = today.getMonth() - this.currentTrendsOffset;
            const targetYear = today.getFullYear() + Math.floor(targetMonth / 12);
            const adjustedMonth = ((targetMonth % 12) + 12) % 12;
            
            startDate = new Date(targetYear, adjustedMonth, 1);
            endDate = new Date(targetYear, adjustedMonth + 1, 0);
            
            // Generate all days in the target month
            const daysInMonth = endDate.getDate();
            for (let i = 1; i <= daysInMonth; i++) {
                const date = new Date(targetYear, adjustedMonth, i);
                days.push(this.getDaySpendingData(date));
            }
        }

        // Find max amount for percentage calculation
        const maxAmount = Math.max(...days.map(day => day.amount), 0);

        return { days, maxAmount, startDate, endDate };
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
        const parts = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (parts) return new Date(parseInt(parts[1]), parseInt(parts[2])-1, parseInt(parts[3]));
        const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})T/);
        if (iso) return new Date(parseInt(iso[1]), parseInt(iso[2])-1, parseInt(iso[3]));
        return new Date(s);
    }

    getRegularMonthExpenses(year, month) {
        return this.expenses.filter(e => {
            if (e.tripId != null) return false;
            if (e.excludeFromBudget) return false;
            const d = this.parseLocalDate(e.date);
            return d.getFullYear() === year && d.getMonth() === month;
        });
    }

    getTripExpenses(tripId) {
        return this.expenses.filter(e => e.tripId === tripId);
    }

    getMonthCombinedExpenses(year, month) {
        return this.expenses.filter(e => {
            const d = this.parseLocalDate(e.date);
            return d.getFullYear() === year && d.getMonth() === month;
        });
    }

    animateCount(el, target) {
        const duration = 600;
        const start = parseInt(el.textContent.replace(/[^0-9]/g,'')) || 0;
        if (start === target) { el.textContent = '$' + target; return; }
        const t0 = performance.now();
        const step = (now) => {
            const p = Math.min((now - t0) / duration, 1);
            const ease = 1 - Math.pow(1 - p, 3);
            el.textContent = '$' + Math.round(start + (target - start) * ease);
            if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
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
            // Get 4 weeks based on offset (0 = current 4 weeks, 1 = previous 4 weeks, etc.)
            const baseOffset = this.currentTrendsOffset * 4;
            for (let i = 3; i >= 0; i--) {
                const weekStart = new Date(today);
                weekStart.setDate(today.getDate() - (today.getDay()) - ((i + baseOffset) * 7));
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekStart.getDate() + 6);
                
                weeks.push(this.getWeekSpendingData(weekStart, weekEnd));
            }
        } else {
            // Get all weeks in target month based on offset
            const targetMonth = today.getMonth() - this.currentTrendsOffset;
            const targetYear = today.getFullYear() + Math.floor(targetMonth / 12);
            const adjustedMonth = ((targetMonth % 12) + 12) % 12;
            
            // Start from the first day of the target month
            let weekStart = new Date(targetYear, adjustedMonth, 1);
            
            // Adjust to start from Sunday
            weekStart.setDate(weekStart.getDate() - weekStart.getDay());
            
            while (weekStart.getMonth() <= adjustedMonth || weekStart.getDate() === 1) {
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekStart.getDate() + 6);
                
                // Only include weeks that have days in target month
                if (weekStart.getMonth() === adjustedMonth || weekEnd.getMonth() === adjustedMonth) {
                    weeks.push(this.getWeekSpendingData(weekStart, weekEnd));
                }
                
                // Move to next week
                weekStart.setDate(weekStart.getDate() + 7);
                
                // Break if we've moved beyond target month
                if (weekStart.getMonth() > adjustedMonth && weekStart.getFullYear() >= targetYear) {
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
        const hidden = document.getElementById('category');
        const container = document.getElementById('category-pills');
        if (!hidden || !container) return;
        hidden.value = '';
        container.innerHTML = this.settings.categories.map(cat =>
            `<button type="button" class="category-pill px-3 py-1.5 rounded-full text-xs font-medium" style="border:1px solid rgba(255,255,255,0.12);color:var(--md-sys-color-outline);background:transparent" onclick="selectCategoryPill(this,'${cat}')">${cat}</button>`
        ).join('');
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

function selectCategoryPill(el, value) {
    document.querySelectorAll('.category-pill').forEach(p => { p.style.background = 'transparent'; p.style.color = 'var(--md-sys-color-outline)'; });
    el.style.background = 'var(--accent-gradient)'; el.style.color = 'white';
    document.getElementById('category').value = value;
}

function switchTrendsView(view) {
    expenseTracker.currentTrendsView = view;
    expenseTracker.currentTrendsOffset = 0; // Reset to current period when switching views
    
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
    if (!countEl || !labelEl) return;

    const days = this.calculateFoodStreak();
    countEl.textContent = days;

    if (days === 0) {
        labelEl.textContent = 'Start your streak today';
    } else {
        labelEl.textContent = 'days without eating out';
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
    const fourWeeksAgo = new Date(now); fourWeeksAgo.setDate(now.getDate() - 14);
    const twoWeeksAgo = new Date(now); twoWeeksAgo.setDate(now.getDate() - 7);

    // Rolling 2-week window
    const last4Weeks = this.expenses.filter(e => {
        const d = this.parseLocalDate(e.date);
        return d >= fourWeeksAgo && d <= now;
    });

    const totalSpent = last4Weeks.reduce((s, e) => s + e.amount, 0);
    const dailyAvg = totalSpent / 14;

    // Week-over-week: recent 2 weeks vs prior 2 weeks
    const recentHalf = last4Weeks.filter(e => this.parseLocalDate(e.date) >= twoWeeksAgo);
    const priorHalf = last4Weeks.filter(e => this.parseLocalDate(e.date) < twoWeeksAgo);
    const recentTotal = recentHalf.reduce((s, e) => s + e.amount, 0);
    const priorTotal = priorHalf.reduce((s, e) => s + e.amount, 0);

    // Day of week breakdown
    const dayTotals = [0,0,0,0,0,0,0], dayCounts = [0,0,0,0,0,0,0];
    last4Weeks.forEach(e => {
        const dow = this.parseLocalDate(e.date).getDay();
        dayTotals[dow] += e.amount;
        dayCounts[dow]++;
    });
    const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const dayAvgs = dayTotals.map((t, i) => ({ day: dayNames[i], avg: dayCounts[i] ? t / dayCounts[i] : 0 }));
    const topDay = dayAvgs.reduce((a, b) => b.avg > a.avg ? b : a);

    // Top categories
    const catTotals = {};
    last4Weeks.forEach(e => { catTotals[e.category] = (catTotals[e.category] || 0) + e.amount; });
    const topCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]).slice(0, 3)
        .map(([name, amount]) => ({ name, amount: Math.round(amount) }));

    // This week vs last week
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay());
    const lastWeekStart = new Date(weekStart); lastWeekStart.setDate(weekStart.getDate() - 7);
    const thisWeek = last4Weeks.filter(e => this.parseLocalDate(e.date) >= weekStart).reduce((s, e) => s + e.amount, 0);
    const lastWeek = last4Weeks.filter(e => { const d = this.parseLocalDate(e.date); return d >= lastWeekStart && d < weekStart; }).reduce((s, e) => s + e.amount, 0);

    const budget = this.settings.monthlyBudget || 0;
    const streak = this.calculateFoodStreak();

    return {
        totalSpent: Math.round(totalSpent),
        dailyAvg: Math.round(dailyAvg),
        weeklyAvg: Math.round(totalSpent / 2),
        recentTwoWeeks: Math.round(recentTotal),
        priorTwoWeeks: Math.round(priorTotal),
        topSpendingDay: topDay.avg > 0 ? { day: topDay.day, avg: Math.round(topDay.avg) } : null,
        topCategories: topCats,
        thisWeek: Math.round(thisWeek),
        lastWeek: Math.round(lastWeek),
        budget,
        noEatOutStreak: streak,
        transactionCount: last4Weeks.length
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

    // Only fetch once per session — cache or fetch on first call, skip all subsequent
    if (this._insightsDone) return;
    this._insightsDone = true;

    // Cache: refresh only once per day (stored in localStorage to survive reloads)
    const today = new Date().toDateString();
    const cached = localStorage.getItem('insights_cache');
    if (cached) {
        try {
            const { date, html } = JSON.parse(cached);
            if (date === today) {
                container.innerHTML = html;
                const badge = document.getElementById('insights-badge');
                if (badge) { badge.textContent = 'AI'; badge.style.background = 'linear-gradient(135deg,rgba(102,126,234,0.15),rgba(118,75,162,0.15))'; badge.style.color = 'var(--md-sys-color-primary)'; }
                return;
            }
        } catch (e) {}
    }

    const badge = document.getElementById('insights-badge');
    this.fetchGeminiInsights(summary).then(insights => {
        const html = this.formatInsights(insights);
        container.innerHTML = html;
        localStorage.setItem('insights_cache', JSON.stringify({ date: today, html }));
        if (badge) { badge.textContent = 'AI'; badge.style.background = 'linear-gradient(135deg,rgba(102,126,234,0.15),rgba(118,75,162,0.15))'; badge.style.color = 'var(--md-sys-color-primary)'; }
    }).catch((err) => {
        console.warn('Gemini insights failed:', err.message);
        const html = this.formatInsights(this.templateInsights(summary));
        container.innerHTML = html;
        if (badge) { badge.textContent = 'Local'; badge.style.background = 'rgba(255,255,255,0.06)'; badge.style.color = 'var(--md-sys-color-outline)'; }
        this._insightsFetching = false;
    });
};

ExpenseTracker.prototype.fetchGeminiInsights = async function(summary) {
    const prompt = `You're a supportive but honest personal spending coach. Based on this rolling 2-week spending data, give exactly 3 short behavioral insights (1-2 sentences each). Be specific with dollar amounts. Focus on patterns the user can act on. No generic advice. No bullet points or numbering — just 3 separate observations.

Data (last 2 weeks):
- Total spent: $${summary.totalSpent} across ${summary.transactionCount} transactions
- Daily average: $${summary.dailyAvg}, Weekly average: $${summary.weeklyAvg}
- Recent 2 weeks: $${summary.recentTwoWeeks}, Prior 2 weeks: $${summary.priorTwoWeeks}
- This week: $${summary.thisWeek}, Last week: $${summary.lastWeek}${summary.budget ? `\n- Monthly budget: $${summary.budget}` : ''}
- Top categories: ${summary.topCategories.map(c => c.name + ' $' + c.amount).join(', ')}
${summary.topSpendingDay ? `- Highest spending day: ${summary.topSpendingDay.day} (avg $${summary.topSpendingDay.avg})` : ''}
- Days without eating out: ${summary.noEatOutStreak}

Return ONLY a JSON array of 3 strings. Example: ["insight 1", "insight 2", "insight 3"]`;

    // Get API key: memory cache → localStorage → Firestore
    let apiKey = this._geminiKey || localStorage.getItem('gemini_api_key') || '';
    if (!apiKey && window.firebaseDb) {
        try {
            const doc = await window.firebaseDb.collection('users').doc('config').get();
            console.log('Firestore config doc:', doc.exists, doc.exists ? doc.data() : 'N/A');
            if (doc.exists && doc.data().geminiKey) {
                apiKey = doc.data().geminiKey;
                this._geminiKey = apiKey;
            }
        } catch (e) { console.warn('Failed to fetch API key from Firestore:', e.message); }
    }
    console.log('API key resolved:', apiKey ? `${apiKey.substring(0, 8)}...` : 'NONE');
    if (!apiKey) throw new Error('No API key available');

    // Daily call limit (max 15)
    const today = new Date().toDateString();
    const usage = JSON.parse(localStorage.getItem('gemini_usage') || '{}');
    if (usage.date !== today) { usage.date = today; usage.count = 0; }
    if (usage.count >= 15) throw new Error('Daily API limit reached (15)');

    for (let attempt = 0; attempt < 3; attempt++) {
        usage.count++;
        localStorage.setItem('gemini_usage', JSON.stringify(usage));
        const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.7, maxOutputTokens: 300 }
            })
        });

        if (resp.status === 429) {
            usage.count = 15; // Block further calls today
            localStorage.setItem('gemini_usage', JSON.stringify(usage));
            throw new Error('Rate limited (429) — paused for today');
        }

        if (!resp.ok) {
            const errBody = await resp.text();
            console.error('Gemini API response:', resp.status, errBody);
            throw new Error(`API error ${resp.status}`);
        }
        const data = await resp.json();
        const text = data.candidates[0].content.parts[0].text.trim();
        const match = text.match(/\[[\s\S]*\]/);
        return match ? JSON.parse(match[0]) : this.templateInsights(summary);
    }
    throw new Error('API error 429 after 3 retries');
};

ExpenseTracker.prototype.templateInsights = function(s) {
    const insights = [];

    // Weekly trend
    if (s.recentTwoWeeks > 0 && s.priorTwoWeeks > 0) {
        const pct = Math.round(((s.recentTwoWeeks - s.priorTwoWeeks) / s.priorTwoWeeks) * 100);
        insights.push(pct > 5
            ? `Your recent 2 weeks ($${s.recentTwoWeeks}) are ${pct}% higher than the prior 2 weeks. Worth checking where the extra is going.`
            : pct < -5
            ? `Spending dropped ${Math.abs(pct)}% in the recent 2 weeks ($${s.recentTwoWeeks} vs $${s.priorTwoWeeks}) — real progress.`
            : `Spending is steady across the last 2 weeks at ~$${s.weeklyAvg}/week.`);
    } else if (s.totalSpent > 0) {
        insights.push(`You've spent $${s.totalSpent} over the last 2 weeks — averaging $${s.dailyAvg}/day.`);
    }

    // Budget check
    if (s.budget && s.weeklyAvg > 0) {
        const monthProjection = s.weeklyAvg * 4.3;
        const diff = Math.round(monthProjection - s.budget);
        insights.push(diff > 0
            ? `At $${s.weeklyAvg}/week, you'd hit ~$${Math.round(monthProjection)} monthly — about $${diff} over budget.`
            : `At $${s.weeklyAvg}/week, you're pacing ~$${Math.abs(diff)} under your monthly budget.`);
    }

    // Top spending day or week-over-week
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

function toggleMonthlyReport() {
    const details = document.getElementById('monthly-report-details');
    const chevron = document.getElementById('report-chevron');
    if (!details) return;
    details.classList.toggle('hidden');
    if (chevron) chevron.style.transform = details.classList.contains('hidden') ? '' : 'rotate(180deg)';
}

function toggleSettingsDropdown(id, chevronId) {
    const el = document.getElementById(id);
    const ch = document.getElementById(chevronId);
    if (!el) return;
    el.classList.toggle('hidden');
    if (ch) ch.style.transform = el.classList.contains('hidden') ? '' : 'rotate(180deg)';
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

// Console helper — set income for a specific month (month is 1-12).
// Usage: setIncomeForMonth(2026, 1, 4000)  // January 2026 = 4000
//        setIncomeForMonth(2026, 1, null)  // remove override → falls back to default
window.setIncomeForMonth = (year, month, amount) =>
    expenseTracker.setIncomeOverride(year, month - 1, amount);

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

// Swipe gesture handling for transaction exclude/include
let touchStartX = 0;
let touchStartY = 0;
let isSwiping = false;

function handleTouchStart(event) {
    touchStartX = event.touches[0].clientX;
    touchStartY = event.touches[0].clientY;
    isSwiping = false;
}

function handleTouchMove(event) {
    if (!touchStartX || !touchStartY) return;
    
    const touchX = event.touches[0].clientX;
    const touchY = event.touches[0].clientY;
    const diffX = Math.abs(touchX - touchStartX);
    const diffY = Math.abs(touchY - touchStartY);
    
    // Only detect swipe if it's clearly horizontal and significant
    if (diffX > 50 && diffX > diffY * 2) {
        isSwiping = true;
        // Only prevent default if the event is cancelable
        if (event.cancelable) {
            event.preventDefault();
        }
    }
}

function handleTouchEnd(event) {
    if (!isSwiping) return;
    
    const expenseId = parseInt(event.currentTarget.dataset.expenseId);
    if (expenseId) {
        expenseTracker.toggleExcludeExpense(expenseId);
    }
    
    // Reset
    touchStartX = 0;
    touchStartY = 0;
    isSwiping = false;
}

// Trends navigation
function navigateTrends(direction) {
    if (direction === 'prev') {
        expenseTracker.currentTrendsOffset++;
    } else if (direction === 'next') {
        expenseTracker.currentTrendsOffset = Math.max(0, expenseTracker.currentTrendsOffset - 1);
    }
    
    // Update trends based on current view
    if (expenseTracker.currentTrendsView === 'daily') {
        expenseTracker.updateDailySpending('week');
    } else {
        expenseTracker.updateWeeklySpending('recent');
    }
}
// History navigation
function navigateHistoryMonth(direction) {
    if (direction === 'prev') {
        expenseTracker.currentHistoryOffset++;
    } else if (direction === 'next') {
        expenseTracker.currentHistoryOffset = Math.max(0, expenseTracker.currentHistoryOffset - 1);
    }
    
    expenseTracker.updateHistoryAnalytics();
}

// Category distribution toggle
function toggleCategoryView(view) {
    expenseTracker.categoryDistributionView = view;
    
    const monthBtn = document.getElementById('category-month-btn');
    const yearBtn = document.getElementById('category-year-btn');
    
    if (view === 'month') {
        monthBtn.style.background = 'var(--md-sys-color-primary)';
        monthBtn.style.color = 'white';
        yearBtn.style.background = 'transparent';
        yearBtn.style.color = 'var(--md-sys-color-outline)';
    } else {
        yearBtn.style.background = 'var(--md-sys-color-primary)';
        yearBtn.style.color = 'white';
        monthBtn.style.background = 'transparent';
        monthBtn.style.color = 'var(--md-sys-color-outline)';
    }
    
    expenseTracker.updateCategoryDistribution();
}

// Category detail view - show transactions for selected category
function showCategoryDetail(category) {
    console.log('Show detail for category:', category);
    
    // Get current month expenses for this category
    const today = new Date();
    const currentMonth = today.getMonth() - expenseTracker.currentHistoryOffset;
    const currentYear = today.getFullYear() + Math.floor(currentMonth / 12);
    const adjustedMonth = ((currentMonth % 12) + 12) % 12;
    
    const categoryExpenses = expenseTracker.expenses.filter(expense => {
        const d = expenseTracker.parseLocalDate(expense.date);
        return d.getMonth() === adjustedMonth && 
               d.getFullYear() === currentYear && 
               expense.category === category;
    });
    
    // Create a simple modal to show transactions
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];
    
    const modalHtml = `
        <div id="category-detail-modal" class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background:rgba(0,0,0,0.7)" onclick="if(event.target===this) closeCategoryDetail()">
            <div class="w-full max-w-md rounded-3xl overflow-hidden" style="background:var(--md-sys-color-surface-container-high);box-shadow:0 24px 38px 3px rgba(0,0,0,0.14),0 9px 46px 8px rgba(0,0,0,0.12),0 11px 15px -7px rgba(0,0,0,0.2)">
                <!-- Header -->
                <div class="p-6 pb-4" style="background:linear-gradient(135deg,#667eea,#764ba2)">
                    <div class="flex justify-between items-center">
                        <div>
                            <h3 class="text-xl font-bold text-white">${category}</h3>
                            <p class="text-white text-opacity-90 text-sm">${monthNames[adjustedMonth]} ${currentYear}</p>
                        </div>
                        <button onclick="closeCategoryDetail()" class="p-2 rounded-full text-white hover:bg-white hover:bg-opacity-20 transition-colors">
                            <span class="material-symbols-rounded text-xl">close</span>
                        </button>
                    </div>
                </div>
                
                <!-- Summary -->
                <div class="px-6 py-4" style="background:var(--md-sys-color-surface-container)">
                    <div class="grid grid-cols-2 gap-4">
                        <div class="text-center">
                            <p class="text-2xl font-bold" style="color:var(--md-sys-color-on-surface)">${formatCurrency(categoryExpenses.reduce((sum, e) => sum + e.amount, 0))}</p>
                            <p class="text-xs" style="color:var(--md-sys-color-outline)">Total Spent</p>
                        </div>
                        <div class="text-center">
                            <p class="text-2xl font-bold" style="color:var(--md-sys-color-on-surface)">${categoryExpenses.length}</p>
                            <p class="text-xs" style="color:var(--md-sys-color-outline)">Transaction${categoryExpenses.length !== 1 ? 's' : ''}</p>
                        </div>
                    </div>
                </div>
                
                <!-- Transactions -->
                <div class="px-6 pb-6">
                    <h4 class="font-semibold mb-3 text-sm" style="color:var(--md-sys-color-on-surface)">Recent Transactions</h4>
                    <div class="space-y-2 max-h-64 overflow-y-auto">
                        ${categoryExpenses.length === 0 ? 
                            '<div class="text-center py-8 text-sm" style="color:var(--md-sys-color-outline)">No transactions in this category</div>' :
                            categoryExpenses.slice(0, 10).map(expense => `
                                <div class="flex justify-between items-center p-3 rounded-xl" style="background:var(--md-sys-color-surface-container)">
                                    <div class="flex-1">
                                        <p class="font-medium text-sm" style="color:var(--md-sys-color-on-surface)">${expense.description}</p>
                                        <p class="text-xs" style="color:var(--md-sys-color-outline)">${new Date(expense.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                                    </div>
                                    <span class="font-bold text-sm ml-3" style="color:var(--md-sys-color-on-surface)">${formatCurrency(expense.amount)}</span>
                                </div>
                            `).join('')
                        }
                        ${categoryExpenses.length > 10 ? 
                            `<div class="text-center py-2 text-xs" style="color:var(--md-sys-color-outline)">Showing 10 of ${categoryExpenses.length} transactions</div>` : 
                            ''
                        }
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function closeCategoryDetail() {
    const modal = document.getElementById('category-detail-modal');
    if (modal) {
        modal.remove();
    }
}

// ====================================================================
// TRACK A — Home page renderers
// ====================================================================

ExpenseTracker.prototype.renderHomeGreeting = function (now) {
    const root = document.querySelector('#dashboard-page .greeting');
    if (!root) return;
    const hour = now.getHours();
    const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const name = (window.currentUser && window.currentUser.displayName) ? window.currentUser.displayName.split(' ')[0] : 'there';
    const dayLabel = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    root.querySelector('.hi').innerHTML = `${greet}, <em>${this._escapeHtml(name)}</em>`;
    root.querySelector('.day').textContent = dayLabel.replace(',', ' ·').toUpperCase();
};
ExpenseTracker.prototype._escapeHtml = function (s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
};

ExpenseTracker.prototype.renderHomeMonthHero = function (ctx) {
    const root = document.getElementById('home-month-hero');
    if (!root) return;
    const { monthName, year, dayOfMonth, daysInMonth, daysLeft, monthTotalRegular, todayTotal, avgPerDay, aim, tripExpensesThisMonth, SOFT, HARD } = ctx;
    const fillPct = Math.min(100, (monthTotalRegular / HARD) * 100);
    const softLeftPct = (SOFT / HARD) * 100;
    const overSoft = aim.state === 'HARD_OVER' || aim.state === 'SOFT_OVER';
    const ofText = overSoft
        ? `over <strong>$${SOFT.toLocaleString()}</strong> soft target<br><span style="opacity:.6">aim $${aim.dailyTotal}/day to stay under $${HARD}</span>`
        : `of <strong>$${SOFT.toLocaleString()}</strong> soft target<br><span style="opacity:.6">$${(SOFT - monthTotalRegular).toLocaleString()} left</span>`;
    const compositionLine = tripExpensesThisMonth > 0
        ? `<div class="month-composition">+ $${tripExpensesThisMonth.toLocaleString()} on trips · TOTAL $${(monthTotalRegular + tripExpensesThisMonth).toLocaleString()}</div>` : '';
    const forecastLine = window.Forecast
        ? `<div class="month-forecast">${window.Forecast.display(monthName, monthTotalRegular, dayOfMonth, daysInMonth)}</div>` : '';
    const lastSync = this._gmailLastSyncedLabel();

    root.innerHTML = `
<div class="month-hero">
    <div class="month-eyebrow"><span class="material-symbols-rounded">calendar_month</span> Monthly view</div>
    <div class="month-name">${monthName}<span class="year">${year}</span></div>
    <div class="month-sub">
        <div class="month-day-pill">DAY ${dayOfMonth} / ${daysInMonth}</div>
        <div class="month-meta">${daysLeft} days left this month</div>
    </div>
    <div class="month-numbers">
        <div class="month-spent"><span class="currency">$</span>${Math.round(monthTotalRegular).toLocaleString()}</div>
        <div class="month-of">${ofText}</div>
    </div>
    <div class="cap-bar">
        <div class="fill" style="width:${fillPct}%"></div>
        <div class="marker-soft" style="left:${softLeftPct}%"></div>
        <div class="marker-hard"></div>
    </div>
    <div class="month-pace">
        <div class="pace-cell"><div class="label">Today's spend</div><div class="value">$${Math.round(todayTotal)}</div></div>
        <div class="pace-cell"><div class="label">Avg / day</div><div class="value">$${avgPerDay}</div></div>
        <div class="pace-cell aim"><div class="label">Aim today</div><div class="value">$${aim.dailyTotal}</div></div>
    </div>
    ${forecastLine}
    ${compositionLine}
    <div class="cta-row">
        <button class="cta-primary" onclick="showPage('add-expense')"><span class="material-symbols-rounded">add</span> Add</button>
        <button class="cta-secondary" onclick="onAutoAddTap()"><span class="material-symbols-rounded">bolt</span> Auto add</button>
    </div>
    <div class="sync-status"><span class="sync-dot"></span> ${lastSync}</div>
</div>`;
};

ExpenseTracker.prototype._gmailLastSyncedLabel = function () {
    const ts = localStorage.getItem('gmail_last_synced');
    if (!ts) return 'Never synced';
    const d = new Date(ts);
    return `Synced ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
};

window.onAutoAddTap = window.onAutoAddTap || function () {
    if (window.emailParser && typeof window.emailParser.sync === 'function') window.emailParser.sync();
};

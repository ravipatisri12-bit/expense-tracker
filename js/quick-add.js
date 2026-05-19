/**
 * Quick Add Component - Venmo-style expense entry
 */

class QuickAdd {
    constructor(expenseTracker) {
        this.tracker = expenseTracker;
        this.selectedDate = new Date();
        this.selectedCategory = null;
        this.init();
    }

    init() {
        this.renderCategories();
        this.selectedDate = new Date();
        const dateStr = this.selectedDate.toISOString().split('T')[0];
        const hiddenInput = safeGetElement('quick-date');
        if (hiddenInput) hiddenInput.value = dateStr;
    }

    renderCategories() {
        const scroller = safeGetElement('category-scroller');
        if (!scroller) return;

        const categories = this.tracker.settings.categories;
        const colors = {
            'Food': '#f5576c',
            'Coffee': '#f093fb',
            'Transportation': '#4facfe',
            'Entertainment': '#667eea',
            'Shopping': '#43e97b',
            'Bills': '#fccb90',
            'Other': '#a18cd1'
        };

        scroller.innerHTML = categories.map(cat => `
            <button class="category-chip" 
                    data-category="${cat}"
                    style="background:${colors[cat]}19;color:${colors[cat]}"
                    onclick="selectCategory('${cat}')">
                ${cat}
            </button>
        `).join('');
    }
}

// Global functions for onclick handlers
function switchAddTab(tab) {
    const quickTab = document.getElementById('quick-add-tab');
    const batchTab = document.getElementById('batch-add-tab');
    const quickSection = document.getElementById('quick-add-section');
    const batchSection = document.getElementById('batch-add-section');

    if (tab === 'quick') {
        quickTab.classList.add('active');
        batchTab.classList.remove('active');
        quickSection.classList.remove('hidden');
        batchSection.classList.add('hidden');
    } else {
        batchTab.classList.add('active');
        quickTab.classList.remove('active');
        batchSection.classList.remove('hidden');
        quickSection.classList.add('hidden');
    }
}

function focusAmountInput() {
    const input = document.getElementById('quick-amount');
    if (input) input.focus();
}

function toggleDatePicker() {
    const dropdown = document.getElementById('date-picker-dropdown');
    if (!dropdown) return;
    
    dropdown.classList.toggle('hidden');
}

function selectDate(type) {
    const dateLabel = document.getElementById('date-label');
    const hiddenInput = document.getElementById('quick-date');
    const dropdown = document.getElementById('date-picker-dropdown');
    
    if (!dateLabel || !hiddenInput) return;
    
    let date = new Date();
    let labelText = '';
    
    if (type === 'yesterday') {
        date.setDate(date.getDate() - 1);
        labelText = 'Yesterday';
    } else if (type === 'today') {
        labelText = 'Today';
    } else if (type === 'custom') {
        hiddenInput.showPicker();
        hiddenInput.addEventListener('change', function() {
            const selectedDate = new Date(this.value + 'T00:00:00');
            dateLabel.textContent = selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            if (window.quickAddInstance) {
                window.quickAddInstance.selectedDate = selectedDate;
            }
        }, { once: true });
        if (dropdown) dropdown.classList.add('hidden');
        return;
    }
    
    const dateStr = date.toISOString().split('T')[0];
    hiddenInput.value = dateStr;
    dateLabel.textContent = labelText;
    
    if (window.quickAddInstance) {
        window.quickAddInstance.selectedDate = date;
    }
    
    if (dropdown) dropdown.classList.add('hidden');
}

// Close dropdown when clicking outside
document.addEventListener('click', function(e) {
    const dropdown = document.getElementById('date-picker-dropdown');
    const dateChip = document.querySelector('.detail-chip');
    if (dropdown && !dropdown.contains(e.target) && e.target !== dateChip && !dateChip?.contains(e.target)) {
        dropdown.classList.add('hidden');
    }
});

function selectCategory(category) {
    const chips = document.querySelectorAll('.category-chip');
    chips.forEach(chip => chip.classList.remove('active'));
    
    const selectedChip = document.querySelector(`[data-category="${category}"]`);
    if (selectedChip) {
        selectedChip.classList.add('active');
    }
    
    if (window.quickAddInstance) {
        window.quickAddInstance.selectedCategory = category;
    }
}

async function submitQuickAdd() {
    if (!window.expenseTracker || !window.quickAddInstance) return;
    
    const amount = parseFloat(document.getElementById('quick-amount').value);
    const description = document.getElementById('quick-description').value || 'Expense';
    const dateInput = document.getElementById('quick-date').value;
    
    if (!amount || amount <= 0) {
        showNotification('Please enter an amount', 'error');
        return;
    }
    
    if (!window.quickAddInstance.selectedCategory) {
        showNotification('Please select a category', 'error');
        return;
    }
    
    const expense = {
        id: window.expenseTracker ? window.expenseTracker.nextExpenseId() : Date.now(),
        amount: amount,
        description: description,
        category: window.quickAddInstance.selectedCategory,
        date: dateInput,
        timestamp: Date.now()
    };
    
    // Add to tracker
    window.expenseTracker.expenses.push(expense);
    window.expenseTracker.saveExpenses();
    
    if (window.currentUser) {
        await window.expenseTracker.saveExpenseToFirebase(expense);
    }
    
    window.expenseTracker.updateDashboard();
    window.expenseTracker.renderTransactions();
    
    // Clear form
    document.getElementById('quick-amount').value = '';
    document.getElementById('quick-description').value = '';
    selectDate('today');
    
    const chips = document.querySelectorAll('.category-chip');
    chips.forEach(chip => chip.classList.remove('active'));
    window.quickAddInstance.selectedCategory = null;
    
    showNotification('Expense added!', 'success');
    
    // Redirect to dashboard
    window.expenseTracker.showPage('dashboard');
}

function openAntiPortfolioQuickAdd() {
    // Placeholder for Task 7
    showNotification('Anti-Portfolio coming soon!', 'info');
}

/* Glass UI Expense Tracker - Interactive JavaScript */

class ExpenseTracker {
    constructor() {
        this.expenses = [];
        this.settings = {};
        this.currentPage = 'home';
        this.storageAvailable = true; // Track if localStorage is available
        this.init();
    }

    init() {
        // Check localStorage availability
        this.checkStorageAvailability();
        
        // Load data from localStorage
        this.expenses = this.loadExpenses();
        this.settings = this.loadSettings();
        
        // Setup UI
        this.setupEventListeners();
        this.setupTransactionsFilters();
        this.setupHistoryPageListeners();
        this.updateDashboard(); // Update all dashboard elements
        this.updateDateTime();
        this.setupTransactionAnimations();
        
        // Setup online/offline event listeners
        this.setupNetworkListeners();
        
        // Update time every minute
        setInterval(() => this.updateDateTime(), 60000);
    }
    
    checkStorageAvailability() {
        try {
            const testKey = '__storage_test__';
            localStorage.setItem(testKey, 'test');
            localStorage.removeItem(testKey);
            this.storageAvailable = true;
        } catch (error) {
            this.storageAvailable = false;
            console.warn('localStorage is not available. Running in memory-only mode.');
            this.showToast('⚠️ Storage unavailable. Changes will not persist after closing the app.');
        }
    }
    
    getDefaultSettings() {
        return {
            income: 5000,
            rent: 1500,
            utilities: 200,
            insurance: 300,
            privacyMode: false,
            categories: [
                'Food',
                'Transportation',
                'Entertainment',
                'Coffee',
                'Shopping',
                'Bills',
                'Other'
            ],
            goals: {
                Food: 500,
                Transportation: 200,
                Entertainment: 150,
                Coffee: 75,
                Shopping: 300,
                Bills: 400,
                Other: 100
            }
        };
    }

    setupEventListeners() {
        // Quick Add Button
        const quickAddBtn = document.querySelector('.quick-add-btn');
        if (quickAddBtn) {
            quickAddBtn.addEventListener('click', () => this.showQuickAdd());
        }

        // Navigation
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const navType = item.querySelector('.nav-label').textContent.toLowerCase();
                this.navigateTo(navType);
            });
        });

        // View All Button
        const viewAllBtn = document.querySelector('.view-all-btn');
        if (viewAllBtn) {
            viewAllBtn.addEventListener('click', () => this.navigateTo('insights'));
        }

        // Add Expense Form
        const expenseForm = document.getElementById('expense-form');
        if (expenseForm) {
            expenseForm.addEventListener('submit', (e) => this.handleExpenseFormSubmit(e));
        }
        
        // Setup form validation for Add Expense form
        this.setupFormValidation();

        // Edit Expense Form
        const editExpenseForm = document.getElementById('edit-expense-form');
        if (editExpenseForm) {
            editExpenseForm.addEventListener('submit', (e) => this.saveEditedExpense(e));
        }
        
        // Close modal when clicking outside
        const editModal = document.getElementById('edit-expense-modal');
        if (editModal) {
            editModal.addEventListener('click', (e) => {
                if (e.target === editModal) {
                    this.closeEditModal();
                }
            });
        }

        // Settings form inputs
        this.setupSettingsListeners();

        // Touch interactions for mobile
        this.setupTouchGestures();
    }
    
    setupFormValidation() {
        // Get form inputs
        const amountInput = document.getElementById('amount-input');
        const descriptionInput = document.getElementById('description-input');
        const expenseForm = document.getElementById('expense-form');
        const submitButton = expenseForm?.querySelector('button[type="submit"]');
        
        if (!amountInput || !descriptionInput || !expenseForm) return;
        
        // Create error message containers if they don't exist
        this.createErrorContainer(amountInput, 'amount-error');
        this.createErrorContainer(descriptionInput, 'description-error');
        
        // Real-time validation for amount input (positive numbers only)
        amountInput.addEventListener('input', (e) => {
            this.validateAmountInput(e.target);
            this.updateSubmitButtonState(expenseForm, submitButton);
        });
        
        amountInput.addEventListener('blur', (e) => {
            this.validateAmountInput(e.target);
            this.updateSubmitButtonState(expenseForm, submitButton);
        });
        
        // Real-time validation for description input (not empty)
        descriptionInput.addEventListener('input', (e) => {
            this.validateDescriptionInput(e.target);
            this.updateSubmitButtonState(expenseForm, submitButton);
        });
        
        descriptionInput.addEventListener('blur', (e) => {
            this.validateDescriptionInput(e.target);
            this.updateSubmitButtonState(expenseForm, submitButton);
        });
        
        // Initial validation state
        this.updateSubmitButtonState(expenseForm, submitButton);
    }
    
    createErrorContainer(inputElement, errorId) {
        // Check if error container already exists
        if (document.getElementById(errorId)) return;
        
        // Create error message element
        const errorDiv = document.createElement('div');
        errorDiv.id = errorId;
        errorDiv.className = 'input-error-message';
        errorDiv.style.cssText = `
            color: #FF453A;
            font-size: 12px;
            margin-top: 4px;
            display: none;
            animation: errorSlideIn 0.2s ease;
        `;
        
        // Insert after the input's parent form-group
        const formGroup = inputElement.closest('.form-group');
        if (formGroup) {
            formGroup.appendChild(errorDiv);
        }
        
        // Add error animation styles if not already present
        if (!document.querySelector('#error-animation-styles')) {
            const style = document.createElement('style');
            style.id = 'error-animation-styles';
            style.textContent = `
                @keyframes errorSlideIn {
                    from { opacity: 0; transform: translateY(-5px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .input-error {
                    border-color: #FF453A !important;
                    background: rgba(255, 69, 58, 0.1) !important;
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    validateAmountInput(input) {
        const errorContainer = document.getElementById('amount-error');
        if (!errorContainer) return true;
        
        const value = input.value.trim();
        const amount = parseFloat(value);
        
        // Check if empty
        if (value === '') {
            this.showInputError(input, errorContainer, 'Amount is required');
            return false;
        }
        
        // Check if valid number
        if (isNaN(amount)) {
            this.showInputError(input, errorContainer, 'Please enter a valid number');
            return false;
        }
        
        // Check if positive
        if (amount <= 0) {
            this.showInputError(input, errorContainer, 'Amount must be greater than 0');
            return false;
        }
        
        // Valid input
        this.hideInputError(input, errorContainer);
        return true;
    }
    
    validateDescriptionInput(input) {
        const errorContainer = document.getElementById('description-error');
        if (!errorContainer) return true;
        
        const value = input.value.trim();
        
        // Check if empty or only whitespace
        if (value === '') {
            this.showInputError(input, errorContainer, 'Description is required');
            return false;
        }
        
        // Valid input
        this.hideInputError(input, errorContainer);
        return true;
    }
    
    showInputError(input, errorContainer, message) {
        input.classList.add('input-error');
        errorContainer.textContent = message;
        errorContainer.style.display = 'block';
    }
    
    hideInputError(input, errorContainer) {
        input.classList.remove('input-error');
        errorContainer.style.display = 'none';
    }
    
    updateSubmitButtonState(form, submitButton) {
        if (!submitButton) return;
        
        const amountInput = document.getElementById('amount-input');
        const descriptionInput = document.getElementById('description-input');
        
        if (!amountInput || !descriptionInput) return;
        
        // Check if both inputs are valid
        const amountValid = this.validateAmountInput(amountInput);
        const descriptionValid = this.validateDescriptionInput(descriptionInput);
        
        // Disable submit button when form is invalid
        if (!amountValid || !descriptionValid) {
            submitButton.disabled = true;
            submitButton.style.opacity = '0.5';
            submitButton.style.cursor = 'not-allowed';
        } else {
            submitButton.disabled = false;
            submitButton.style.opacity = '1';
            submitButton.style.cursor = 'pointer';
        }
    }
    
    handleExpenseFormSubmit(event) {
        event.preventDefault();
        
        // Get form values
        const amountInput = document.getElementById('amount-input');
        const descriptionInput = document.getElementById('description-input');
        const categorySelect = document.getElementById('category-select');
        const dateInput = document.getElementById('date-input');
        
        // Validate inputs one more time
        const amountValid = this.validateAmountInput(amountInput);
        const descriptionValid = this.validateDescriptionInput(descriptionInput);
        
        if (!amountValid || !descriptionValid) {
            this.showToast('Please fix the errors before submitting');
            return;
        }
        
        const amount = parseFloat(amountInput.value);
        const description = descriptionInput.value.trim();
        const category = categorySelect.value;
        const date = dateInput.value || new Date().toISOString().split('T')[0];
        
        try {
            // Add expense
            this.addExpense(description, amount, category, date);
            
            // Update UI
            this.updateDashboard();
            
            // Reset form
            event.target.reset();
            
            // Set default date to today
            dateInput.value = new Date().toISOString().split('T')[0];
            
            // Show success message
            this.showToast('Expense added successfully! ✨');
            
            // Navigate to home page
            this.navigateTo('home');
        } catch (error) {
            this.showToast('Error: ' + error.message);
        }
    }
    
    setupSettingsListeners() {
        // Income input
        const incomeInput = document.getElementById('income-input');
        if (incomeInput) {
            // Set initial value
            incomeInput.value = this.settings.income || 0;
            
            incomeInput.addEventListener('change', (e) => {
                try {
                    this.updateIncome(e.target.value);
                    this.showToast('Income updated successfully!');
                } catch (error) {
                    this.showToast('Error: ' + error.message);
                    e.target.value = this.settings.income || 0;
                }
            });
        }
        
        // Rent input
        const rentInput = document.getElementById('rent-input');
        if (rentInput) {
            rentInput.value = this.settings.rent || 0;
            
            rentInput.addEventListener('change', (e) => {
                try {
                    this.updateFixedExpense('rent', e.target.value);
                    this.showToast('Rent updated successfully!');
                } catch (error) {
                    this.showToast('Error: ' + error.message);
                    e.target.value = this.settings.rent || 0;
                }
            });
        }
        
        // Utilities input
        const utilitiesInput = document.getElementById('utilities-input');
        if (utilitiesInput) {
            utilitiesInput.value = this.settings.utilities || 0;
            
            utilitiesInput.addEventListener('change', (e) => {
                try {
                    this.updateFixedExpense('utilities', e.target.value);
                    this.showToast('Utilities updated successfully!');
                } catch (error) {
                    this.showToast('Error: ' + error.message);
                    e.target.value = this.settings.utilities || 0;
                }
            });
        }
        
        // Insurance input
        const insuranceInput = document.getElementById('insurance-input');
        if (insuranceInput) {
            insuranceInput.value = this.settings.insurance || 0;
            
            insuranceInput.addEventListener('change', (e) => {
                try {
                    this.updateFixedExpense('insurance', e.target.value);
                    this.showToast('Insurance updated successfully!');
                } catch (error) {
                    this.showToast('Error: ' + error.message);
                    e.target.value = this.settings.insurance || 0;
                }
            });
        }
        
        // New category input - trigger on Enter key
        const newCategoryInput = document.getElementById('new-category-input');
        if (newCategoryInput) {
            newCategoryInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const categoryName = newCategoryInput.value;
                    try {
                        this.addCategory(categoryName);
                        newCategoryInput.value = '';
                        this.showToast('Category added successfully!');
                    } catch (error) {
                        this.showToast('Error: ' + error.message);
                    }
                }
            });
        }
        
        // Render initial categories list and goals
        this.renderCategoriesList();
        this.renderCategoryGoalsSettings();
        
        // Privacy toggle
        const privacyToggle = document.getElementById('privacy-toggle');
        if (privacyToggle) {
            // Set initial state
            privacyToggle.checked = this.settings.privacyMode || false;
            
            privacyToggle.addEventListener('change', (e) => {
                this.togglePrivacyMode();
            });
        }
    }

    updateDateTime() {
        const now = new Date();
        const timeElement = document.querySelector('.time');
        const dateElement = document.querySelector('.date');
        const greetingElement = document.querySelector('.greeting');

        if (timeElement) {
            timeElement.textContent = now.toLocaleTimeString('en-US', { 
                hour: 'numeric', 
                minute: '2-digit',
                hour12: false 
            });
        }

        if (dateElement) {
            dateElement.textContent = now.toLocaleDateString('en-US', { 
                weekday: 'long', 
                month: 'long', 
                day: 'numeric' 
            });
        }

        if (greetingElement) {
            const hour = now.getHours();
            let greeting = 'Good morning';
            if (hour >= 12 && hour < 17) greeting = 'Good afternoon';
            else if (hour >= 17) greeting = 'Good evening';
            
            greetingElement.textContent = `${greeting}, Sreekar`;
        }
    }

    updateGaugeColor(percentage) {
        const gauge = document.querySelector('.gauge-progress');
        if (!gauge) return;

        let gradient;
        if (percentage <= 60) {
            gradient = 'url(#gaugeGradientGood)';
        } else if (percentage <= 85) {
            gradient = 'url(#gaugeGradientWarning)';
        } else {
            gradient = 'url(#gaugeGradientDanger)';
        }

        // Create dynamic gradients
        const svg = gauge.closest('svg');
        const defs = svg.querySelector('defs');
        
        // Clear existing gradients
        defs.innerHTML = '';
        
        // Add appropriate gradient
        let gradientHTML;
        if (percentage <= 60) {
            gradientHTML = `
                <linearGradient id="gaugeGradientGood" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" style="stop-color:#007AFF;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#34C759;stop-opacity:1" />
                </linearGradient>
            `;
        } else if (percentage <= 85) {
            gradientHTML = `
                <linearGradient id="gaugeGradientWarning" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" style="stop-color:#007AFF;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#FF9F0A;stop-opacity:1" />
                </linearGradient>
            `;
        } else {
            gradientHTML = `
                <linearGradient id="gaugeGradientDanger" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" style="stop-color:#FF9F0A;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#FF453A;stop-opacity:1" />
                </linearGradient>
            `;
        }
        
        defs.innerHTML = gradientHTML;
        gauge.setAttribute('stroke', `url(#gaugeGradient${percentage <= 60 ? 'Good' : percentage <= 85 ? 'Warning' : 'Danger'})`);
    }

    animateNumber(element, start, end, duration, prefix = '', suffix = '', hideInPrivacy = false) {
        const startTime = Date.now();
        const startValue = start;
        const endValue = end;
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function (ease-out)
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(startValue + (endValue - startValue) * eased);
            
            // Check if we should use privacy mode formatting
            if (prefix === '$' && this.settings.privacyMode && hideInPrivacy) {
                element.textContent = this.formatAmount(current, hideInPrivacy);
            } else if (prefix === '$') {
                element.textContent = `${prefix}${current.toLocaleString()}`;
            } else {
                element.textContent = `${prefix}${current}${suffix}`;
            }
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
    }

    setupTransactionAnimations() {
        const transactionItems = document.querySelectorAll('.transaction-item');
        
        // Stagger animation for transaction items
        transactionItems.forEach((item, index) => {
            item.style.opacity = '0';
            item.style.transform = 'translateY(20px)';
            
            setTimeout(() => {
                item.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
                item.style.opacity = '1';
                item.style.transform = 'translateY(0)';
            }, 200 + (index * 100));
        });

        // Hover effects with haptic feedback simulation
        transactionItems.forEach(item => {
            item.addEventListener('mouseenter', () => {
                this.addRippleEffect(item);
            });
        });
    }

    addRippleEffect(element) {
        const ripple = document.createElement('div');
        ripple.className = 'ripple-effect';
        ripple.style.cssText = `
            position: absolute;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.1);
            transform: scale(0);
            animation: ripple 0.6s linear;
            pointer-events: none;
            left: 50%;
            top: 50%;
            width: 20px;
            height: 20px;
            margin-left: -10px;
            margin-top: -10px;
        `;

        element.style.position = 'relative';
        element.appendChild(ripple);

        // Add ripple animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes ripple {
                to {
                    transform: scale(4);
                    opacity: 0;
                }
            }
        `;
        if (!document.querySelector('#ripple-styles')) {
            style.id = 'ripple-styles';
            document.head.appendChild(style);
        }

        setTimeout(() => {
            ripple.remove();
        }, 600);
    }

    setupTouchGestures() {
        let startY = 0;
        let startX = 0;
        let isScrolling = false;

        document.addEventListener('touchstart', (e) => {
            startY = e.touches[0].clientY;
            startX = e.touches[0].clientX;
            isScrolling = false;
        });

        document.addEventListener('touchmove', (e) => {
            if (!startY || !startX) return;

            const currentY = e.touches[0].clientY;
            const currentX = e.touches[0].clientX;
            const diffY = startY - currentY;
            const diffX = startX - currentX;

            // Determine if user is scrolling
            if (Math.abs(diffY) > Math.abs(diffX)) {
                isScrolling = true;
            }
        });

        document.addEventListener('touchend', () => {
            startY = 0;
            startX = 0;
            isScrolling = false;
        });

        // Pull to refresh simulation
        let refreshThreshold = 100;
        let refreshTriggered = false;

        document.addEventListener('scroll', () => {
            if (window.scrollY === 0 && !refreshTriggered) {
                // At top of page - could implement pull to refresh here
            }
        });
    }
    
    /**
     * Setup network event listeners for online/offline detection
     * Updates sync status and attempts to sync when coming back online
     */
    setupNetworkListeners() {
        // Listen for online event
        window.addEventListener('online', () => {
            console.log('Device is now online');
            this.updateSyncStatus('synced', 'Back online');
            
            // Attempt to sync if user is authenticated
            const user = window.getCurrentUser ? window.getCurrentUser() : null;
            if (user && window.firebaseDb) {
                // Small delay to ensure connection is stable
                setTimeout(() => {
                    this.syncToFirestore();
                }, 1000);
            }
        });
        
        // Listen for offline event
        window.addEventListener('offline', () => {
            console.log('Device is now offline');
            this.updateSyncStatus('offline', 'Offline - changes saved locally');
            this.showToast('📱 You\'re offline. Changes will sync when back online.');
        });
        
        // Set initial status based on current online state
        if (!this.isOnline()) {
            this.updateSyncStatus('offline', 'Offline');
        }
    }

    showQuickAdd() {
        // Create modal overlay
        const modal = document.createElement('div');
        modal.className = 'quick-add-modal';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
            <div class="modal-content glass-card">
                <div class="modal-header">
                    <h2>Quick Add Expense</h2>
                    <button class="close-btn" onclick="this.closest('.quick-add-modal').remove()">✕</button>
                </div>
                
                <div class="quick-add-form">
                    <div class="form-step active" data-step="1">
                        <div class="prompt-text">What did you spend on?</div>
                        <input type="text" class="prompt-input" placeholder="Coffee, lunch, uber..." autofocus>
                        <div class="suggestions">
                            <button class="suggestion-btn" data-category="coffee">☕ Coffee</button>
                            <button class="suggestion-btn" data-category="food">🍽️ Food</button>
                            <button class="suggestion-btn" data-category="transport">🚗 Transport</button>
                            <button class="suggestion-btn" data-category="shopping">🛒 Shopping</button>
                        </div>
                    </div>
                    
                    <div class="form-step" data-step="2">
                        <div class="prompt-text">How much?</div>
                        <div class="amount-input-container">
                            <span class="currency-symbol">$</span>
                            <input type="number" class="amount-input" placeholder="0.00" step="0.01">
                        </div>
                    </div>
                    
                    <div class="form-step" data-step="3">
                        <div class="prompt-text">All set! 🎉</div>
                        <div class="expense-summary">
                            <div class="summary-item">
                                <span class="summary-label">Description:</span>
                                <span class="summary-value" id="summary-description">-</span>
                            </div>
                            <div class="summary-item">
                                <span class="summary-label">Amount:</span>
                                <span class="summary-value" id="summary-amount">-</span>
                            </div>
                            <div class="summary-item">
                                <span class="summary-label">Category:</span>
                                <span class="summary-value" id="summary-category">-</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-actions">
                        <button class="glass-button secondary" id="prev-btn" style="display: none;" onclick="this.closest('.quick-add-modal').previousStep()">← Back</button>
                        <button class="glass-button primary" id="next-btn" onclick="this.closest('.quick-add-modal').nextStep()">Continue</button>
                        <button class="glass-button success" id="save-btn" style="display: none;" onclick="this.closest('.quick-add-modal').saveExpense()">Add Expense ✨</button>
                    </div>
                </div>
            </div>
        `;

        // Add modal styles
        const modalStyles = document.createElement('style');
        modalStyles.textContent = `
            .quick-add-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 1000;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                animation: modalFadeIn 0.3s ease;
            }
            
            .modal-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                backdrop-filter: blur(10px);
            }
            
            .modal-content {
                position: relative;
                width: 100%;
                max-width: 400px;
                max-height: 80vh;
                overflow-y: auto;
                animation: modalSlideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }
            
            .modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 24px;
            }
            
            .modal-header h2 {
                font-size: 24px;
                font-weight: 700;
                color: #ffffff;
            }
            
            .close-btn {
                background: none;
                border: none;
                color: rgba(255, 255, 255, 0.7);
                font-size: 20px;
                cursor: pointer;
                padding: 8px;
                border-radius: 8px;
                transition: all 0.2s ease;
            }
            
            .close-btn:hover {
                background: rgba(255, 255, 255, 0.1);
                color: #ffffff;
            }
            
            .form-step {
                display: none;
            }
            
            .form-step.active {
                display: block;
            }
            
            .prompt-text {
                font-size: 20px;
                font-weight: 600;
                color: #ffffff;
                margin-bottom: 20px;
                text-align: center;
            }
            
            .prompt-input, .amount-input {
                width: 100%;
                padding: 16px 20px;
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 16px;
                color: #ffffff;
                font-size: 18px;
                text-align: center;
                margin-bottom: 20px;
            }
            
            .prompt-input::placeholder, .amount-input::placeholder {
                color: rgba(255, 255, 255, 0.5);
            }
            
            .amount-input-container {
                position: relative;
                margin-bottom: 20px;
            }
            
            .currency-symbol {
                position: absolute;
                left: 20px;
                top: 50%;
                transform: translateY(-50%);
                font-size: 18px;
                color: rgba(255, 255, 255, 0.7);
            }
            
            .amount-input {
                padding-left: 50px;
            }
            
            .suggestions {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 12px;
                margin-bottom: 20px;
            }
            
            .suggestion-btn {
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 12px;
                padding: 12px 16px;
                color: #ffffff;
                font-size: 14px;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            
            .suggestion-btn:hover {
                background: rgba(255, 255, 255, 0.2);
                border-color: rgba(255, 255, 255, 0.3);
            }
            
            .expense-summary {
                background: rgba(255, 255, 255, 0.05);
                border-radius: 16px;
                padding: 20px;
                margin-bottom: 20px;
            }
            
            .summary-item {
                display: flex;
                justify-content: space-between;
                margin-bottom: 12px;
            }
            
            .summary-item:last-child {
                margin-bottom: 0;
            }
            
            .summary-label {
                color: rgba(255, 255, 255, 0.7);
                font-weight: 500;
            }
            
            .summary-value {
                color: #ffffff;
                font-weight: 600;
            }
            
            .form-actions {
                display: flex;
                gap: 12px;
                margin-top: 24px;
            }
            
            .glass-button.secondary {
                background: rgba(255, 255, 255, 0.1);
                border-color: rgba(255, 255, 255, 0.2);
                color: rgba(255, 255, 255, 0.8);
                flex: 1;
            }
            
            .glass-button.primary {
                flex: 2;
            }
            
            .glass-button.success {
                background: rgba(52, 199, 89, 0.2);
                border-color: rgba(52, 199, 89, 0.3);
                color: #34C759;
                flex: 1;
            }
            
            @keyframes modalFadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            @keyframes modalSlideUp {
                from { transform: translateY(50px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
        `;
        
        document.head.appendChild(modalStyles);
        document.body.appendChild(modal);

        // Setup quick add functionality
        this.setupQuickAddModal(modal);
    }

    setupQuickAddModal(modal) {
        let currentStep = 1;
        let expenseData = {};

        modal.nextStep = () => {
            const currentStepEl = modal.querySelector(`[data-step="${currentStep}"]`);
            
            if (currentStep === 1) {
                const description = modal.querySelector('.prompt-input').value.trim();
                if (!description) {
                    this.showToast('Please enter a description');
                    return;
                }
                expenseData.description = description;
            } else if (currentStep === 2) {
                const amount = parseFloat(modal.querySelector('.amount-input').value);
                if (!amount || amount <= 0) {
                    this.showToast('Please enter a valid amount');
                    return;
                }
                expenseData.amount = amount;
                
                // Update summary
                modal.querySelector('#summary-description').textContent = expenseData.description;
                modal.querySelector('#summary-amount').textContent = this.formatAmount(amount, false); // ALWAYS SHOW
                modal.querySelector('#summary-category').textContent = expenseData.category || 'Other';
            }

            currentStepEl.classList.remove('active');
            currentStep++;
            
            const nextStepEl = modal.querySelector(`[data-step="${currentStep}"]`);
            nextStepEl.classList.add('active');

            // Update buttons
            const prevBtn = modal.querySelector('#prev-btn');
            const nextBtn = modal.querySelector('#next-btn');
            const saveBtn = modal.querySelector('#save-btn');

            prevBtn.style.display = currentStep > 1 ? 'block' : 'none';
            
            if (currentStep === 3) {
                nextBtn.style.display = 'none';
                saveBtn.style.display = 'block';
            }
        };

        modal.previousStep = () => {
            const currentStepEl = modal.querySelector(`[data-step="${currentStep}"]`);
            currentStepEl.classList.remove('active');
            
            currentStep--;
            const prevStepEl = modal.querySelector(`[data-step="${currentStep}"]`);
            prevStepEl.classList.add('active');

            // Update buttons
            const prevBtn = modal.querySelector('#prev-btn');
            const nextBtn = modal.querySelector('#next-btn');
            const saveBtn = modal.querySelector('#save-btn');

            prevBtn.style.display = currentStep > 1 ? 'block' : 'none';
            nextBtn.style.display = 'block';
            saveBtn.style.display = 'none';
        };

        modal.saveExpense = () => {
            // Add expense to data
            const newExpense = {
                id: Date.now(),
                ...expenseData,
                date: new Date().toISOString(),
                timestamp: Date.now()
            };

            this.expenses.push(newExpense);
            this.saveExpenses();
            this.updateDashboard(); // Update all dashboard elements
            
            this.showToast('Expense added successfully! ✨');
            modal.remove();
        };

        // Category suggestions
        modal.querySelectorAll('.suggestion-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                expenseData.category = btn.dataset.category;
                modal.querySelector('.prompt-input').value = btn.textContent.replace(/[^\w\s]/gi, '').trim();
                setTimeout(() => modal.nextStep(), 300);
            });
        });

        // Enter key handling
        modal.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (currentStep < 3) {
                    modal.nextStep();
                } else {
                    modal.saveExpense();
                }
            }
        });
    }

    showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast-message';
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 120px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 12px 24px;
            border-radius: 25px;
            font-size: 14px;
            font-weight: 500;
            z-index: 2000;
            backdrop-filter: blur(20px);
            animation: toastSlideUp 0.3s ease;
        `;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'toastSlideDown 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, 2000);

        // Add toast animations
        if (!document.querySelector('#toast-styles')) {
            const toastStyles = document.createElement('style');
            toastStyles.id = 'toast-styles';
            toastStyles.textContent = `
                @keyframes toastSlideUp {
                    from { transform: translateX(-50%) translateY(20px); opacity: 0; }
                    to { transform: translateX(-50%) translateY(0); opacity: 1; }
                }
                @keyframes toastSlideDown {
                    from { transform: translateX(-50%) translateY(0); opacity: 1; }
                    to { transform: translateX(-50%) translateY(20px); opacity: 0; }
                }
            `;
            document.head.appendChild(toastStyles);
        }
    }
    
    showSignIn() {
        // Placeholder for sign-in functionality
        this.showToast('🔐 Sign-in functionality coming soon! Your data is currently stored locally.');
    }

    navigateTo(page) {
        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });

        const activeNav = Array.from(document.querySelectorAll('.nav-item')).find(item => 
            item.querySelector('.nav-label').textContent.toLowerCase() === page
        );
        
        if (activeNav) {
            activeNav.classList.add('active');
        }

        // Show appropriate page
        this.showPage(page);
    }

    showPage(pageId) {
        // Hide all pages
        document.querySelectorAll('.page-content').forEach(page => {
            page.classList.remove('active');
        });
        
        // Special handling for add page - show the add page instead of modal
        if (pageId === 'add') {
            const targetPage = document.getElementById('add-page');
            if (targetPage) {
                targetPage.classList.add('active');
                this.currentPage = 'add';
            }
            return;
        }
        
        // Show selected page
        const targetPage = document.getElementById(`${pageId}-page`);
        if (targetPage) {
            targetPage.classList.add('active');
            this.currentPage = pageId;
            
            // Update page-specific content
            if (pageId === 'overview') {
                this.updateOverviewPage();
            } else if (pageId === 'insights') {
                // Insights page is now the Transactions page
                this.renderAllTransactions();
            } else if (pageId === 'history') {
                // Update history page when navigating to it
                this.updateHistoryPage();
            }
        }
    }

    updateOverviewPage() {
        // Update mini cards with calculated values
        const income = this.settings.income || 0;
        const totalExpenses = this.calculateTotalExpenses();
        const savings = this.calculateSavings();
        const budgetLeft = this.calculateBudgetLeft();

        // Update mini cards
        const incomeCard = document.querySelector('.mini-card.income .mini-card-amount');
        const expensesCard = document.querySelector('.mini-card.expenses .mini-card-amount');
        const savingsCard = document.querySelector('.mini-card.savings .mini-card-amount');
        const budgetCard = document.querySelector('.mini-card.budget .mini-card-amount');

        if (incomeCard) this.animateNumber(incomeCard, 0, income, 800, '$', '', true); // HIDE in privacy
        if (expensesCard) this.animateNumber(expensesCard, 0, totalExpenses, 800, '$', '', false); // ALWAYS SHOW
        if (savingsCard) this.animateNumber(savingsCard, 0, savings, 800, '$', '', true); // HIDE in privacy
        if (budgetCard) this.animateNumber(budgetCard, 0, budgetLeft, 800, '$', '', false); // ALWAYS SHOW
        
        // Call updateCategoryBreakdown()
        this.updateCategoryBreakdown();
        
        // Update daily average and weekly trend cards
        const dailyAverage = this.calculateDailyAverage();
        const weeklySpending = this.calculateWeeklySpending();

        const dailyElement = document.getElementById('daily-average');
        const weeklyElement = document.getElementById('weekly-spending');

        if (dailyElement) {
            setTimeout(() => {
                this.animateNumber(dailyElement, 0, dailyAverage, 600, '$', '', false); // ALWAYS SHOW
            }, 400);
        }

        if (weeklyElement) {
            setTimeout(() => {
                this.animateNumber(weeklyElement, 0, weeklySpending, 600, '$', '', false); // ALWAYS SHOW
            }, 600);
        }
    }

    updateCategoryBreakdown() {
        const categoryBreakdownList = document.getElementById('category-breakdown-list');
        if (!categoryBreakdownList) return;
        
        // Category emoji mapping
        const CATEGORY_EMOJIS = {
            'Food': '🍽️',
            'Transportation': '🚗',
            'Entertainment': '🎬',
            'Coffee': '☕',
            'Shopping': '🛒',
            'Bills': '📄',
            'Other': '📦'
        };
        
        // Category background classes
        const CATEGORY_BG_CLASSES = {
            'Food': 'food-bg',
            'Transportation': 'transport-bg',
            'Entertainment': 'entertainment-bg',
            'Coffee': 'coffee-bg',
            'Shopping': 'shopping-bg',
            'Bills': 'bills-bg',
            'Other': 'other-bg'
        };
        
        // Group expenses by category
        const categoryTotals = {};
        this.expenses.forEach(expense => {
            const category = expense.category || 'Other';
            if (!categoryTotals[category]) {
                categoryTotals[category] = 0;
            }
            categoryTotals[category] += expense.amount;
        });
        
        // Calculate spent amount and percentage for each category
        const categoryData = this.settings.categories.map(category => {
            const spent = categoryTotals[category] || 0;
            const goal = this.settings.goals?.[category] || 0;
            const percentage = goal > 0 ? Math.round((spent / goal) * 100) : 0;
            
            return {
                name: category,
                spent: spent,
                goal: goal,
                percentage: percentage,
                emoji: CATEGORY_EMOJIS[category] || '📦',
                bgClass: CATEGORY_BG_CLASSES[category] || 'other-bg'
            };
        }).filter(cat => cat.spent > 0 || cat.goal > 0); // Only show categories with activity or goals
        
        // Sort by spent amount (descending)
        categoryData.sort((a, b) => b.spent - a.spent);
        
        // Generate HTML with progress bars
        const categoryHTML = categoryData.map((category, index) => {
            // Highlight categories approaching/exceeding goals
            let statusClass = '';
            if (category.goal > 0) {
                if (category.percentage >= 100) {
                    statusClass = 'over-budget';
                } else if (category.percentage >= 90) {
                    statusClass = 'approaching-limit';
                }
            }
            
            return `
                <div class="category-item ${statusClass}">
                    <div class="category-info">
                        <div class="category-icon ${category.bgClass}">${category.emoji}</div>
                        <div class="category-details">
                            <div class="category-name">${category.name}</div>
                            <div class="category-progress-bar">
                                <div class="progress-fill" style="width: 0%;" data-target="${Math.min(category.percentage, 100)}"></div>
                            </div>
                        </div>
                    </div>
                    <div class="category-amounts">
                        <div class="spent-amount" data-amount="${category.spent}">$0</div>
                        <div class="budget-amount">of ${this.formatAmount(category.goal, false).replace('$', '$')}</div> <!-- ALWAYS SHOW -->
                    </div>
                </div>
            `;
        }).join('');
        
        categoryBreakdownList.innerHTML = categoryHTML || '<div class="no-categories">No spending data yet. Start adding expenses!</div>';
        
        // Animate progress bars and amounts with stagger
        setTimeout(() => {
            categoryBreakdownList.querySelectorAll('.category-item').forEach((item, index) => {
                setTimeout(() => {
                    const progressFill = item.querySelector('.progress-fill');
                    const spentAmount = item.querySelector('.spent-amount');
                    
                    if (progressFill) {
                        const targetWidth = progressFill.dataset.target;
                        progressFill.style.transition = 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
                        progressFill.style.width = `${targetWidth}%`;
                    }
                    
                    if (spentAmount) {
                        const targetAmount = parseFloat(spentAmount.dataset.amount);
                        this.animateNumber(spentAmount, 0, targetAmount, 600, '$');
                    }
                }, index * 150);
            });
        }, 100);
    }

    loadExpenses() {
        // If storage is not available, return empty array
        if (!this.storageAvailable) {
            return [];
        }
        
        try {
            const stored = localStorage.getItem('glassui_expenses');
            if (stored) {
                const parsed = JSON.parse(stored);
                // Validate that it's an array
                if (Array.isArray(parsed)) {
                    return parsed;
                } else {
                    console.error('Stored expenses data is not an array');
                    return [];
                }
            }
            return [];
        } catch (error) {
            console.error('Error loading expenses from localStorage:', error);
            this.showToast('⚠️ Error loading expenses. Starting fresh.');
            // Fallback to in-memory mode
            this.storageAvailable = false;
            return [];
        }
    }

    saveExpenses() {
        // If storage is not available, skip saving (in-memory only mode)
        if (!this.storageAvailable) {
            console.warn('localStorage unavailable. Changes are in-memory only.');
            return;
        }
        
        try {
            const dataToStore = JSON.stringify(this.expenses);
            localStorage.setItem('glassui_expenses', dataToStore);
            
            // Sync to Firestore if user is authenticated
            if (window.getCurrentUser && window.getCurrentUser()) {
                this.syncToFirestore();
            }
        } catch (error) {
            console.error('Error saving expenses to localStorage:', error);
            
            // Check if it's a quota exceeded error
            if (error.name === 'QuotaExceededError' || error.code === 22) {
                this.showToast('⚠️ Storage full! Cannot save changes. Please export your data.');
            } else {
                this.showToast('⚠️ Error saving expenses. Changes may not persist.');
            }
            
            // Switch to in-memory mode
            this.storageAvailable = false;
        }
    }

    loadSettings() {
        // If storage is not available, return defaults
        if (!this.storageAvailable) {
            return this.getDefaultSettings();
        }
        
        try {
            const stored = localStorage.getItem('glassui_settings');
            if (stored) {
                const parsed = JSON.parse(stored);
                // Validate that it's an object
                if (typeof parsed === 'object' && parsed !== null) {
                    // Merge with defaults to ensure all required fields exist
                    return { ...this.getDefaultSettings(), ...parsed };
                } else {
                    console.error('Stored settings data is not an object');
                    return this.getDefaultSettings();
                }
            }
            return this.getDefaultSettings();
        } catch (error) {
            console.error('Error loading settings from localStorage:', error);
            this.showToast('⚠️ Error loading settings. Using defaults.');
            // Fallback to in-memory mode
            this.storageAvailable = false;
            return this.getDefaultSettings();
        }
    }
    
    saveSettings() {
        // If storage is not available, skip saving (in-memory only mode)
        if (!this.storageAvailable) {
            console.warn('localStorage unavailable. Changes are in-memory only.');
            return;
        }
        
        try {
            const dataToStore = JSON.stringify(this.settings);
            localStorage.setItem('glassui_settings', dataToStore);
            
            // Sync to Firestore if user is authenticated
            if (window.getCurrentUser && window.getCurrentUser()) {
                this.syncToFirestore();
            }
        } catch (error) {
            console.error('Error saving settings to localStorage:', error);
            
            // Check if it's a quota exceeded error
            if (error.name === 'QuotaExceededError' || error.code === 22) {
                this.showToast('⚠️ Storage full! Cannot save settings.');
            } else {
                this.showToast('⚠️ Error saving settings. Changes may not persist.');
            }
            
            // Switch to in-memory mode
            this.storageAvailable = false;
        }
    }
    
    // Expense CRUD Operations
    addExpense(description, amount, category, date = new Date().toISOString().split('T')[0]) {
        // Validate inputs
        if (!description || description.trim() === '') {
            throw new Error('Description is required');
        }
        if (!amount || amount <= 0) {
            throw new Error('Amount must be positive');
        }
        
        // Create expense object
        const expense = {
            id: Date.now(),
            description: description.trim(),
            amount: parseFloat(amount),
            category: category || 'Other',
            date: date,
            timestamp: Date.now()
        };
        
        // Add to array
        this.expenses.push(expense);
        
        // Persist immediately
        this.saveExpenses();
        
        return expense;
    }
    
    editExpense(id, updates) {
        const index = this.expenses.findIndex(exp => exp.id === id);
        if (index === -1) {
            throw new Error('Expense not found');
        }
        
        // Validate updates if provided
        if (updates.amount !== undefined && updates.amount <= 0) {
            throw new Error('Amount must be positive');
        }
        if (updates.description !== undefined && updates.description.trim() === '') {
            throw new Error('Description cannot be empty');
        }
        
        // Apply updates
        this.expenses[index] = {
            ...this.expenses[index],
            ...updates,
            description: updates.description ? updates.description.trim() : this.expenses[index].description
        };
        
        // Persist immediately
        this.saveExpenses();
        
        return this.expenses[index];
    }
    
    deleteExpense(id) {
        const index = this.expenses.findIndex(exp => exp.id === id);
        if (index === -1) {
            throw new Error('Expense not found');
        }
        
        const deleted = this.expenses.splice(index, 1)[0];
        
        // Persist immediately
        this.saveExpenses();
        
        return deleted;
    }
    
    getExpenseById(id) {
        return this.expenses.find(exp => exp.id === id);
    }
    
    // Calculation Methods
    calculateTotalExpenses() {
        try {
            // Handle empty expense arrays gracefully
            if (!Array.isArray(this.expenses) || this.expenses.length === 0) {
                return 0;
            }
            
            return this.expenses.reduce((total, expense) => {
                // Validate expense amount
                const amount = parseFloat(expense.amount);
                if (isNaN(amount) || amount < 0) {
                    console.warn('Invalid expense amount:', expense);
                    return total;
                }
                return total + amount;
            }, 0);
        } catch (error) {
            console.error('Error calculating total expenses:', error);
            return 0;
        }
    }
    
    calculateFixedExpenses() {
        try {
            const rent = parseFloat(this.settings.rent) || 0;
            const utilities = parseFloat(this.settings.utilities) || 0;
            const insurance = parseFloat(this.settings.insurance) || 0;
            
            // Validate values are non-negative
            const validRent = rent >= 0 ? rent : 0;
            const validUtilities = utilities >= 0 ? utilities : 0;
            const validInsurance = insurance >= 0 ? insurance : 0;
            
            return validRent + validUtilities + validInsurance;
        } catch (error) {
            console.error('Error calculating fixed expenses:', error);
            return 0;
        }
    }
    
    calculateVariableExpenses() {
        try {
            const totalExpenses = this.calculateTotalExpenses();
            const fixedExpenses = this.calculateFixedExpenses();
            const result = totalExpenses - fixedExpenses;
            
            // Ensure non-negative result
            return Math.max(0, result);
        } catch (error) {
            console.error('Error calculating variable expenses:', error);
            return 0;
        }
    }
    
    calculateVariableBudget() {
        try {
            const income = parseFloat(this.settings.income) || 0;
            const fixedExpenses = this.calculateFixedExpenses();
            const result = income - fixedExpenses;
            
            // Ensure non-negative result
            return Math.max(0, result);
        } catch (error) {
            console.error('Error calculating variable budget:', error);
            return 0;
        }
    }
    
    calculateSavings() {
        try {
            const income = parseFloat(this.settings.income) || 0;
            const totalExpenses = this.calculateTotalExpenses();
            
            return income - totalExpenses;
        } catch (error) {
            console.error('Error calculating savings:', error);
            return 0;
        }
    }
    
    calculateBudgetLeft() {
        try {
            const variableBudget = this.calculateVariableBudget();
            const variableExpenses = this.calculateVariableExpenses();
            
            return variableBudget - variableExpenses;
        } catch (error) {
            console.error('Error calculating budget left:', error);
            return 0;
        }
    }
    
    calculateSpendingPercentage() {
        try {
            const variableExpenses = this.calculateVariableExpenses();
            const variableBudget = this.calculateVariableBudget();
            
            // Handle division by zero
            if (variableBudget === 0) {
                // If there's no budget but there are expenses, return 100%
                return variableExpenses > 0 ? 100 : 0;
            }
            
            const percentage = (variableExpenses / variableBudget) * 100;
            
            // Round and ensure it's a valid number
            const rounded = Math.round(percentage);
            return isNaN(rounded) ? 0 : rounded;
        } catch (error) {
            console.error('Error calculating spending percentage:', error);
            return 0;
        }
    }
    
    calculateDailyAverage() {
        try {
            const variableExpenses = this.calculateVariableExpenses();
            const now = new Date();
            const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            
            // Handle division by zero (should never happen, but be safe)
            if (daysInMonth === 0) {
                return 0;
            }
            
            const average = variableExpenses / daysInMonth;
            return isNaN(average) ? 0 : average;
        } catch (error) {
            console.error('Error calculating daily average:', error);
            return 0;
        }
    }
    
    calculateWeeklySpending() {
        try {
            // Handle empty expense arrays gracefully
            if (!Array.isArray(this.expenses) || this.expenses.length === 0) {
                return 0;
            }
            
            const now = new Date();
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
            startOfWeek.setHours(0, 0, 0, 0);
            
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6); // Saturday
            endOfWeek.setHours(23, 59, 59, 999);
            
            return this.expenses
                .filter(expense => {
                    try {
                        // Handle invalid date inputs
                        const expenseDate = new Date(expense.date);
                        if (isNaN(expenseDate.getTime())) {
                            console.warn('Invalid expense date:', expense.date);
                            return false;
                        }
                        return expenseDate >= startOfWeek && expenseDate <= endOfWeek;
                    } catch (error) {
                        console.warn('Error parsing expense date:', expense.date, error);
                        return false;
                    }
                })
                .reduce((total, expense) => {
                    const amount = parseFloat(expense.amount);
                    if (isNaN(amount) || amount < 0) {
                        return total;
                    }
                    return total + amount;
                }, 0);
        } catch (error) {
            console.error('Error calculating weekly spending:', error);
            return 0;
        }
    }
    
    // Dashboard UI Update Methods
    updateDashboard() {
        // Calculate all metrics using calculation methods
        const income = this.settings.income || 0;
        const totalExpenses = this.calculateTotalExpenses();
        const variableExpenses = this.calculateVariableExpenses();
        const savings = this.calculateSavings();
        const budgetLeft = this.calculateBudgetLeft();
        const dailyAverage = this.calculateDailyAverage();
        const weeklySpending = this.calculateWeeklySpending();
        
        // Update summary cards
        const totalIncomeEl = document.getElementById('total-income');
        const totalExpensesEl = document.getElementById('total-expenses');
        const variableExpensesEl = document.getElementById('variable-expenses');
        const totalSavingsEl = document.getElementById('total-savings');
        const budgetLeftEl = document.getElementById('budget-left');
        
        if (totalIncomeEl) {
            this.animateNumber(totalIncomeEl, 0, income, 800, '$', '', true); // HIDE in privacy
        }
        if (totalExpensesEl) {
            this.animateNumber(totalExpensesEl, 0, totalExpenses, 800, '$', '', false); // ALWAYS SHOW
        }
        if (variableExpensesEl) {
            this.animateNumber(variableExpensesEl, 0, variableExpenses, 800, '$', '', false); // ALWAYS SHOW
        }
        if (totalSavingsEl) {
            this.animateNumber(totalSavingsEl, 0, savings, 800, '$', '', true); // HIDE in privacy
        }
        if (budgetLeftEl) {
            this.animateNumber(budgetLeftEl, 0, budgetLeft, 800, '$', '', false); // ALWAYS SHOW
        }
        
        // Update daily average and weekly spending displays
        const dailyAverageEl = document.getElementById('daily-average');
        const weeklySpendingEl = document.getElementById('weekly-spending');
        
        if (dailyAverageEl) {
            this.animateNumber(dailyAverageEl, 0, dailyAverage, 800, '$', '', false); // ALWAYS SHOW
        }
        if (weeklySpendingEl) {
            this.animateNumber(weeklySpendingEl, 0, weeklySpending, 800, '$', '', false); // ALWAYS SHOW
        }
        
        // Update spending gauge
        this.updateGauge();
        
        // Update transactions list
        this.updateTransactionsList();
    }
    
    updateGauge() {
        const gauge = document.querySelector('.gauge-progress');
        const amountSpent = document.querySelector('.amount-spent');
        const amountTotal = document.querySelector('.amount-total');
        const percentage = document.querySelector('.percentage');
        const statusIndicator = document.querySelector('.status-indicator');

        if (!gauge) return;

        // Calculate spending percentage using real data
        const spentPercentage = this.calculateSpendingPercentage();
        const variableExpenses = this.calculateVariableExpenses();
        const variableBudget = this.calculateVariableBudget();

        // Animate gauge arc
        const dashArray = `${spentPercentage} ${100 - spentPercentage}`;
        
        // Smooth animation
        gauge.style.transition = 'stroke-dasharray 1.2s cubic-bezier(0.4, 0, 0.2, 1)';
        gauge.style.strokeDasharray = dashArray;

        // Update gauge text (spent, budget, percentage)
        if (amountSpent) {
            this.animateNumber(amountSpent, 0, variableExpenses, 1200, '$', '', false); // ALWAYS SHOW
        }
        if (amountTotal) {
            const budgetText = variableBudget.toLocaleString();
            amountTotal.textContent = `of $${budgetText}`;
        }
        if (percentage) {
            this.animateNumber(percentage, 0, spentPercentage, 1200, '', '%');
        }

        // Update status indicator color and message based on thresholds
        if (statusIndicator) {
            statusIndicator.className = 'status-indicator';
            const statusMessage = statusIndicator.querySelector('span');
            
            if (spentPercentage < 70) {
                statusIndicator.classList.add('good');
                if (statusMessage) statusMessage.textContent = 'On track for month';
            } else if (spentPercentage <= 90) {
                statusIndicator.classList.add('warning');
                if (statusMessage) statusMessage.textContent = 'Approaching limit';
            } else {
                statusIndicator.classList.add('danger');
                if (statusMessage) statusMessage.textContent = 'Over budget';
            }
        }

        // Update gauge color based on percentage
        this.updateGaugeColor(spentPercentage);
    }
    
    updateTransactionsList() {
        const transactionsContainer = document.getElementById('recent-transactions');
        if (!transactionsContainer) return;
        
        // Category emoji mapping
        const CATEGORY_EMOJIS = {
            'Food': '🍔',
            'Transportation': '🚗',
            'Entertainment': '🎬',
            'Coffee': '☕',
            'Shopping': '🛍️',
            'Bills': '📄',
            'Other': '📦'
        };
        
        // Get recent expenses (last 10)
        const recentExpenses = [...this.expenses]
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 10);
        
        // Generate HTML for each transaction
        const transactionsHTML = recentExpenses.map(expense => {
            const emoji = CATEGORY_EMOJIS[expense.category] || '📦';
            const relativeTime = this.formatRelativeTime(expense.date);
            
            return `
                <div class="transaction-item" data-expense-id="${expense.id}">
                    <div class="transaction-info">
                        <div class="transaction-category ${expense.category.toLowerCase()}">
                            ${emoji}
                        </div>
                        <div class="transaction-details">
                            <div class="transaction-description">${expense.description}</div>
                            <div class="transaction-time">${relativeTime}</div>
                        </div>
                    </div>
                    <div class="transaction-actions">
                        <div class="transaction-amount">-${this.formatAmount(expense.amount, false).replace('$', '')}</div> <!-- Keep negative, always show -->
                        <div class="transaction-buttons">
                            <button class="edit-btn" onclick="window.glassTracker.showEditModal(${expense.id})" title="Edit">✏️</button>
                            <button class="delete-btn" onclick="window.glassTracker.confirmDelete(${expense.id})" title="Delete">🗑️</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        // Update container
        transactionsContainer.innerHTML = transactionsHTML || '<div class="no-transactions">No transactions yet. Add your first expense!</div>';
        
        // Re-apply animations
        this.setupTransactionAnimations();
    }
    
    formatRelativeTime(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    
    // Settings Management Methods
    updateIncome(amount) {
        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount) || parsedAmount < 0) {
            throw new Error('Income must be a valid non-negative number');
        }
        
        this.settings.income = parsedAmount;
        this.saveSettings();
        this.updateDashboard();
    }
    
    updateFixedExpense(type, amount) {
        const validTypes = ['rent', 'utilities', 'insurance'];
        if (!validTypes.includes(type)) {
            throw new Error(`Invalid fixed expense type: ${type}`);
        }
        
        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount) || parsedAmount < 0) {
            throw new Error('Fixed expense amount must be a valid non-negative number');
        }
        
        this.settings[type] = parsedAmount;
        this.saveSettings();
        this.updateDashboard();
    }
    
    addCategory(name) {
        const trimmedName = name.trim();
        
        // Validate: not empty
        if (!trimmedName) {
            throw new Error('Category name cannot be empty');
        }
        
        // Validate: unique (case-insensitive)
        const existingCategory = this.settings.categories.find(
            cat => cat.toLowerCase() === trimmedName.toLowerCase()
        );
        if (existingCategory) {
            throw new Error('Category already exists');
        }
        
        // Add category
        this.settings.categories.push(trimmedName);
        
        // Initialize goal to 0
        if (!this.settings.goals) {
            this.settings.goals = {};
        }
        this.settings.goals[trimmedName] = 0;
        
        this.saveSettings();
        this.updateCategoryDropdown();
    }
    
    deleteCategory(name) {
        const index = this.settings.categories.indexOf(name);
        if (index === -1) {
            throw new Error('Category not found');
        }
        
        // Don't allow deleting the last category
        if (this.settings.categories.length === 1) {
            throw new Error('Cannot delete the last category');
        }
        
        // Reassign expenses from this category to "Other"
        this.expenses.forEach(expense => {
            if (expense.category === name) {
                expense.category = 'Other';
            }
        });
        this.saveExpenses();
        
        // Remove category
        this.settings.categories.splice(index, 1);
        
        // Remove goal
        if (this.settings.goals && this.settings.goals[name] !== undefined) {
            delete this.settings.goals[name];
        }
        
        this.saveSettings();
        this.updateCategoryDropdown();
        this.updateDashboard();
    }
    
    updateCategoryDropdown() {
        // Update all category select elements
        const categorySelects = document.querySelectorAll('#category-select, .category-select');
        
        categorySelects.forEach(select => {
            const currentValue = select.value;
            
            // Clear and rebuild options
            select.innerHTML = this.settings.categories.map(category => 
                `<option value="${category}">${category}</option>`
            ).join('');
            
            // Restore selection if still valid
            if (this.settings.categories.includes(currentValue)) {
                select.value = currentValue;
            }
        });
        
        // Update categories list in settings
        this.renderCategoriesList();
    }
    
    renderCategoriesList() {
        const categoriesList = document.getElementById('categories-list');
        if (!categoriesList) return;
        
        const CATEGORY_EMOJIS = {
            'Food': '🍔',
            'Transportation': '🚗',
            'Entertainment': '🎬',
            'Coffee': '☕',
            'Shopping': '🛍️',
            'Bills': '📄',
            'Other': '📦'
        };
        
        categoriesList.innerHTML = this.settings.categories.map(category => {
            const emoji = CATEGORY_EMOJIS[category] || '📦';
            return `
                <div class="category-setting-item">
                    <span>${emoji} ${category}</span>
                    <button class="delete-category-btn" onclick="window.glassTracker.handleDeleteCategory('${category}')">
                        🗑️
                    </button>
                </div>
            `;
        }).join('');
    }
    
    handleDeleteCategory(categoryName) {
        if (confirm(`Are you sure you want to delete the "${categoryName}" category? All expenses in this category will be moved to "Other".`)) {
            try {
                this.deleteCategory(categoryName);
                this.showToast(`Category "${categoryName}" deleted successfully!`);
            } catch (error) {
                this.showToast('Error: ' + error.message);
            }
        }
    }
    
    setCategoryGoal(category, amount) {
        if (!this.settings.categories.includes(category)) {
            throw new Error('Category does not exist');
        }
        
        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount) || parsedAmount < 0) {
            throw new Error('Goal amount must be a valid non-negative number');
        }
        
        if (!this.settings.goals) {
            this.settings.goals = {};
        }
        
        this.settings.goals[category] = parsedAmount;
        this.saveSettings();
    }
    
    renderCategoryGoalsSettings() {
        const categoryGoalsList = document.getElementById('category-goals-list');
        if (!categoryGoalsList) return;
        
        categoryGoalsList.innerHTML = this.settings.categories.map(category => {
            const currentGoal = this.settings.goals?.[category] || 0;
            return `
                <div class="form-group">
                    <label>${category}</label>
                    <input 
                        type="number" 
                        class="glass-input category-goal-input" 
                        data-category="${category}"
                        value="${currentGoal}"
                        placeholder="0"
                        min="0"
                        step="0.01"
                    >
                </div>
            `;
        }).join('');
        
        // Add event listeners to goal inputs
        categoryGoalsList.querySelectorAll('.category-goal-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const category = e.target.dataset.category;
                const amount = e.target.value;
                try {
                    this.setCategoryGoal(category, amount);
                    this.showToast(`Goal for ${category} updated!`);
                } catch (error) {
                    this.showToast('Error: ' + error.message);
                    e.target.value = this.settings.goals?.[category] || 0;
                }
            });
        });
    }
    
    // Transactions Page Methods
    renderAllTransactions() {
        console.log('renderAllTransactions called');
        const transactionsContainer = document.getElementById('all-transactions-list');
        console.log('transactionsContainer:', transactionsContainer);
        if (!transactionsContainer) return;
        
        // Category emoji mapping
        const CATEGORY_EMOJIS = {
            'Food': '🍔',
            'Transportation': '🚗',
            'Entertainment': '🎬',
            'Coffee': '☕',
            'Shopping': '🛍️',
            'Bills': '📄',
            'Other': '📦'
        };
        
        // Get filtered expenses
        const filteredExpenses = this.getFilteredExpenses();
        console.log('filteredExpenses:', filteredExpenses);
        console.log('this.expenses:', this.expenses);
        
        // Display all expenses in reverse chronological order (newest first)
        const allExpenses = [...filteredExpenses]
            .sort((a, b) => b.timestamp - a.timestamp);
        
        // Calculate transaction count and total
        const transactionCount = allExpenses.length;
        const transactionTotal = allExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        
        console.log('transactionCount:', transactionCount, 'transactionTotal:', transactionTotal);
        
        // Generate HTML for each transaction
        const transactionsHTML = allExpenses.map(expense => {
            const emoji = CATEGORY_EMOJIS[expense.category] || '📦';
            const relativeTime = this.formatRelativeTime(expense.date);
            
            return `
                <div class="transaction-item" data-expense-id="${expense.id}">
                    <div class="transaction-info">
                        <div class="transaction-category ${expense.category.toLowerCase()}">
                            ${emoji}
                        </div>
                        <div class="transaction-details">
                            <div class="transaction-description">${expense.description}</div>
                            <div class="transaction-time">${relativeTime}</div>
                        </div>
                    </div>
                    <div class="transaction-amount">-${this.formatAmount(expense.amount, false).replace('$', '')}</div> <!-- Keep negative, always show -->
                </div>
            `;
        }).join('');
        
        // Update container with transaction count and total
        const headerHTML = `
            <div class="transactions-summary">
                <div class="summary-stat">
                    <span class="stat-label">Total Transactions:</span>
                    <span class="stat-value">${transactionCount}</span>
                </div>
                <div class="summary-stat">
                    <span class="stat-label">Total Amount:</span>
                    <span class="stat-value">${this.formatAmount(transactionTotal, false)}</span> <!-- ALWAYS SHOW, no negative -->
                </div>
            </div>
        `;
        
        transactionsContainer.innerHTML = headerHTML + (transactionsHTML || '<div class="no-transactions">No transactions match the selected filters.</div>');
    }
    
    getFilteredExpenses() {
        let filtered = [...this.expenses];
        
        // Get filter values
        const startDate = document.getElementById('date-filter-start')?.value;
        const endDate = document.getElementById('date-filter-end')?.value;
        const category = document.getElementById('category-filter')?.value;
        
        // Apply date range filter
        if (startDate || endDate) {
            filtered = this.getExpensesByDateRange(startDate, endDate);
        }
        
        // Apply category filter
        if (category) {
            filtered = this.getExpensesByCategory(category, filtered);
        }
        
        return filtered;
    }
    
    getExpensesByDateRange(startDate, endDate) {
        return this.expenses.filter(expense => {
            const expenseDate = new Date(expense.date);
            
            // If only start date is provided
            if (startDate && !endDate) {
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                return expenseDate >= start;
            }
            
            // If only end date is provided
            if (!startDate && endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                return expenseDate <= end;
            }
            
            // If both dates are provided
            if (startDate && endDate) {
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                return expenseDate >= start && expenseDate <= end;
            }
            
            return true;
        });
    }
    
    getExpensesByCategory(category, expenses = null) {
        const expensesToFilter = expenses || this.expenses;
        return expensesToFilter.filter(expense => expense.category === category);
    }
    
    setupTransactionsFilters() {
        // Wire up filter controls to update display
        const startDateFilter = document.getElementById('date-filter-start');
        const endDateFilter = document.getElementById('date-filter-end');
        const categoryFilter = document.getElementById('category-filter');
        const exportBtn = document.getElementById('export-csv-btn');
        
        if (startDateFilter) {
            startDateFilter.addEventListener('change', () => {
                this.renderAllTransactions();
            });
        }
        
        if (endDateFilter) {
            endDateFilter.addEventListener('change', () => {
                this.renderAllTransactions();
            });
        }
        
        if (categoryFilter) {
            categoryFilter.addEventListener('change', () => {
                this.renderAllTransactions();
            });
        }
        
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportToCSV();
            });
        }
    }
    
    setupHistoryPageListeners() {
        // Wire up history page month/year selectors
        const monthSelect = document.getElementById('history-month-select');
        const yearSelect = document.getElementById('history-year-select');
        
        if (monthSelect) {
            monthSelect.addEventListener('change', () => {
                this.updateHistoryPage();
            });
        }
        
        if (yearSelect) {
            yearSelect.addEventListener('change', () => {
                this.updateHistoryPage();
            });
        }
    }
    
    exportToCSV() {
        // Get filtered expenses
        const expensesToExport = this.getFilteredExpenses();
        
        if (expensesToExport.length === 0) {
            this.showToast('No transactions to export');
            return;
        }
        
        // Format CSV with headers: Date, Description, Category, Amount
        const headers = ['Date', 'Description', 'Category', 'Amount'];
        const csvRows = [headers.join(',')];
        
        // Sort by date (oldest first for CSV)
        const sortedExpenses = [...expensesToExport].sort((a, b) => 
            new Date(a.date) - new Date(b.date)
        );
        
        // Add data rows
        sortedExpenses.forEach(expense => {
            const row = [
                expense.date,
                `"${expense.description.replace(/"/g, '""')}"`, // Escape quotes in description
                expense.category,
                expense.amount.toFixed(2)
            ];
            csvRows.push(row.join(','));
        });
        
        // Create CSV content
        const csvContent = csvRows.join('\n');
        
        // Create blob and trigger download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        // Generate filename with current date
        const now = new Date();
        const filename = `expenses_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}.csv`;
        
        // Trigger download
        if (navigator.msSaveBlob) {
            // IE 10+
            navigator.msSaveBlob(blob, filename);
        } else {
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
        
        this.showToast(`Exported ${expensesToExport.length} transactions to CSV`);
    }
    
    // History Page Methods
    getExpensesForMonth(year, month) {
        // Filter expenses by specified month/year
        // month is 1-based (1 = January, 12 = December)
        return this.expenses.filter(expense => {
            const expenseDate = new Date(expense.date);
            return expenseDate.getFullYear() === year && 
                   expenseDate.getMonth() === month - 1; // Convert to 0-based month
        });
    }
    
    calculateMonthlyComparison(year, month) {
        // Get expenses for specified month
        const monthExpenses = this.getExpensesForMonth(year, month);
        
        // Calculate income, expenses, savings for specified month
        const monthTotalExpenses = monthExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        const monthIncome = this.settings.income || 0;
        const monthSavings = monthIncome - monthTotalExpenses;
        
        // Calculate previous month values
        let prevYear = year;
        let prevMonth = month - 1;
        if (prevMonth === 0) {
            prevMonth = 12;
            prevYear = year - 1;
        }
        
        const prevMonthExpenses = this.getExpensesForMonth(prevYear, prevMonth);
        const prevMonthTotalExpenses = prevMonthExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        const prevMonthIncome = this.settings.income || 0; // Assuming income is constant
        const prevMonthSavings = prevMonthIncome - prevMonthTotalExpenses;
        
        // Calculate month-over-month change percentages
        const expensesChange = prevMonthTotalExpenses === 0 
            ? (monthTotalExpenses > 0 ? 100 : 0)
            : ((monthTotalExpenses - prevMonthTotalExpenses) / prevMonthTotalExpenses) * 100;
        
        const savingsChange = prevMonthSavings === 0
            ? (monthSavings > 0 ? 100 : 0)
            : ((monthSavings - prevMonthSavings) / prevMonthSavings) * 100;
        
        return {
            current: {
                income: monthIncome,
                expenses: monthTotalExpenses,
                savings: monthSavings
            },
            previous: {
                income: prevMonthIncome,
                expenses: prevMonthTotalExpenses,
                savings: prevMonthSavings
            },
            changes: {
                expenses: expensesChange,
                savings: savingsChange
            }
        };
    }
    
    updateHistoryPage() {
        // Get selected month/year from selectors
        const monthSelect = document.getElementById('history-month-select');
        const yearSelect = document.getElementById('history-year-select');
        
        if (!monthSelect || !yearSelect) return;
        
        const selectedMonth = parseInt(monthSelect.value);
        const selectedYear = parseInt(yearSelect.value);
        
        // Calculate metrics for selected month
        const comparison = this.calculateMonthlyComparison(selectedYear, selectedMonth);
        
        // Display income, expenses, savings
        const historyIncome = document.getElementById('history-income');
        const historyExpenses = document.getElementById('history-expenses');
        const historySavings = document.getElementById('history-savings');
        
        if (historyIncome) {
            historyIncome.textContent = this.formatAmount(comparison.current.income, true); // HIDE in privacy
        }
        if (historyExpenses) {
            historyExpenses.textContent = this.formatAmount(comparison.current.expenses, false); // ALWAYS SHOW
        }
        if (historySavings) {
            historySavings.textContent = this.formatAmount(comparison.current.savings, true); // HIDE in privacy
        }
        
        // Display comparison with previous month
        const historyComparison = document.getElementById('history-comparison');
        if (historyComparison) {
            const expensesChangeText = comparison.changes.expenses >= 0 
                ? `+${comparison.changes.expenses.toFixed(1)}%` 
                : `${comparison.changes.expenses.toFixed(1)}%`;
            const savingsChangeText = comparison.changes.savings >= 0 
                ? `+${comparison.changes.savings.toFixed(1)}%` 
                : `${comparison.changes.savings.toFixed(1)}%`;
            
            const expensesClass = comparison.changes.expenses > 0 ? 'negative' : 'positive';
            const savingsClass = comparison.changes.savings > 0 ? 'positive' : 'negative';
            
            historyComparison.innerHTML = `
                <div class="comparison-item">
                    <span class="comparison-label">Expenses vs Previous Month:</span>
                    <span class="comparison-value ${expensesClass}">${expensesChangeText}</span>
                </div>
                <div class="comparison-item">
                    <span class="comparison-label">Savings vs Previous Month:</span>
                    <span class="comparison-value ${savingsClass}">${savingsChangeText}</span>
                </div>
            `;
        }
        
        // Display category breakdown for month
        const monthExpenses = this.getExpensesForMonth(selectedYear, selectedMonth);
        
        // Handle months with no data gracefully
        if (monthExpenses.length === 0) {
            const categoryBreakdown = document.getElementById('history-category-breakdown');
            if (categoryBreakdown) {
                categoryBreakdown.innerHTML = '<div class="no-data">No expenses recorded for this month.</div>';
            }
            return;
        }
        
        // Group expenses by category for the selected month
        const categoryTotals = {};
        monthExpenses.forEach(expense => {
            const category = expense.category || 'Other';
            if (!categoryTotals[category]) {
                categoryTotals[category] = 0;
            }
            categoryTotals[category] += expense.amount;
        });
        
        // Display category breakdown
        const categoryBreakdown = document.getElementById('history-category-breakdown');
        if (categoryBreakdown) {
            const CATEGORY_EMOJIS = {
                'Food': '🍔',
                'Transportation': '🚗',
                'Entertainment': '🎬',
                'Coffee': '☕',
                'Shopping': '🛍️',
                'Bills': '📄',
                'Other': '📦'
            };
            
            const categoryHTML = Object.entries(categoryTotals)
                .sort((a, b) => b[1] - a[1]) // Sort by amount descending
                .map(([category, amount]) => {
                    const emoji = CATEGORY_EMOJIS[category] || '📦';
                    const percentage = (amount / comparison.current.expenses) * 100;
                    
                    return `
                        <div class="history-category-item">
                            <div class="category-info">
                                <span class="category-emoji">${emoji}</span>
                                <span class="category-name">${category}</span>
                            </div>
                            <div class="category-stats">
                                <span class="category-amount">${this.formatAmount(amount, false)}</span> <!-- ALWAYS SHOW -->
                                <span class="category-percentage">${percentage.toFixed(1)}%</span>
                            </div>
                        </div>
                    `;
                }).join('');
            
            categoryBreakdown.innerHTML = categoryHTML;
        }
    }
    
    // Privacy Mode Methods
    togglePrivacyMode() {
        // Toggle settings.privacyMode boolean
        this.settings.privacyMode = !this.settings.privacyMode;
        
        // Save settings to localStorage
        this.saveSettings();
        
        // Call updateAllDisplays() to refresh UI
        this.updateAllDisplays();
        
        // Show feedback to user
        const status = this.settings.privacyMode ? 'enabled' : 'disabled';
        this.showToast(`Privacy mode ${status}`);
    }
    
    formatAmount(amount, hideInPrivacy = false) {
        // Check if privacy mode is enabled AND hideInPrivacy is true
        if (this.settings.privacyMode && hideInPrivacy) {
            // Return "****" if enabled
            return '****';
        }
        
        // Return formatted amount if not
        return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    
    updateAllDisplays() {
        // Refresh all UI elements that display amounts
        this.updateDashboard();
        this.updateOverviewPage();
        this.renderAllTransactions();
        this.updateHistoryPage();
    }
    
    // Placeholder methods for edit/delete functionality (will be implemented in task 11)
    showEditModal(expenseId) {
        // Get expense by ID
        const expense = this.expenses.find(exp => exp.id === expenseId);
        if (!expense) {
            this.showToast('Expense not found');
            return;
        }
        
        // Get modal and form elements
        const modal = document.getElementById('edit-expense-modal');
        const form = document.getElementById('edit-expense-form');
        
        // Populate form fields with expense data
        document.getElementById('edit-expense-id').value = expense.id;
        document.getElementById('edit-amount').value = expense.amount;
        document.getElementById('edit-description').value = expense.description;
        document.getElementById('edit-category').value = expense.category;
        document.getElementById('edit-date').value = expense.date;
        
        // Setup validation for edit form
        this.setupEditFormValidation();
        
        // Show modal
        modal.style.display = 'flex';
        
        // Focus on first input
        setTimeout(() => {
            document.getElementById('edit-amount').focus();
        }, 100);
    }
    
    setupEditFormValidation() {
        const editAmountInput = document.getElementById('edit-amount');
        const editDescriptionInput = document.getElementById('edit-description');
        const editForm = document.getElementById('edit-expense-form');
        const submitButton = editForm?.querySelector('button[type="submit"]');
        
        if (!editAmountInput || !editDescriptionInput || !editForm) return;
        
        // Create error containers if they don't exist
        this.createErrorContainer(editAmountInput, 'edit-amount-error');
        this.createErrorContainer(editDescriptionInput, 'edit-description-error');
        
        // Remove existing listeners to avoid duplicates
        const newAmountInput = editAmountInput.cloneNode(true);
        const newDescriptionInput = editDescriptionInput.cloneNode(true);
        editAmountInput.parentNode.replaceChild(newAmountInput, editAmountInput);
        editDescriptionInput.parentNode.replaceChild(newDescriptionInput, editDescriptionInput);
        
        // Add validation listeners
        newAmountInput.addEventListener('input', (e) => {
            this.validateEditAmountInput(e.target);
            this.updateEditSubmitButtonState(editForm, submitButton);
        });
        
        newDescriptionInput.addEventListener('input', (e) => {
            this.validateEditDescriptionInput(e.target);
            this.updateEditSubmitButtonState(editForm, submitButton);
        });
        
        // Initial validation
        this.updateEditSubmitButtonState(editForm, submitButton);
    }
    
    validateEditAmountInput(input) {
        const errorContainer = document.getElementById('edit-amount-error');
        if (!errorContainer) return true;
        
        const value = input.value.trim();
        const amount = parseFloat(value);
        
        if (value === '') {
            this.showInputError(input, errorContainer, 'Amount is required');
            return false;
        }
        
        if (isNaN(amount)) {
            this.showInputError(input, errorContainer, 'Please enter a valid number');
            return false;
        }
        
        if (amount <= 0) {
            this.showInputError(input, errorContainer, 'Amount must be greater than 0');
            return false;
        }
        
        this.hideInputError(input, errorContainer);
        return true;
    }
    
    validateEditDescriptionInput(input) {
        const errorContainer = document.getElementById('edit-description-error');
        if (!errorContainer) return true;
        
        const value = input.value.trim();
        
        if (value === '') {
            this.showInputError(input, errorContainer, 'Description is required');
            return false;
        }
        
        this.hideInputError(input, errorContainer);
        return true;
    }
    
    updateEditSubmitButtonState(form, submitButton) {
        if (!submitButton) return;
        
        const editAmountInput = document.getElementById('edit-amount');
        const editDescriptionInput = document.getElementById('edit-description');
        
        if (!editAmountInput || !editDescriptionInput) return;
        
        const amountValid = this.validateEditAmountInput(editAmountInput);
        const descriptionValid = this.validateEditDescriptionInput(editDescriptionInput);
        
        if (!amountValid || !descriptionValid) {
            submitButton.disabled = true;
            submitButton.style.opacity = '0.5';
            submitButton.style.cursor = 'not-allowed';
        } else {
            submitButton.disabled = false;
            submitButton.style.opacity = '1';
            submitButton.style.cursor = 'pointer';
        }
    }
    
    closeEditModal() {
        const modal = document.getElementById('edit-expense-modal');
        modal.style.display = 'none';
        
        // Reset form
        document.getElementById('edit-expense-form').reset();
    }
    
    saveEditedExpense(event) {
        if (event) {
            event.preventDefault();
        }
        
        // Get form values
        const expenseId = parseInt(document.getElementById('edit-expense-id').value);
        const amountInput = document.getElementById('edit-amount');
        const descriptionInput = document.getElementById('edit-description');
        const category = document.getElementById('edit-category').value;
        const date = document.getElementById('edit-date').value;
        
        // Validate inputs
        const amountValid = this.validateEditAmountInput(amountInput);
        const descriptionValid = this.validateEditDescriptionInput(descriptionInput);
        
        if (!amountValid || !descriptionValid) {
            this.showToast('Please fix the errors before saving');
            return;
        }
        
        const amount = parseFloat(amountInput.value);
        const description = descriptionInput.value.trim();
        
        if (!category) {
            this.showToast('Please select a category');
            return;
        }
        
        if (!date) {
            this.showToast('Please select a date');
            return;
        }
        
        // Call editExpense with updates
        try {
            this.editExpense(expenseId, {
                amount: amount,
                description: description,
                category: category,
                date: date
            });
            
            // Close modal and refresh UI
            this.closeEditModal();
            this.updateDashboard();
            this.showToast('Expense updated successfully!');
        } catch (error) {
            this.showToast('Error updating expense: ' + error.message);
        }
    }
    
    confirmDelete(expenseId) {
        if (confirm('Are you sure you want to delete this expense?')) {
            try {
                this.deleteExpense(expenseId);
                this.updateDashboard();
                this.showToast('Expense deleted successfully!');
            } catch (error) {
                this.showToast('Error deleting expense: ' + error.message);
            }
        }
    }
    
    // Firebase Firestore Sync Methods
    
    /**
     * Check if the app is online
     * @returns {boolean} True if online, false if offline
     */
    isOnline() {
        return navigator.onLine;
    }
    
    /**
     * Update sync status indicator in the UI
     * @param {string} status - Status: 'synced', 'syncing', 'offline', 'error'
     * @param {string} message - Optional message to display
     */
    updateSyncStatus(status, message = '') {
        const syncIndicator = document.getElementById('sync-status-indicator');
        if (!syncIndicator) return;
        
        // Update indicator class and content
        syncIndicator.className = `sync-status ${status}`;
        
        let icon = '';
        let text = '';
        
        switch (status) {
            case 'synced':
                icon = '✓';
                text = message || 'Synced';
                break;
            case 'syncing':
                icon = '↻';
                text = message || 'Syncing...';
                break;
            case 'offline':
                icon = '⚠';
                text = message || 'Offline';
                break;
            case 'error':
                icon = '✕';
                text = message || 'Sync failed';
                break;
            default:
                icon = '';
                text = '';
        }
        
        syncIndicator.innerHTML = `<span class="sync-icon">${icon}</span><span class="sync-text">${text}</span>`;
        
        // Auto-hide success message after 3 seconds
        if (status === 'synced') {
            setTimeout(() => {
                syncIndicator.style.opacity = '0';
                setTimeout(() => {
                    syncIndicator.style.opacity = '1';
                    syncIndicator.innerHTML = '';
                }, 300);
            }, 3000);
        }
    }
    
    /**
     * Sync expenses and settings to Firestore
     * Called when user is authenticated and data changes
     */
    async syncToFirestore() {
        // Check if Firestore is available
        if (!window.firebaseDb) {
            console.warn('Firestore not initialized. Skipping sync.');
            this.updateSyncStatus('offline', 'Local only');
            return;
        }
        
        // Check if user is authenticated
        const user = window.getCurrentUser ? window.getCurrentUser() : null;
        if (!user) {
            console.warn('User not authenticated. Skipping sync.');
            this.updateSyncStatus('offline', 'Not signed in');
            return;
        }
        
        // Check if online
        if (!this.isOnline()) {
            console.warn('Device is offline. Skipping sync.');
            this.updateSyncStatus('offline', 'Offline - saved locally');
            
            // Data is already saved to localStorage, so we're good
            return;
        }
        
        try {
            // Show syncing status
            this.updateSyncStatus('syncing');
            
            const userId = user.uid;
            
            // Reference to user's document in Firestore
            const userDocRef = window.firebaseDb.collection('users').doc(userId);
            
            // Prepare data to sync
            const dataToSync = {
                expenses: this.expenses,
                settings: this.settings,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            // Sync to Firestore using set with merge option
            await userDocRef.set(dataToSync, { merge: true });
            
            console.log('Successfully synced to Firestore');
            
            // Update last sync timestamp in localStorage
            if (this.storageAvailable) {
                localStorage.setItem('glassui_lastSync', Date.now().toString());
            }
            
            // Show success status
            this.updateSyncStatus('synced', 'Synced to cloud');
        } catch (error) {
            console.error('Error syncing to Firestore:', error);
            
            // Handle specific Firestore errors
            if (error.code === 'permission-denied') {
                this.updateSyncStatus('error', 'Permission denied');
                this.showToast('⚠️ Permission denied. Changes saved locally.');
            } else if (error.code === 'unavailable' || error.code === 'unavailable') {
                this.updateSyncStatus('offline', 'Network error');
                this.showToast('⚠️ Network error. Changes saved locally.');
            } else if (error.message && error.message.includes('network')) {
                this.updateSyncStatus('offline', 'Network error');
                this.showToast('⚠️ Network error. Changes saved locally.');
            } else {
                this.updateSyncStatus('error', 'Sync failed');
                this.showToast('⚠️ Sync failed. Changes saved locally.');
            }
            
            // Data is still saved locally, so the app continues to work
        }
    }
    
    /**
     * Load expenses and settings from Firestore
     * Called when user signs in
     */
    async loadFromFirestore() {
        // Check if Firestore is available
        if (!window.firebaseDb) {
            console.warn('Firestore not initialized. Using local data.');
            this.updateSyncStatus('offline', 'Local only');
            return;
        }
        
        // Check if user is authenticated
        const user = window.getCurrentUser ? window.getCurrentUser() : null;
        if (!user) {
            console.warn('User not authenticated. Using local data.');
            this.updateSyncStatus('offline', 'Not signed in');
            return;
        }
        
        // Check if online
        if (!this.isOnline()) {
            console.warn('Device is offline. Using local data.');
            this.updateSyncStatus('offline', 'Offline - using local data');
            this.showToast('📱 Offline mode - using local data');
            return;
        }
        
        try {
            // Show syncing status
            this.updateSyncStatus('syncing', 'Loading from cloud...');
            
            const userId = user.uid;
            
            // Reference to user's document in Firestore
            const userDocRef = window.firebaseDb.collection('users').doc(userId);
            
            // Get document from Firestore
            const doc = await userDocRef.get();
            
            if (doc.exists) {
                const data = doc.data();
                
                // Load expenses if available
                if (data.expenses && Array.isArray(data.expenses)) {
                    this.expenses = data.expenses;
                    
                    // Also save to localStorage as backup
                    this.saveExpenses();
                }
                
                // Load settings if available
                if (data.settings && typeof data.settings === 'object') {
                    // Merge with defaults to ensure all required fields exist
                    this.settings = { ...this.getDefaultSettings(), ...data.settings };
                    
                    // Also save to localStorage as backup
                    this.saveSettings();
                }
                
                // Update UI with loaded data
                this.updateDashboard();
                
                console.log('Successfully loaded from Firestore');
                this.updateSyncStatus('synced', 'Loaded from cloud');
                this.showToast('✨ Data synced from cloud');
                
                // Update last sync timestamp
                if (this.storageAvailable) {
                    localStorage.setItem('glassui_lastSync', Date.now().toString());
                }
            } else {
                // No data in Firestore yet - sync current local data
                console.log('No Firestore data found. Syncing local data to cloud.');
                await this.syncToFirestore();
            }
        } catch (error) {
            console.error('Error loading from Firestore:', error);
            
            // Handle specific Firestore errors
            if (error.code === 'permission-denied') {
                this.updateSyncStatus('error', 'Permission denied');
                this.showToast('⚠️ Permission denied. Using local data.');
            } else if (error.code === 'unavailable' || error.message.includes('network')) {
                this.updateSyncStatus('offline', 'Network error');
                this.showToast('⚠️ Network error. Using local data.');
            } else {
                this.updateSyncStatus('error', 'Load failed');
                this.showToast('⚠️ Failed to load from cloud. Using local data.');
            }
            
            // Fall back to local data - app continues to work
        }
    }
}

// Global function for HTML onclick events
function showPage(pageId) {
    if (window.glassTracker) {
        window.glassTracker.showPage(pageId);
    }
}

// Global functions for Firestore sync (called from auth.js)
window.syncToFirestore = function() {
    if (window.glassTracker) {
        window.glassTracker.syncToFirestore();
    }
};

window.loadFromFirestore = function() {
    if (window.glassTracker) {
        window.glassTracker.loadFromFirestore();
    }
};

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.glassTracker = new ExpenseTracker();
});

// Service Worker registration for PWA functionality
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => console.log('SW registered'))
            .catch(error => console.log('SW registration failed'));
    });
}

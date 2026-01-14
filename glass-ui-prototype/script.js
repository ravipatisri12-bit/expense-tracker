/* Glass UI Expense Tracker - Interactive JavaScript */

class GlassExpenseTracker {
    constructor() {
        this.currentPage = 'home';
        this.expenses = this.loadExpenses();
        this.settings = this.loadSettings();
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updateGauge();
        this.updateDateTime();
        this.setupTransactionAnimations();
        
        // Update time every minute
        setInterval(() => this.updateDateTime(), 60000);
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

        // Touch interactions for mobile
        this.setupTouchGestures();
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

    updateGauge() {
        const gauge = document.querySelector('.gauge-progress');
        const amountSpent = document.querySelector('.amount-spent');
        const amountTotal = document.querySelector('.amount-total');
        const percentage = document.querySelector('.percentage');
        const statusIndicator = document.querySelector('.status-indicator');

        if (!gauge) return;

        // Calculate current spending (mock data for prototype)
        const spent = 1247;
        const budget = 2000;
        const spentPercentage = Math.round((spent / budget) * 100);

        // Animate gauge
        const circumference = 2 * Math.PI * 85; // radius = 85
        const dashArray = `${spentPercentage} ${100 - spentPercentage}`;
        
        // Smooth animation
        gauge.style.transition = 'stroke-dasharray 1.2s cubic-bezier(0.4, 0, 0.2, 1)';
        gauge.style.strokeDasharray = dashArray;

        // Update text content
        if (amountSpent) {
            this.animateNumber(amountSpent, 0, spent, 1200, '$');
        }
        if (percentage) {
            this.animateNumber(percentage, 0, spentPercentage, 1200, '', '%');
        }

        // Update status indicator
        if (statusIndicator) {
            statusIndicator.className = 'status-indicator';
            if (spentPercentage <= 60) {
                statusIndicator.classList.add('good');
                statusIndicator.querySelector('span').textContent = 'On track for month';
            } else if (spentPercentage <= 85) {
                statusIndicator.classList.add('warning');
                statusIndicator.querySelector('span').textContent = 'Approaching limit';
            } else {
                statusIndicator.classList.add('danger');
                statusIndicator.querySelector('span').textContent = 'Over budget';
            }
        }

        // Update gauge color based on percentage
        this.updateGaugeColor(spentPercentage);
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

    animateNumber(element, start, end, duration, prefix = '', suffix = '') {
        const startTime = Date.now();
        const startValue = start;
        const endValue = end;
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function (ease-out)
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(startValue + (endValue - startValue) * eased);
            
            if (prefix === '$') {
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
                modal.querySelector('#summary-amount').textContent = `$${amount.toFixed(2)}`;
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
            this.updateGauge();
            
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
        
        // Special handling for add page
        if (pageId === 'add') {
            this.showQuickAdd();
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
            }
        }
    }

    updateOverviewPage() {
        // Update dynamic content for Overview page
        this.updateOverviewSummary();
        this.updateCategoryBreakdown();
        this.updateOverviewStats();
        this.updateMonthlyChart();
    }

    updateOverviewSummary() {
        // Calculate summary values (mock data for prototype)
        const income = 5200;
        const expenses = 3847;
        const savings = income - expenses;
        const budgetLeft = 753;

        // Update mini cards
        const incomeCard = document.querySelector('.mini-card.income .mini-card-amount');
        const expensesCard = document.querySelector('.mini-card.expenses .mini-card-amount');
        const savingsCard = document.querySelector('.mini-card.savings .mini-card-amount');
        const budgetCard = document.querySelector('.mini-card.budget .mini-card-amount');

        if (incomeCard) this.animateNumber(incomeCard, 0, income, 800, '$');
        if (expensesCard) this.animateNumber(expensesCard, 0, expenses, 800, '$');
        if (savingsCard) this.animateNumber(savingsCard, 0, savings, 800, '$');
        if (budgetCard) this.animateNumber(budgetCard, 0, budgetLeft, 800, '$');
    }

    updateCategoryBreakdown() {
        // Update category progress bars with animation
        const categories = [
            { name: 'Food & Dining', spent: 417, budget: 500, percentage: 83 },
            { name: 'Transportation', spent: 195, budget: 300, percentage: 65 },
            { name: 'Shopping', spent: 135, budget: 300, percentage: 45 },
            { name: 'Entertainment', spent: 108, budget: 150, percentage: 72 },
            { name: 'Coffee & Drinks', spent: 67, budget: 75, percentage: 90 }
        ];

        categories.forEach((category, index) => {
            const categoryElement = document.querySelectorAll('.category-item')[index];
            if (categoryElement) {
                const progressFill = categoryElement.querySelector('.progress-fill');
                const spentAmount = categoryElement.querySelector('.spent-amount');
                
                // Animate progress bar
                setTimeout(() => {
                    if (progressFill) {
                        progressFill.style.width = `${category.percentage}%`;
                    }
                    if (spentAmount) {
                        this.animateNumber(spentAmount, 0, category.spent, 600, '$');
                    }
                }, index * 200);
            }
        });
    }

    updateOverviewStats() {
        // Update daily average and weekly trend
        const dailyAverage = 42.50;
        const weeklyAmount = 284;

        const dailyElement = document.querySelector('.daily-average-card .stat-amount');
        const weeklyElement = document.querySelector('.weekly-trend-card .stat-amount');

        if (dailyElement) {
            setTimeout(() => {
                this.animateNumber(dailyElement, 0, dailyAverage, 600, '$');
            }, 400);
        }

        if (weeklyElement) {
            setTimeout(() => {
                this.animateNumber(weeklyElement, 0, weeklyAmount, 600, '$');
            }, 600);
        }
    }

    updateMonthlyChart() {
        // Animate monthly chart bars
        const monthData = [
            { month: 'Nov', amount: 3245, height: 75 },
            { month: 'Dec', amount: 3891, height: 90 },
            { month: 'Jan', amount: 3847, height: 85 }
        ];

        monthData.forEach((month, index) => {
            const monthBar = document.querySelectorAll('.month-bar')[index];
            if (monthBar) {
                const expenseBar = monthBar.querySelector('.expense-bar');
                const monthAmount = monthBar.querySelector('.month-amount');
                
                setTimeout(() => {
                    if (expenseBar) {
                        expenseBar.style.height = `${month.height}%`;
                    }
                    if (monthAmount) {
                        this.animateNumber(monthAmount, 0, month.amount, 800, '$');
                    }
                }, index * 300);
            }
        });
    }

    loadExpenses() {
        // Mock data for prototype
        return [
            {
                id: 1,
                description: 'Starbucks',
                amount: 5.50,
                category: 'coffee',
                date: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
                timestamp: Date.now() - 2 * 60 * 60 * 1000
            },
            {
                id: 2,
                description: 'Lunch at Chipotle',
                amount: 12.00,
                category: 'food',
                date: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
                timestamp: Date.now() - 4 * 60 * 60 * 1000
            }
        ];
    }

    saveExpenses() {
        // In a real app, this would save to localStorage or backend
        localStorage.setItem('glassui_expenses', JSON.stringify(this.expenses));
    }

    loadSettings() {
        return {
            budget: 2000,
            currency: 'USD'
        };
    }
}

// Global function for HTML onclick events
function showPage(pageId) {
    if (window.glassTracker) {
        window.glassTracker.showPage(pageId);
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.glassTracker = new GlassExpenseTracker();
});

// Service Worker registration for PWA functionality
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => console.log('SW registered'))
            .catch(error => console.log('SW registration failed'));
    });
}

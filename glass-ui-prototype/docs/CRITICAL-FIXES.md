# Critical Fixes to Apply

## 1. Privacy Mode Fix - formatAmount Method

**Location**: `glass-ui-prototype/script.js` around line 2471

**Replace this:**
```javascript
formatAmount(amount) {
    if (this.settings.privacyMode) {
        return '****';
    }
    return `${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
```

**With this:**
```javascript
formatAmount(amount, hideInPrivacy = false) {
    // hideInPrivacy = true: hide in privacy mode (income, savings)
    // hideInPrivacy = false: always show (expenses, variable spending)
    if (this.settings.privacyMode && hideInPrivacy) {
        return '****';
    }
    return `${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
```

## 2. Update formatAmount Calls for Income/Savings

**Find and update these calls to use `hideInPrivacy = true`:**

### In updateDashboard() method:
```javascript
// Income - HIDE in privacy mode
document.getElementById('total-income').textContent = this.formatAmount(income, true);

// Savings - HIDE in privacy mode  
document.getElementById('total-savings').textContent = this.formatAmount(savings, true);

// Expenses - ALWAYS SHOW
document.getElementById('total-expenses').textContent = this.formatAmount(totalExpenses, false);

// Variable - ALWAYS SHOW
document.getElementById('variable-expenses').textContent = this.formatAmount(variableExpenses, false);

// Budget Left - ALWAYS SHOW
document.getElementById('budget-left').textContent = this.formatAmount(budgetLeft, false);
```

### In updateOverviewPage() method:
```javascript
// Income card - HIDE in privacy mode
if (incomeCard) this.animateNumber(incomeCard, 0, income, 800, '$', '', true);

// Savings card - HIDE in privacy mode
if (savingsCard) this.animateNumber(savingsCard, 0, savings, 800, '$', '', true);

// Expenses card - ALWAYS SHOW
if (expensesCard) this.animateNumber(expensesCard, 0, totalExpenses, 800, '$', '', false);

// Budget card - ALWAYS SHOW
if (budgetCard) this.animateNumber(budgetCard, 0, budgetLeft, 800, '$', '', false);
```

### In animateNumber() method (around line 577):
Update to accept hideInPrivacy parameter:
```javascript
animateNumber(element, start, end, duration, prefix = '', suffix = '', hideInPrivacy = false) {
    const startTime = Date.now();
    const startValue = start;
    const endValue = end;
    
    const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(startValue + (endValue - startValue) * eased);
        
        // Use formatAmount with hideInPrivacy parameter
        if (prefix === '$') {
            element.textContent = prefix + this.formatAmount(current, hideInPrivacy);
        } else {
            element.textContent = `${prefix}${current}${suffix}`;
        }
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        }
    };
    
    requestAnimationFrame(animate);
}
```

### In history page methods:
```javascript
// History income - HIDE in privacy mode
historyIncome.textContent = '$' + this.formatAmount(comparison.current.income, true);

// History savings - HIDE in privacy mode
historySavings.textContent = '$' + this.formatAmount(comparison.current.savings, true);

// History expenses - ALWAYS SHOW
historyExpenses.textContent = '$' + this.formatAmount(comparison.current.expenses, false);
```

## 3. Remove Negative Signs from Amounts

**In updateGauge() method (around line 530):**
```javascript
// Update text content (NO negative sign)
if (amountSpent) {
    this.animateNumber(amountSpent, 0, spent, 1200, '$', '', false);  // false = always show
}
```

**In transaction displays:**
Remove the minus sign from transaction amounts:
```javascript
// OLD:
<div class="transaction-amount">-${this.formatAmount(expense.amount)}</div>

// NEW:
<div class="transaction-amount">${this.formatAmount(expense.amount, false)}</div>
```

## 4. Increase Gauge Size

**Location**: `glass-ui-prototype/styles.css`

**Find:**
```css
.spending-gauge {
    position: relative;
    width: 200px;
    height: 200px;
}
```

**Replace with:**
```css
.spending-gauge {
    position: relative;
    width: 280px;
    height: 280px;
}

.gauge-svg {
    width: 100%;
    height: 100%;
    transform: rotate(-90deg);
}

/* Adjust center text for larger gauge */
.amount-spent {
    font-size: 42px;  /* increased from 36px */
    font-weight: 700;
    color: #ffffff;
    line-height: 1;
    font-variant-numeric: tabular-nums;
}

.amount-total {
    font-size: 18px;  /* increased from 16px */
    color: rgba(255, 255, 255, 0.7);
    margin: 6px 0;  /* increased from 4px */
    font-weight: 500;
}

.percentage {
    font-size: 24px;  /* increased from 20px */
    font-weight: 600;
    color: #007AFF;
    font-variant-numeric: tabular-nums;
}
```

## 5. Update Gauge HTML

**Location**: `glass-ui-prototype/index.html`

**Find the gauge SVG and update viewBox and radius:**
```html
<svg class="gauge-svg" viewBox="0 0 280 280">
    <circle 
        cx="140" 
        cy="140" 
        r="120" 
        class="gauge-bg"
        fill="none" 
        stroke="rgba(255,255,255,0.1)" 
        stroke-width="10"
    />
    <circle 
        cx="140" 
        cy="140" 
        r="120" 
        class="gauge-progress"
        fill="none" 
        stroke="url(#gaugeGradient)" 
        stroke-width="10"
        stroke-linecap="round"
        pathLength="100"
        style="stroke-dasharray: 62 38; stroke-dashoffset: 0; transform: rotate(-90deg); transform-origin: 50% 50%;"
    />
    <defs>
        <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color:#007AFF;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#34C759;stop-opacity:1" />
        </linearGradient>
    </defs>
</svg>
```

## 6. Change "Variable Spending" to "Monthly Spending"

**Location**: `glass-ui-prototype/index.html`

**Find:**
```html
<h2>Variable Spending</h2>
```

**Replace with:**
```html
<h2>Monthly Spending</h2>
```

## 7. Update updateGauge() to Use Real Data

**Location**: `glass-ui-prototype/script.js` around line 530

**Replace mock data with:**
```javascript
updateGauge() {
    const gauge = document.querySelector('.gauge-progress');
    const amountSpent = document.querySelector('.amount-spent');
    const amountTotal = document.querySelector('.amount-total');
    const percentage = document.querySelector('.percentage');
    const statusIndicator = document.querySelector('.status-indicator');

    if (!gauge) return;

    // Calculate current spending from actual data
    const spent = this.calculateVariableExpenses();
    const budget = this.calculateVariableBudget();
    const spentPercentage = budget > 0 ? Math.round((spent / budget) * 100) : 0;

    // Update gauge animation
    const dashArray = `${spentPercentage} ${100 - spentPercentage}`;
    gauge.style.transition = 'stroke-dasharray 1.2s cubic-bezier(0.4, 0, 0.2, 1)';
    gauge.style.strokeDasharray = dashArray;

    // Update text content (NO negative sign, always visible)
    if (amountSpent) {
        this.animateNumber(amountSpent, 0, spent, 1200, '$', '', false);
    }
    if (amountTotal) {
        amountTotal.innerHTML = `of $<span id="gauge-budget">${this.formatAmount(budget, false)}</span>`;
    }
    if (percentage) {
        this.animateNumber(percentage, 0, spentPercentage, 1200, '', '%', false);
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

    this.updateGaugeColor(spentPercentage);
}
```

## Summary of Changes

1. ✅ Privacy mode now only hides income and savings
2. ✅ All expense amounts always visible
3. ✅ Removed negative signs from amounts
4. ✅ Increased gauge size to 280px
5. ✅ Changed "Variable Spending" to "Monthly Spending"
6. ✅ Gauge uses real data instead of mock data

## Next Priority Fixes

1. Remove duplicate summary cards from home page
2. Redesign transactions page with date grouping
3. Add sign-in functionality
4. Enable adding transactions by date

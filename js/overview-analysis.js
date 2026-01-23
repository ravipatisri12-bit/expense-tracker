/**
 * Overview and Analysis Tab Components
 * AI-powered behavioral analysis for the Analysis tab
 */

// ====================================================================
// BEHAVIORAL ANALYSIS AI CLASS
// ====================================================================

class BehavioralAnalysisAI {
    constructor(apiKey) {
        this.apiKey = apiKey || 'demo-mode';
        this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';
        this.cache = {};
        this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours
    }
    
    async generatePersonalityProfile(expenses, settings) {
        const cacheKey = 'personality_' + this.hashData(expenses);
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;
        
        if (this.apiKey === 'demo-mode') {
            return this.getDemoPersonalityProfile(expenses, settings);
        }
        
        const prompt = `Analyze this spending data and provide a financial personality assessment:
        
        Monthly Income: ${settings.income}
        Total Expenses: ${this.calculateTotal(expenses)}
        Categories: ${JSON.stringify(this.getCategorySummary(expenses))}
        
        Provide:
        1. Primary personality type (e.g., "Mindful Spender", "Impulse Buyer")
        2. Brief description (2-3 sentences)
        3. 2-3 strengths
        4. 2-3 growth areas
        
        Format as JSON with keys: type, description, strengths[], growthAreas[]
        NO emojis in response.`;
        
        try {
            const result = await this.callGemini(prompt);
            this.saveToCache(cacheKey, result);
            return result;
        } catch (error) {
            console.error('AI API error:', error);
            return this.getDemoPersonalityProfile(expenses, settings);
        }
    }
    
    async detectPrimaryPattern(expenses) {
        const cacheKey = 'pattern_' + this.hashData(expenses);
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;
        
        if (this.apiKey === 'demo-mode') {
            return this.getDemoPattern(expenses);
        }
        
        const prompt = `Analyze spending patterns and identify the PRIMARY behavioral pattern:
        
        Expenses: ${JSON.stringify(expenses.slice(-30))}
        
        Provide:
        1. Pattern name (e.g., "Stress-Induced Shopping")
        2. Confidence level (0-100)
        3. Explanation (2-3 sentences with data)
        4. Specific intervention suggestion
        
        Format as JSON with keys: name, confidence, explanation, intervention
        NO emojis.`;
        
        try {
            const result = await this.callGemini(prompt);
            this.saveToCache(cacheKey, result);
            return result;
        } catch (error) {
            return this.getDemoPattern(expenses);
        }
    }
    
    async identifyTriggers(expenses) {
        const cacheKey = 'triggers_' + this.hashData(expenses);
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;
        
        if (this.apiKey === 'demo-mode') {
            return this.getDemoTriggers(expenses);
        }
        
        const prompt = `Identify spending triggers from this data:
        
        Expenses with timestamps: ${JSON.stringify(expenses.slice(-30))}
        
        Provide:
        1. Time-based triggers (day/time patterns)
        2. Emotional triggers (inferred from patterns)
        3. Environmental triggers (location/context)
        
        Format as JSON with keys: timeBased[], emotional[], environmental[]
        Each item should have: trigger, multiplier (e.g., "2.3x average")
        NO emojis.`;
        
        try {
            const result = await this.callGemini(prompt);
            this.saveToCache(cacheKey, result);
            return result;
        } catch (error) {
            return this.getDemoTriggers(expenses);
        }
    }
    
    async generateProgressMetrics(currentMonth, previousMonth) {
        const cacheKey = 'progress_' + this.hashData([currentMonth, previousMonth]);
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;
        
        if (this.apiKey === 'demo-mode') {
            return this.getDemoProgressMetrics(currentMonth, previousMonth);
        }
        
        const prompt = `Calculate behavioral progress metrics:
        
        Current month: ${JSON.stringify(currentMonth)}
        Previous month: ${JSON.stringify(previousMonth)}
        
        Provide:
        1. Impulse Control Score (0-100) with change from last month
        2. Budget Adherence Score (0-100) with change
        3. Savings Consistency Score (0-100) with change
        
        Format as JSON with keys: impulseControl{score, change}, budgetAdherence{score, change}, savingsConsistency{score, change}
        Change should be numeric (positive/negative/zero).
        NO emojis.`;
        
        try {
            const result = await this.callGemini(prompt);
            this.saveToCache(cacheKey, result);
            return result;
        } catch (error) {
            return this.getDemoProgressMetrics(currentMonth, previousMonth);
        }
    }
    
    async generateMonthlyReflection(monthData, previousMonthData) {
        const cacheKey = 'reflection_' + this.hashData([monthData, previousMonthData]);
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;
        
        if (this.apiKey === 'demo-mode') {
            return this.getDemoReflection(monthData, previousMonthData);
        }
        
        const prompt = `Generate monthly reflection for spending behavior:
        
        Current month: ${JSON.stringify(monthData)}
        Previous month: ${JSON.stringify(previousMonthData)}
        
        Provide:
        1. Overall assessment (one of: "Excellent Progress", "Strong Progress", "Steady Progress", "Needs Focus")
        2. Main paragraph (3-4 sentences analyzing progress)
        3. Key insight (1-2 sentences)
        4. Focus for next month (1 sentence)
        
        Format as JSON with keys: assessment, analysis, insight, nextFocus
        Encouraging tone, no judgment. NO emojis.`;
        
        try {
            const result = await this.callGemini(prompt);
            this.saveToCache(cacheKey, result);
            return result;
        } catch (error) {
            return this.getDemoReflection(monthData, previousMonthData);
        }
    }
    
    async callGemini(prompt) {
        const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }]
            })
        });
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        const text = data.candidates[0].content.parts[0].text;
        
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    }
    
    // Demo mode fallbacks
    getDemoPersonalityProfile(expenses, settings) {
        const total = this.calculateTotal(expenses);
        const savingsRate = ((settings.income - total) / settings.income) * 100;
        
        if (savingsRate > 20) {
            return {
                type: "Mindful Spender",
                description: "You demonstrate strong awareness of spending patterns with consistent savings behavior. Your financial decisions show careful consideration and planning.",
                strengths: [
                    "Consistent savings behavior",
                    "Budget-conscious decisions",
                    "Good expense tracking habits"
                ],
                growthAreas: [
                    "Consider automating more savings",
                    "Explore investment opportunities"
                ]
            };
        } else {
            return {
                type: "Balanced Spender",
                description: "You maintain a reasonable balance between enjoying life and managing finances. There's room to optimize spending in certain categories.",
                strengths: [
                    "Diverse spending across categories",
                    "Regular expense tracking"
                ],
                growthAreas: [
                    "Increase savings rate",
                    "Review discretionary spending",
                    "Set category-specific budgets"
                ]
            };
        }
    }
    
    getDemoPattern(expenses) {
        const weekendSpending = expenses.filter(e => {
            const day = new Date(e.date).getDay();
            return day === 0 || day === 6;
        }).reduce((sum, e) => sum + e.amount, 0);
        
        const weekdaySpending = expenses.filter(e => {
            const day = new Date(e.date).getDay();
            return day > 0 && day < 6;
        }).reduce((sum, e) => sum + e.amount, 0);
        
        const weekendAvg = weekendSpending / 8;
        const weekdayAvg = weekdaySpending / 22;
        
        if (weekendAvg > weekdayAvg * 1.5) {
            return {
                name: "Weekend Spending Surge",
                confidence: 78,
                explanation: "Your spending increases by approximately 50% on weekends compared to weekdays. This pattern has been consistent over the past month, particularly in entertainment and dining categories.",
                intervention: "Try planning weekend activities in advance with a set budget. Consider free or low-cost alternatives for entertainment."
            };
        } else {
            return {
                name: "Consistent Daily Spending",
                confidence: 65,
                explanation: "Your spending remains relatively stable throughout the week with minor variations. This suggests good routine management but watch for gradual increases.",
                intervention: "Continue tracking daily expenses and set weekly spending limits to maintain this consistency."
            };
        }
    }
    
    getDemoTriggers(expenses) {
        return {
            timeBased: [
                { trigger: "Thursday evenings", multiplier: "2.1x average" },
                { trigger: "Weekend mornings", multiplier: "1.7x average" }
            ],
            emotional: [
                { trigger: "After busy work days", multiplier: "1.5x average" },
                { trigger: "Social situations", multiplier: "1.8x average" }
            ],
            environmental: [
                { trigger: "Near shopping areas", multiplier: "2.3x average" },
                { trigger: "Online browsing after 8 PM", multiplier: "1.6x average" }
            ]
        };
    }
    
    getDemoProgressMetrics(currentMonth, previousMonth) {
        const currentTotal = currentMonth.reduce((sum, e) => sum + e.amount, 0);
        const prevTotal = previousMonth.reduce((sum, e) => sum + e.amount, 0);
        const improvement = prevTotal > 0 ? ((prevTotal - currentTotal) / prevTotal) * 100 : 0;
        
        return {
            impulseControl: {
                score: Math.min(75 + Math.round(improvement * 2), 100),
                change: Math.round(improvement * 0.5)
            },
            budgetAdherence: {
                score: Math.min(82 + Math.round(improvement), 100),
                change: Math.round(improvement * 0.3)
            },
            savingsConsistency: {
                score: Math.min(88, 100),
                change: 0
            }
        };
    }
    
    getDemoReflection(monthData, previousMonthData) {
        const currentTotal = monthData.reduce((sum, e) => sum + e.amount, 0);
        const prevTotal = previousMonthData.reduce((sum, e) => sum + e.amount, 0);
        const change = prevTotal > 0 ? ((currentTotal - prevTotal) / prevTotal) * 100 : 0;
        
        if (change < -5) {
            return {
                assessment: "Strong Progress",
                analysis: "You've successfully reduced your spending this month while maintaining your lifestyle. The decrease in discretionary spending shows improved impulse control. Your consistent tracking habits are paying off.",
                insight: "Your spending is most controlled when you plan purchases in advance. The 24-hour rule for non-essential items has been particularly effective.",
                nextFocus: "Continue current strategies and explore ways to increase your savings rate by 5%."
            };
        } else if (change < 5) {
            return {
                assessment: "Steady Progress",
                analysis: "Your spending remained stable this month, showing good consistency in your financial habits. While there's no significant improvement, maintaining control is valuable progress.",
                insight: "You tend to stay within budget when you review your expenses weekly. Consider setting up automated savings to boost your progress.",
                nextFocus: "Focus on identifying one category where you can reduce spending by 10%."
            };
        } else {
            return {
                assessment: "Needs Focus",
                analysis: "Spending increased this month, particularly in discretionary categories. This is an opportunity to reassess your priorities and identify triggers that led to higher expenses.",
                insight: "Unplanned purchases account for most of the increase. Implementing a waiting period before buying can help.",
                nextFocus: "Set daily spending limits and track progress more frequently to regain control."
            };
        }
    }
    
    calculateTotal(expenses) {
        return expenses.reduce((sum, e) => sum + e.amount, 0);
    }
    
    getCategorySummary(expenses) {
        const summary = {};
        expenses.forEach(e => {
            if (!summary[e.category]) summary[e.category] = 0;
            summary[e.category] += e.amount;
        });
        return summary;
    }
    
    hashData(data) {
        return JSON.stringify(data).split('').reduce((a, b) => {
            a = ((a << 5) - a) + b.charCodeAt(0);
            return a & a;
        }, 0).toString();
    }
    
    getFromCache(key) {
        const cached = this.cache[key];
        if (!cached) return null;
        
        const now = Date.now();
        if (now - cached.timestamp > this.cacheExpiry) {
            delete this.cache[key];
            return null;
        }
        
        return cached.data;
    }
    
    saveToCache(key, data) {
        this.cache[key] = {
            data: data,
            timestamp: Date.now()
        };
    }
}

// ====================================================================
// ANALYSIS TAB RENDERING FUNCTIONS
// ====================================================================

let behavioralAI = null;

function initializeAnalysisTab() {
    if (!window.expenseTracker) return;
    
    // Initialize AI with API key from settings or demo mode
    const apiKey = localStorage.getItem('gemini_api_key') || 'demo-mode';
    behavioralAI = new BehavioralAnalysisAI(apiKey);
    
    // Render all Analysis components
    renderPersonalityProfile();
    renderPatternDetection();
    renderSpendingTriggers();
    renderProgressTracking();
    renderMonthlyReflection();
}

async function renderPersonalityProfile() {
    const container = document.getElementById('personality-profile-content');
    if (!container) return;
    
    container.innerHTML = '<div class="text-center py-8 text-gray-500">Loading personality profile...</div>';
    
    const expenses = window.expenseTracker.expenses;
    const settings = window.expenseTracker.settings;
    
    const profile = await behavioralAI.generatePersonalityProfile(expenses, settings);
    
    container.innerHTML = `
        <div class="mb-4">
            <div class="flex items-center gap-3 mb-3">
                <div class="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                    <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                    </svg>
                </div>
                <div>
                    <h4 class="text-lg font-semibold text-gray-900">Primary Type: ${profile.type}</h4>
                </div>
            </div>
            <p class="text-gray-700 leading-relaxed">${profile.description}</p>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div class="bg-green-50 rounded-lg p-4">
                <h5 class="font-semibold text-green-900 mb-2">Strengths</h5>
                <ul class="space-y-1">
                    ${profile.strengths.map(s => `<li class="text-sm text-green-800">• ${s}</li>`).join('')}
                </ul>
            </div>
            <div class="bg-blue-50 rounded-lg p-4">
                <h5 class="font-semibold text-blue-900 mb-2">Growth Areas</h5>
                <ul class="space-y-1">
                    ${profile.growthAreas.map(g => `<li class="text-sm text-blue-800">• ${g}</li>`).join('')}
                </ul>
            </div>
        </div>
    `;
}

async function renderPatternDetection() {
    const container = document.getElementById('pattern-detection-content');
    if (!container) return;
    
    container.innerHTML = '<div class="text-center py-8 text-gray-500">Analyzing patterns...</div>';
    
    const expenses = window.expenseTracker.expenses;
    const pattern = await behavioralAI.detectPrimaryPattern(expenses);
    
    const confidencePercent = pattern.confidence;
    
    container.innerHTML = `
        <div class="mb-4">
            <h4 class="text-lg font-semibold text-gray-900 mb-2">${pattern.name}</h4>
            <div class="mb-3">
                <div class="flex justify-between items-center mb-1">
                    <span class="text-sm text-gray-600">Confidence</span>
                    <span class="text-sm font-semibold text-gray-900">${confidencePercent}%</span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-2">
                    <div class="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-1000" 
                         style="width: ${confidencePercent}%"></div>
                </div>
            </div>
        </div>
        
        <p class="text-gray-700 leading-relaxed mb-4">${pattern.explanation}</p>
        
        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h5 class="font-semibold text-yellow-900 mb-2">Suggested Intervention</h5>
            <p class="text-sm text-yellow-800">${pattern.intervention}</p>
        </div>
    `;
}

async function renderSpendingTriggers() {
    const container = document.getElementById('spending-triggers-content');
    if (!container) return;
    
    container.innerHTML = '<div class="text-center py-8 text-gray-500">Identifying triggers...</div>';
    
    const expenses = window.expenseTracker.expenses;
    const triggers = await behavioralAI.identifyTriggers(expenses);
    
    container.innerHTML = `
        <div class="space-y-4">
            <div>
                <h5 class="font-semibold text-gray-900 mb-2">Time-Based</h5>
                <div class="space-y-2">
                    ${triggers.timeBased.map(t => `
                        <div class="flex justify-between items-center p-2 bg-gray-50 rounded">
                            <span class="text-sm text-gray-700">${t.trigger}</span>
                            <span class="px-2 py-1 bg-orange-100 text-orange-800 text-xs font-bold rounded">${t.multiplier}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div>
                <h5 class="font-semibold text-gray-900 mb-2">Emotional</h5>
                <div class="space-y-2">
                    ${triggers.emotional.map(t => `
                        <div class="flex justify-between items-center p-2 bg-gray-50 rounded">
                            <span class="text-sm text-gray-700">${t.trigger}</span>
                            <span class="px-2 py-1 bg-orange-100 text-orange-800 text-xs font-bold rounded">${t.multiplier}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div>
                <h5 class="font-semibold text-gray-900 mb-2">Environmental</h5>
                <div class="space-y-2">
                    ${triggers.environmental.map(t => `
                        <div class="flex justify-between items-center p-2 bg-gray-50 rounded">
                            <span class="text-sm text-gray-700">${t.trigger}</span>
                            <span class="px-2 py-1 bg-orange-100 text-orange-800 text-xs font-bold rounded">${t.multiplier}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

async function renderProgressTracking() {
    const container = document.getElementById('progress-tracking-content');
    if (!container) return;
    
    container.innerHTML = '<div class="text-center py-8 text-gray-500">Calculating progress...</div>';
    
    const currentMonth = getCurrentMonthExpenses();
    const previousMonth = getPreviousMonthExpenses();
    
    const metrics = await behavioralAI.generateProgressMetrics(currentMonth, previousMonth);
    
    container.innerHTML = `
        <div class="space-y-4">
            ${renderProgressMetric('Impulse Control Score', metrics.impulseControl)}
            ${renderProgressMetric('Budget Adherence', metrics.budgetAdherence)}
            ${renderProgressMetric('Savings Consistency', metrics.savingsConsistency)}
        </div>
    `;
}

function renderProgressMetric(name, metric) {
    const arrow = metric.change > 0 ? '↑' : metric.change < 0 ? '↓' : '↔';
    const arrowColor = metric.change > 0 ? 'text-green-600' : metric.change < 0 ? 'text-red-600' : 'text-gray-500';
    const changeText = metric.change !== 0 ? `${Math.abs(metric.change)} from last month` : 'same as last month';
    
    return `
        <div>
            <div class="flex justify-between items-center mb-2">
                <span class="text-sm font-medium text-gray-700">${name}</span>
                <div class="flex items-center gap-2">
                    <span class="font-semibold text-gray-900">${metric.score}/100</span>
                    <span class="${arrowColor} text-lg font-bold">${arrow}</span>
                    <span class="text-xs text-gray-600">${changeText}</span>
                </div>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2">
                <div class="bg-blue-500 h-2 rounded-full transition-all duration-1000" 
                     style="width: ${metric.score}%"></div>
            </div>
        </div>
    `;
}

async function renderMonthlyReflection() {
    const container = document.getElementById('monthly-reflection-content');
    if (!container) return;
    
    container.innerHTML = '<div class="text-center py-8 text-gray-500">Generating reflection...</div>';
    
    const currentMonth = getCurrentMonthExpenses();
    const previousMonth = getPreviousMonthExpenses();
    
    const reflection = await behavioralAI.generateMonthlyReflection(currentMonth, previousMonth);
    
    const badgeColors = {
        'Excellent Progress': 'bg-green-500',
        'Strong Progress': 'bg-blue-500',
        'Steady Progress': 'bg-yellow-500',
        'Needs Focus': 'bg-red-500'
    };
    
    const badgeColor = badgeColors[reflection.assessment] || 'bg-gray-500';
    const monthName = new Date().toLocaleDateString('en-US', { month: 'long' });
    
    container.innerHTML = `
        <div class="flex justify-between items-start mb-4">
            <h4 class="text-lg font-semibold text-gray-900">${monthName} Reflection</h4>
            <span class="${badgeColor} text-white px-3 py-1 rounded-lg text-sm font-semibold">
                ${reflection.assessment}
            </span>
        </div>
        
        <p class="text-gray-700 leading-relaxed mb-4">${reflection.analysis}</p>
        
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <h5 class="font-semibold text-blue-900 mb-2">Key Insight</h5>
            <p class="text-sm text-blue-800">${reflection.insight}</p>
        </div>
        
        <div class="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h5 class="font-semibold text-purple-900 mb-2">Focus for Next Month</h5>
            <p class="text-sm text-purple-800">${reflection.nextFocus}</p>
        </div>
    `;
}

// Helper functions
function getCurrentMonthExpenses() {
    if (!window.expenseTracker) return [];
    
    const now = new Date();
    return window.expenseTracker.expenses.filter(e => {
        const d = new Date(e.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
}

function getPreviousMonthExpenses() {
    if (!window.expenseTracker) return [];
    
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    
    return window.expenseTracker.expenses.filter(e => {
        const d = new Date(e.date);
        return d.getMonth() === prevMonth.getMonth() && d.getFullYear() === prevMonth.getFullYear();
    });
}

// Export for global access
window.initializeAnalysisTab = initializeAnalysisTab;

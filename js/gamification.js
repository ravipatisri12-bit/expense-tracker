// Gamification Engine for Ledgr
// Manages XP, levels, streaks, achievements, and anti-portfolio

class Gamification {
    constructor() {
        this.data = JSON.parse(localStorage.getItem('ledgr_gamification')) || this.getDefaults();
        this.save();
    }

    getDefaults() {
        return {
            xp: 0,
            level: 1,
            streak: { current: 0, best: 0, lastDate: null },
            antiPortfolio: [],  // { id, description, amount, date, category }
            achievements: [],   // unlocked achievement IDs
            dailyLog: {},       // { "2026-02-18": { logged: true, underBudget: true, mood?, checkedIn? } }
            weeklyQuest: null   // { weekId, type, target, completed, xpRewarded }
        };
    }

    save() {
        localStorage.setItem('ledgr_gamification', JSON.stringify(this.data));
    }

    // === XP & LEVELS ===

    addXP(amount, reason) {
        this.data.xp += amount;
        const newLevel = Math.floor(this.data.xp / 100) + 1;
        const leveledUp = newLevel > this.data.level;
        this.data.level = newLevel;
        this.save();
        if (leveledUp) this.onLevelUp(newLevel);
        return { xp: amount, totalXP: this.data.xp, level: this.data.level, leveledUp };
    }

    getXPForNextLevel() {
        return (this.data.level * 100) - this.data.xp;
    }

    getXPProgress() {
        const xpInLevel = this.data.xp % 100;
        return xpInLevel / 100; // 0-1
    }

    // === STREAKS ===

    updateStreak() {
        const today = new Date().toISOString().split('T')[0];
        if (this.data.streak.lastDate === today) return this.data.streak;

        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        if (this.data.streak.lastDate === yesterday) {
            this.data.streak.current++;
        } else if (this.data.streak.lastDate !== today) {
            this.data.streak.current = 1;
        }
        this.data.streak.lastDate = today;
        this.data.streak.best = Math.max(this.data.streak.best, this.data.streak.current);
        this.save();
        this.checkStreakAchievements();
        return this.data.streak;
    }

    // === ANTI-PORTFOLIO ===

    addAntiPortfolioEntry(description, amount, category = 'General') {
        const entry = {
            id: Date.now(),
            description,
            amount: parseFloat(amount),
            date: new Date().toISOString().split('T')[0],
            category
        };
        this.data.antiPortfolio.push(entry);
        this.save();
        const xpResult = this.addXP(15, 'anti-portfolio');
        this.updateStreak();
        return { entry, ...xpResult };
    }

    getDailySavings(date) {
        const d = date || new Date().toISOString().split('T')[0];
        return this.data.antiPortfolio
            .filter(e => e.date === d)
            .reduce((sum, e) => sum + e.amount, 0);
    }

    getTotalSavings() {
        return this.data.antiPortfolio.reduce((sum, e) => sum + e.amount, 0);
    }

    getRecentAntiPortfolio(limit = 5) {
        return this.data.antiPortfolio.slice(-limit).reverse();
    }

    // === DAILY LOG ===

    logDay(underBudget) {
        const today = new Date().toISOString().split('T')[0];
        if (!this.data.dailyLog[today]) {
            this.data.dailyLog[today] = { logged: true, underBudget };
            this.addXP(underBudget ? 20 : 5, 'daily-log');
            this.updateStreak();
        }
        this.save();
    }

    // === DAILY CHECK-IN ===

    checkIn(mood) {
        const today = new Date().toISOString().split('T')[0];
        if (!this.data.dailyLog[today]) {
            this.data.dailyLog[today] = { logged: true, underBudget: mood !== 'wants' };
        }
        const alreadyCheckedIn = this.data.dailyLog[today].checkedIn;
        this.data.dailyLog[today].mood = mood;
        this.data.dailyLog[today].checkedIn = true;
        this.data.dailyLog[today].underBudget = mood !== 'wants';
        if (!alreadyCheckedIn) {
            const xp = mood === 'no-spend' ? 15 : mood === 'essential' ? 10 : 5;
            this.addXP(xp, 'daily-checkin');
            this.updateStreak();
        }
        this.save();
    }

    openEditCheckIn() {
        const today = new Date().toISOString().split('T')[0];
        if (this.data.dailyLog[today]) {
            this.data.dailyLog[today].checkedIn = false;
            this.save();
        }
    }

    // === ACHIEVEMENTS ===

    checkStreakAchievements() {
        const s = this.data.streak.current;
        const unlocks = [
            [3, 'streak-3', '3-Day Streak'],
            [7, 'streak-7', 'Week Warrior'],
            [30, 'streak-30', 'Monthly Master'],
        ];
        unlocks.forEach(([days, id, name]) => {
            if (s >= days && !this.data.achievements.includes(id)) {
                this.data.achievements.push(id);
                this.onAchievement(id, name);
            }
        });
        this.save();
    }

    checkSavingsAchievements() {
        const total = this.getTotalSavings();
        const unlocks = [
            [100, 'saved-100', 'First $100 Saved'],
            [500, 'saved-500', '$500 Club'],
            [1000, 'saved-1k', 'Thousand Dollar Saver'],
        ];
        unlocks.forEach(([amount, id, name]) => {
            if (total >= amount && !this.data.achievements.includes(id)) {
                this.data.achievements.push(id);
                this.onAchievement(id, name);
            }
        });
        this.save();
    }

    // === CALLBACKS (override these) ===

    onLevelUp(level) {
        console.log(`Level up! Now level ${level}`);
    }

    onAchievement(id, name) {
        console.log(`Achievement unlocked: ${name}`);
    }

    // === STATS ===

    getStats() {
        return {
            xp: this.data.xp,
            level: this.data.level,
            xpProgress: this.getXPProgress(),
            xpToNext: this.getXPForNextLevel(),
            streak: this.data.streak,
            totalSaved: this.getTotalSavings(),
            todaySaved: this.getDailySavings(),
            achievements: this.data.achievements,
            antiPortfolioCount: this.data.antiPortfolio.length
        };
    }
}

// Global instance
window.gamification = new Gamification();

// === UI UPDATES ===

function updateGreeting() {
    const el = document.getElementById('greeting-text');
    if (!el) return;
    const h = new Date().getHours();
    const name = window.currentUser?.displayName?.split(' ')[0] || '';
    let greet;
    if (h < 5) greet = name ? `Burning midnight oil, ${name}?` : 'Burning midnight oil?';
    else if (h < 12) greet = name ? `Rise and grind, ${name}` : 'Rise and grind';
    else if (h < 17) greet = name ? `Hey ${name}, keep it going` : 'Keep it going';
    else if (h < 21) greet = name ? `What's good, ${name}` : "What's good";
    else greet = name ? `Winding down, ${name}?` : 'Winding down?';
    el.textContent = greet;
}

function updateGamificationUI() {
    renderHabitCard();
}

// === ANTI-PORTFOLIO HANDLERS ===

function openAntiPortfolio() {
    document.getElementById('anti-portfolio-modal').style.display = 'flex';
    document.getElementById('anti-desc').focus();
}

function closeAntiPortfolio() {
    document.getElementById('anti-portfolio-modal').style.display = 'none';
    document.getElementById('anti-desc').value = '';
    document.getElementById('anti-amount').value = '';
}

function submitAntiPortfolio() {
    const descEl = document.getElementById('anti-desc');
    const amountEl = document.getElementById('anti-amount');
    const desc = descEl.value.trim();
    const amount = parseFloat(amountEl.value);

    // Reset styles
    descEl.style.borderColor = 'rgba(255,255,255,0.1)';
    amountEl.style.borderColor = 'rgba(255,255,255,0.1)';

    let valid = true;
    if (!desc) { descEl.style.borderColor = '#ef4444'; valid = false; }
    if (!amount || amount <= 0) { amountEl.style.borderColor = '#ef4444'; valid = false; }
    if (!valid) return;

    const result = window.gamification.addAntiPortfolioEntry(desc, amount);
    window.gamification.checkSavingsAchievements();
    closeAntiPortfolio();
    updateGamificationUI();
}

// === HABIT CARD — streak + 7-day trail + daily check-in (merged) ===

function renderHabitCard() {
    const card = document.getElementById('habit-card');
    if (!card) return;

    const g = window.gamification;
    const today = new Date().toISOString().split('T')[0];
    const todayLog = g.data.dailyLog[today];
    const alreadyCheckedIn = todayLog?.checkedIn;
    const streak = g.data.streak.current;
    const bestStreak = g.data.streak.best;

    const moodColors = { 'no-spend': '#43e97b', essential: '#667eea', wants: '#f59e0b' };
    const moodLabels = { 'no-spend': 'No Spend', essential: 'Essentials', wants: 'Wants' };
    const weekDays = ['S','M','T','W','T','F','S'];

    // 7-day dot trail
    const dots = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        const ds = d.toISOString().split('T')[0];
        const log = g.data.dailyLog[ds];
        const isToday = ds === today;
        const dotColor = log?.mood ? (moodColors[log.mood] || '#667eea') : (log?.logged ? '#667eea' : 'rgba(255,255,255,0.10)');
        const ring = isToday && !alreadyCheckedIn ? 'box-shadow:0 0 0 2px rgba(255,255,255,0.25)' : '';
        dots.push(`
            <div class="flex flex-col items-center gap-1.5">
                <div class="w-2.5 h-2.5 rounded-full" style="background:${dotColor};${ring}"></div>
                <span style="font-size:9px;color:var(--md-sys-color-outline)">${weekDays[d.getDay()]}</span>
            </div>`);
    }
    const dotTrail = `<div class="flex justify-between mt-3">${dots.join('')}</div>`;

    const streakHeader = `
        <div class="flex items-center justify-between">
            <span class="text-xs font-bold tracking-widest uppercase" style="color:var(--md-sys-color-outline)">Daily Habit</span>
            <div class="flex items-center gap-1.5">
                ${streak > 0
                    ? `<span class="material-symbols-rounded" style="color:#f59e0b;font-size:17px;font-variation-settings:'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24">local_fire_department</span>
                       <span class="text-sm font-bold" style="color:var(--md-sys-color-on-surface)">${streak} day${streak !== 1 ? 's' : ''}</span>`
                    : `<span class="text-xs" style="color:var(--md-sys-color-outline)">Start your streak</span>`}
            </div>
        </div>`;

    if (alreadyCheckedIn) {
        const mood = todayLog.mood || 'wants';
        const label = moodLabels[mood] || mood;
        const color = moodColors[mood] || '#667eea';
        card.innerHTML = `
            <div class="px-4 pt-4 pb-4">
                ${streakHeader}
                ${dotTrail}
                <div class="flex items-center justify-between mt-3 pt-3" style="border-top:1px solid rgba(255,255,255,0.07)">
                    <span class="text-xs" style="color:var(--md-sys-color-outline)">
                        Logged as <span class="font-semibold" style="color:${color}">${label}</span>
                        ${bestStreak > 1 ? `<span style="opacity:0.5"> · Best ${bestStreak}d</span>` : ''}
                    </span>
                    <button onclick="openEditDailyCheckIn()" class="text-xs px-2.5 py-1 rounded-lg transition-all active:scale-95" style="color:var(--md-sys-color-outline);background:rgba(255,255,255,0.06)">Change</button>
                </div>
            </div>`;
        return;
    }

    // Smart suggestion based on today's actual transactions
    let suggested = null;
    try {
        const et = window.expenseTracker;
        if (et) {
            const stats = et.getTodayStats();
            if (stats.count === 0) suggested = 'no-spend';
            else if (stats.wants === 0 && stats.needs > 0) suggested = 'essential';
            else if (stats.wants > 0) suggested = 'wants';
        }
    } catch(e) {}

    const btn = (id, label) => {
        const styles = {
            'no-spend': { bg: 'rgba(67,233,123,0.1)',   color: '#43e97b', border: 'rgba(67,233,123,0.2)',   bgHi: 'rgba(67,233,123,0.18)',  borderHi: 'rgba(67,233,123,0.45)' },
            essential:  { bg: 'rgba(102,126,234,0.1)',  color: '#a8c7fa', border: 'rgba(102,126,234,0.2)',  bgHi: 'rgba(102,126,234,0.18)', borderHi: 'rgba(102,126,234,0.45)' },
            wants:      { bg: 'rgba(245,158,11,0.1)',   color: '#f59e0b', border: 'rgba(245,158,11,0.2)',   bgHi: 'rgba(245,158,11,0.18)',  borderHi: 'rgba(245,158,11,0.45)' },
        };
        const s = styles[id];
        const hi = id === suggested;
        return `<button onclick="checkInDaily('${id}')" class="flex-1 py-2 text-xs font-semibold rounded-xl transition-all active:scale-95" style="background:${hi ? s.bgHi : s.bg};color:${s.color};border:1px solid ${hi ? s.borderHi : s.border}">${label}${hi ? ' ·' : ''}</button>`;
    };

    const hint = suggested
        ? `<p class="text-xs mb-2" style="color:var(--md-sys-color-outline)">Looks like a <span style="color:${moodColors[suggested]}">${moodLabels[suggested]}</span> day — confirm or change</p>`
        : `<p class="text-xs mb-2" style="color:var(--md-sys-color-outline)">How did you spend today?</p>`;

    card.innerHTML = `
        <div class="px-4 pt-4 pb-4">
            ${streakHeader}
            ${dotTrail}
            <div class="mt-3 pt-3" style="border-top:1px solid rgba(255,255,255,0.07)">
                ${hint}
                <div class="flex gap-2">
                    ${btn('no-spend', 'No Spend')}
                    ${btn('essential', 'Essentials')}
                    ${btn('wants', 'Wants')}
                </div>
            </div>
        </div>`;
}

function checkInDaily(mood) {
    const wasNew = !window.gamification.data.dailyLog[new Date().toISOString().split('T')[0]]?.checkedIn;
    window.gamification.checkIn(mood);
    renderHabitCard();
    if (wasNew) {
        const msgs = {
            'no-spend': 'No spend day — streak extended',
            essential: 'Essentials only — solid discipline',
            wants: 'Logged · every day counts'
        };
        showNotification(msgs[mood] || 'Logged', 'success');
    }
}

function openEditDailyCheckIn() {
    window.gamification.openEditCheckIn();
    renderHabitCard();
}

// Update UI when page loads and on page switches
document.addEventListener('DOMContentLoaded', () => {
    updateGreeting();
    try { renderHabitCard(); } catch(e) { console.error('renderHabitCard:', e); }
    // Re-update when pages switch
    const origShowPage = window.showPage;
    if (origShowPage) {
        window.showPage = function(pageId) {
            origShowPage(pageId);
            setTimeout(() => { updateGamificationUI(); }, 50);
        };
    }
});

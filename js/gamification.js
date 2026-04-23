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
            this.data.dailyLog[today] = { logged: true, underBudget: mood !== 'heavy' };
        }
        if (this.data.dailyLog[today].checkedIn) return;
        this.data.dailyLog[today].mood = mood;
        this.data.dailyLog[today].checkedIn = true;
        this.addXP(mood !== 'heavy' ? 10 : 5, 'daily-checkin');
        this.updateStreak();
        this.save();
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
    const g = window.gamification;
    const stats = g.getStats();

    const el = (id) => document.getElementById(id);

    // XP bar
    if (el('level-badge')) el('level-badge').textContent = `LVL ${stats.level}`;
    if (el('xp-text')) el('xp-text').textContent = `${stats.xp % 100} / 100 XP`;
    if (el('xp-progress')) el('xp-progress').style.width = `${stats.xpProgress * 100}%`;
    if (el('total-saved')) el('total-saved').textContent = `$${stats.totalSaved.toFixed(0)}`;
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

// === DAILY CHECK-IN RENDERER ===

function renderDailyCheckIn() {
    const card = document.getElementById('daily-checkin-card');
    if (!card) return;

    const g = window.gamification;
    const today = new Date().toISOString().split('T')[0];
    const todayLog = g.data.dailyLog[today];
    const alreadyCheckedIn = todayLog?.checkedIn;
    const dayLabel = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    // Build 7-day dot trail (oldest → newest, left → right)
    const moodColors = { light: '#43e97b', normal: '#667eea', heavy: '#f59e0b' };
    const weekDays = ['S','M','T','W','T','F','S'];
    const dots = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        const ds = d.toISOString().split('T')[0];
        const log = g.data.dailyLog[ds];
        const isToday = ds === today;
        const dayChar = weekDays[d.getDay()];
        const dotColor = log?.mood ? moodColors[log.mood] : (log?.logged ? '#667eea' : 'rgba(255,255,255,0.08)');
        const ring = isToday && !alreadyCheckedIn ? 'box-shadow:0 0 0 1.5px rgba(255,255,255,0.25)' : '';
        dots.push(`
            <div class="flex flex-col items-center gap-1">
                <div class="w-2 h-2 rounded-full" style="background:${dotColor};${ring}"></div>
                <span style="font-size:9px;color:var(--md-sys-color-outline)">${dayChar}</span>
            </div>`);
    }
    const dotTrail = `<div class="flex gap-2.5 justify-end mt-3">${dots.join('')}</div>`;

    if (alreadyCheckedIn) {
        const mood = todayLog.mood || 'normal';
        const moodLabel = { light: 'Light', normal: 'On Track', heavy: 'Heavy' }[mood];
        card.innerHTML = `
            <div class="px-4 pt-3 pb-2 flex justify-between items-center" style="border-bottom:1px dashed rgba(255,255,255,0.08)">
                <span class="text-xs font-bold tracking-widest uppercase" style="color:var(--md-sys-color-outline)">Daily Log</span>
                <span class="text-xs font-mono" style="color:var(--md-sys-color-outline)">${dayLabel}</span>
            </div>
            <div class="px-4 py-3">
                <p class="text-xs" style="color:var(--md-sys-color-outline)">Logged as <span class="font-semibold" style="color:${moodColors[mood]}">${moodLabel}</span></p>
                ${dotTrail}
            </div>`;
        return;
    }

    card.innerHTML = `
        <div class="px-4 pt-3 pb-2 flex justify-between items-center" style="border-bottom:1px dashed rgba(255,255,255,0.08)">
            <span class="text-xs font-bold tracking-widest uppercase" style="color:var(--md-sys-color-outline)">Daily Log</span>
            <span class="text-xs font-mono" style="color:var(--md-sys-color-outline)">${dayLabel}</span>
        </div>
        <div class="px-4 py-3">
            <p class="text-xs mb-2.5" style="color:var(--md-sys-color-outline)">How was today?</p>
            <div class="flex gap-2">
                <button onclick="checkInDaily('light')" class="flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all active:scale-95" style="background:rgba(67,233,123,0.1);color:#43e97b;border:1px solid rgba(67,233,123,0.2)">Light</button>
                <button onclick="checkInDaily('normal')" class="flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all active:scale-95" style="background:rgba(102,126,234,0.1);color:#a8c7fa;border:1px solid rgba(102,126,234,0.2)">On Track</button>
                <button onclick="checkInDaily('heavy')" class="flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all active:scale-95" style="background:rgba(245,158,11,0.1);color:#f59e0b;border:1px solid rgba(245,158,11,0.2)">Heavy</button>
            </div>
            ${dotTrail}
        </div>`;
}

function checkInDaily(mood) {
    window.gamification.checkIn(mood);
    updateGamificationUI();
    renderDailyCheckIn();
    const msgs = {
        light: 'Light day logged · +10 XP',
        normal: 'On track — +10 XP',
        heavy: 'Logged · +5 XP · Tomorrow is a fresh start'
    };
    showNotification(msgs[mood] || 'Logged', 'success');
}

// Update UI when page loads and on page switches
document.addEventListener('DOMContentLoaded', () => {
    updateGamificationUI();
    updateGreeting();
    renderDailyCheckIn();
    // Re-update when pages switch
    const origShowPage = window.showPage;
    if (origShowPage) {
        window.showPage = function(pageId) {
            origShowPage(pageId);
            setTimeout(() => { updateGamificationUI(); renderDailyCheckIn(); }, 50);
        };
    }
});

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
            dailyLog: {}        // { "2026-02-18": { logged: true, underBudget: true } }
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

    // === ACHIEVEMENTS ===

    checkStreakAchievements() {
        const s = this.data.streak.current;
        const unlocks = [
            [3, 'streak-3', '🔥 3-Day Streak'],
            [7, 'streak-7', '🔥 Week Warrior'],
            [30, 'streak-30', '🔥 Monthly Master'],
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
            [100, 'saved-100', '💰 First $100 Saved'],
            [500, 'saved-500', '💰 $500 Club'],
            [1000, 'saved-1k', '💰 Thousand Dollar Saver'],
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
        console.log(`🎉 Level up! Now level ${level}`);
    }

    onAchievement(id, name) {
        console.log(`🏆 Achievement unlocked: ${name}`);
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

function updateGamificationUI() {
    const g = window.gamification;
    const stats = g.getStats();

    const el = (id) => document.getElementById(id);

    // XP bar
    if (el('level-badge')) el('level-badge').textContent = `LVL ${stats.level}`;
    if (el('xp-text')) el('xp-text').textContent = `${stats.xp % 100} / 100 XP`;
    if (el('xp-progress')) el('xp-progress').style.width = `${stats.xpProgress * 100}%`;
    if (el('total-saved')) el('total-saved').textContent = `$${stats.totalSaved.toFixed(0)}`;

    // Show FAB only on dashboard
    if (el('anti-portfolio-fab')) {
        const dashPage = document.getElementById('dashboard-page');
        const onDashboard = dashPage && !dashPage.classList.contains('hidden') && dashPage.style.display !== 'none';
        el('anti-portfolio-fab').style.display = onDashboard ? 'flex' : 'none';
    }
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
    const desc = document.getElementById('anti-desc').value.trim();
    const amount = document.getElementById('anti-amount').value;
    if (!desc || !amount || parseFloat(amount) <= 0) return;

    const result = window.gamification.addAntiPortfolioEntry(desc, amount);
    window.gamification.checkSavingsAchievements();
    closeAntiPortfolio();
    updateGamificationUI();
}

// Update UI when page loads and on page switches
document.addEventListener('DOMContentLoaded', () => {
    updateGamificationUI();
    // Re-update when pages switch
    const origShowPage = window.showPage;
    if (origShowPage) {
        window.showPage = function(pageId) {
            origShowPage(pageId);
            setTimeout(updateGamificationUI, 50);
        };
    }
});

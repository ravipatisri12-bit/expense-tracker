// Gamification Engine for Ledgr
// Manages XP, levels, streaks, achievements, and anti-portfolio

class Gamification {
    constructor() {
        // Merge over defaults: blobs written by older versions can be missing whole
        // fields (achievements, milestoneShownFor, ...). Without this, the first
        // this.data.achievements.includes() throws on those users.
        const stored = JSON.parse(localStorage.getItem('ledgr_gamification')) || {};
        this.data = { ...this.getDefaults(), ...stored };
        this.data.streak = { ...this.getDefaults().streak, ...(stored.streak || {}) };
        this.save();
    }

    getDefaults() {
        return {
            xp: 0,
            level: 1,
            streak: { current: 0, best: 0, lastDate: null, freezeUsedOn: null },
            achievements: [],   // unlocked achievement IDs
            dailyLog: {},       // { "2026-02-18": { logged: true, underBudget: true, mood?, checkedIn?, frozen? } }
            weeklyQuest: null,  // { weekId, type, target, completed, xpRewarded }
            milestoneShownFor: 0 // highest streak-day milestone already celebrated (for the inline toast)
        };
    }

    save() {
        localStorage.setItem('ledgr_gamification', JSON.stringify(this.data));
        this.scheduleCloudSync();
    }

    scheduleCloudSync() {
        clearTimeout(this._syncTimer);
        this._syncTimer = setTimeout(() => this.syncToCloud(), 2000);
    }

    async syncToCloud() {
        try {
            const uid = window.firebaseAuth?.currentUser?.uid;
            if (!uid || !window.firebaseDb) return;
            await window.firebaseDb.collection('users').doc(uid)
                .collection('state').doc('gamification')
                .set({ ...this.data, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        } catch (err) {
            console.warn('gamification sync failed:', err.message);
        }
    }

    async hydrateFromCloud() {
        try {
            const uid = window.firebaseAuth?.currentUser?.uid;
            if (!uid || !window.firebaseDb) return;
            const doc = await window.firebaseDb.collection('users').doc(uid)
                .collection('state').doc('gamification').get();
            if (!doc.exists) return;
            const cloud = doc.data();
            const cloudUpdated = cloud.updatedAt?.toMillis?.() || 0;
            const localUpdated = parseInt(localStorage.getItem('ledgr_gamification_updatedAt') || '0', 10);
            if (cloudUpdated > localUpdated) {
                delete cloud.updatedAt;
                this.data = { ...this.getDefaults(), ...cloud };
                localStorage.setItem('ledgr_gamification', JSON.stringify(this.data));
                localStorage.setItem('ledgr_gamification_updatedAt', String(cloudUpdated));
                // Recompute streak from the freshly-hydrated log, then refresh the live habit card.
                if (typeof this.updateStreak === 'function') this.updateStreak();
                try { window.expenseTracker?.renderHomeHabit?.(); } catch (e) {}
            }
        } catch (err) {
            console.warn('gamification hydrate failed:', err.message);
        }
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

    // Milestone ladder (days). Also drives the always-visible "next goal" and the inline toast.
    static get MILESTONES() {
        return [
            { days: 3,   name: '3-Day Streak' },
            { days: 7,   name: 'Week Warrior' },
            { days: 14,  name: 'Two Weeks' },
            { days: 30,  name: 'Monthly Master' },
            { days: 60,  name: 'Two Months' },
            { days: 100, name: 'Century' },
        ];
    }

    _localStr(d) {
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    // Recompute the streak from the daily log. Walks backward from today over
    // checked-in days, tolerating ONE single-day gap (a grace "freeze"). A second
    // gap (or a 2+ day gap) ends the streak. Fully idempotent — safe to call any time,
    // and correct after same-day check-ins AND yesterday backfills.
    updateStreak() {
        const log = this.data.dailyLog || {};
        const isDone = (key) => !!(log[key] && log[key].checkedIn);

        const today = new Date();
        const todayKey = this._localStr(today);
        // Anchor: today if checked in, else yesterday if checked in, else no active streak.
        let cursor = new Date(today);
        if (!isDone(todayKey)) {
            cursor.setDate(cursor.getDate() - 1);
            if (!isDone(this._localStr(cursor))) {
                this.data.streak.current = 0;
                this.data.streak.freezeUsedOn = null;
                this._clearFrozenFlags();
                this.save();
                return this.data.streak;
            }
        }

        let count = 0;
        let freezeUsedOn = null;
        let freezeAvailable = true;
        this._clearFrozenFlags();
        while (true) {
            const key = this._localStr(cursor);
            if (isDone(key)) {
                count++;
                cursor.setDate(cursor.getDate() - 1);
                continue;
            }
            // Gap day. Spend the one freeze to bridge a single missed day, then continue.
            if (freezeAvailable) {
                const prev = new Date(cursor);
                prev.setDate(prev.getDate() - 1);
                if (isDone(this._localStr(prev))) {
                    freezeAvailable = false;
                    freezeUsedOn = key;
                    // Mark the bridged day so the calendar can show it as freeze-covered.
                    log[key] = { ...(log[key] || {}), frozen: true };
                    cursor = prev; // resume from the day before the gap
                    continue;
                }
            }
            break; // streak ends here
        }

        this.data.streak.current = count;
        this.data.streak.freezeUsedOn = freezeUsedOn;
        this.data.streak.lastDate = isDone(todayKey) ? todayKey : this.data.streak.lastDate;
        this.data.streak.best = Math.max(this.data.streak.best || 0, count);
        this.save();
        this.checkStreakAchievements();
        return this.data.streak;
    }

    _clearFrozenFlags() {
        const log = this.data.dailyLog || {};
        for (const k in log) {
            if (log[k] && log[k].frozen) {
                delete log[k].frozen;
                // Drop entries that existed ONLY to hold a stale freeze marker.
                if (!log[k].checkedIn && !log[k].mood) delete log[k];
            }
        }
    }

    // Log a specific day's mood (used for same-day check-in AND yesterday backfill).
    // Returns true if this was a new check-in (so the caller can toast / recompute).
    setDayMood(dateKey, mood) {
        this.data.dailyLog = this.data.dailyLog || {};
        const existing = this.data.dailyLog[dateKey] || {};
        const wasCheckedIn = !!existing.checkedIn;
        this.data.dailyLog[dateKey] = { ...existing, mood, checkedIn: true, underBudget: mood !== 'wants' };
        this.updateStreak();
        this.save();
        return !wasCheckedIn;
    }

    // Milestone helpers for the UI.
    nextMilestone() {
        const s = this.data.streak.current || 0;
        return Gamification.MILESTONES.find(m => m.days > s) || null;
    }

    // Returns a milestone object if the current streak just crossed one not yet celebrated.
    pendingMilestone() {
        const s = this.data.streak.current || 0;
        const shown = this.data.milestoneShownFor || 0;
        const reached = Gamification.MILESTONES.filter(m => m.days <= s && m.days > shown);
        return reached.length ? reached[reached.length - 1] : null;
    }

    markMilestoneShown(days) {
        this.data.milestoneShownFor = Math.max(this.data.milestoneShownFor || 0, days);
        this.save();
    }

    // === ACHIEVEMENTS ===

    checkStreakAchievements() {
        const s = this.data.streak.current;
        if (!Array.isArray(this.data.achievements)) this.data.achievements = [];
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
            achievements: this.data.achievements
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

// The live habit card lives in script.js (ExpenseTracker.prototype.renderHomeHabit).
// This just delegates so legacy callers (expense-logged XP hook, weekly quest) still refresh it.
function updateGamificationUI() {
    try { window.expenseTracker?.renderHomeHabit?.(); } catch (e) { console.warn('renderHomeHabit:', e); }
}

// Update greeting on load.
document.addEventListener('DOMContentLoaded', () => {
    try { updateGreeting(); } catch (e) {}
});

/**
 * Wishlist CRUD + state machine + headroom math + auto-placement.
 * Items live at users/{uid}/wishlist/{id} in Firestore and as
 * localStorage['wishlist'] for offline. Shape per spec §2.
 */
(function () {
    const LS_KEY = 'wishlist';

    function loadLocal() {
        try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); }
        catch { return []; }
    }
    function saveLocal(items) {
        localStorage.setItem(LS_KEY, JSON.stringify(items));
    }
    function genId() {
        return 'w_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    }

    class WishlistStore {
        constructor() {
            this.items = loadLocal();
            this.listeners = [];
            this._unsub = null;
            this._headroomCache = null;
        }

        subscribe(fn) {
            this.listeners.push(fn);
            return () => { this.listeners = this.listeners.filter(l => l !== fn); };
        }
        _emit() { this._headroomCache = null; for (const l of this.listeners) l(this.items); }

        all() { return this.items.slice(); }
        getById(id) { return this.items.find(i => i.id === id) || null; }

        open() { return this.items.filter(i => i.status === 'open'); }
        bought() { return this.items.filter(i => i.status === 'bought'); }
        cancelled() { return this.items.filter(i => i.status === 'cancelled'); }
        unscheduled() { return this.items.filter(i => i.status === 'open' && !i.scheduledMonth); }
        scheduledIn(ym) { return this.items.filter(i => i.status === 'open' && i.scheduledMonth === ym); }

        async create({ name, cost, priority, notes }) {
            const item = {
                id: genId(),
                name: String(name || '').trim(),
                cost: Number(cost) || 0,
                priority: ['must', 'want', 'nice'].includes(priority) ? priority : 'want',
                scheduledMonth: null,
                status: 'open',
                notes: String(notes || '').trim(),
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
            if (!item.name || item.cost <= 0) throw new Error('Wish needs a name and positive cost.');
            this.items.push(item);
            saveLocal(this.items);
            await this._writeRemote(item);
            this._emit();
            return item;
        }

        async update(id, patch) {
            const i = this.items.findIndex(x => x.id === id);
            if (i < 0) return null;
            this.items[i] = { ...this.items[i], ...patch, updatedAt: Date.now() };
            saveLocal(this.items);
            await this._writeRemote(this.items[i]);
            this._emit();
            return this.items[i];
        }

        async delete(id) {
            this.items = this.items.filter(x => x.id !== id);
            saveLocal(this.items);
            if (window.currentUser && window.firebaseDb) {
                try {
                    await window.firebaseDb.collection('users').doc(window.currentUser.uid)
                        .collection('wishlist').doc(id).delete();
                } catch (e) { console.error('wishlist.delete remote:', e); }
            }
            this._emit();
        }

        async _writeRemote(item) {
            if (!window.currentUser || !window.firebaseDb) return;
            try {
                await window.firebaseDb.collection('users').doc(window.currentUser.uid)
                    .collection('wishlist').doc(item.id).set(item);
            } catch (e) { console.error('wishlist._writeRemote:', e); }
        }

        attachRealtime() {
            if (!window.currentUser || !window.firebaseDb) return;
            if (this._unsub) this._unsub();
            this._unsub = window.firebaseDb.collection('users').doc(window.currentUser.uid)
                .collection('wishlist').onSnapshot(snap => {
                    this.items = snap.docs.map(d => d.data());
                    saveLocal(this.items);
                    this._emit();
                });
        }

        bustCache() { this._headroomCache = null; this._emit(); }

        // --- Headroom math (spec §3) ---

        _typicalVariableMonth() {
            const t = window.expenseTracker;
            if (!t) return 0;
            const now = new Date();
            const buckets = [];
            for (let off = 0; off < 3; off++) {
                const d = new Date(now.getFullYear(), now.getMonth() - off, 1);
                const y = d.getFullYear(), m = d.getMonth();
                const sum = t.expenses.reduce((s, e) => {
                    if (e.tripId) return s; // regular only
                    const ed = t.parseLocalDate(e.date);
                    if (ed.getFullYear() === y && ed.getMonth() === m) return s + Number(e.amount || 0);
                    return s;
                }, 0);
                buckets.push(sum);
            }
            const nonZero = buckets.filter(v => v > 0);
            if (nonZero.length > 0) return nonZero.reduce((a, b) => a + b, 0) / nonZero.length;
            const income = (t.settings && t.settings.income) || 0;
            const target = (t.settings && t.settings.savingsTargetRate) || 0.50;
            return income * (1 - target);
        }

        _fixedMonth() {
            const t = window.expenseTracker;
            if (!t || typeof t._monthlyFixedTotal !== 'function') return 0;
            return t._monthlyFixedTotal();
        }

        // Returns array of {ym, label, longLabel, year, month, income, fixed,
        // typicalVariable, planted, headroom, plantedItems} for currentMonth → Dec.
        // Cached.
        computeHeadroom() {
            this._sweepPastScheduled();
            if (this._headroomCache) return this._headroomCache;
            const t = window.expenseTracker;
            if (!t) return [];
            const income = (t.settings && t.settings.income) || 0;
            const fixed = this._fixedMonth();
            const typVar = this._typicalVariableMonth();
            const now = new Date();
            const months = [];
            for (let m = now.getMonth(); m <= 11; m++) {
                const ym = now.getFullYear() + '-' + String(m + 1).padStart(2, '0');
                const planted = this.scheduledIn(ym);
                const plantedSum = planted.reduce((s, i) => s + Number(i.cost || 0), 0);
                const headroom = income - fixed - typVar - plantedSum;
                const date = new Date(now.getFullYear(), m, 1);
                months.push({
                    ym,
                    label: date.toLocaleDateString('en-US', { month: 'short' }),
                    longLabel: date.toLocaleDateString('en-US', { month: 'long' }),
                    year: now.getFullYear(),
                    month: m,
                    income, fixed, typicalVariable: typVar,
                    planted: plantedSum,
                    headroom,
                    plantedItems: planted
                });
            }
            this._headroomCache = months;
            return months;
        }

        // Projected savings rate for the current calendar year.
        projectedYearRate() {
            const t = window.expenseTracker;
            if (!t) return 0;
            const income = (t.settings && t.settings.income) || 0;
            if (income <= 0) return 0;
            const now = new Date();
            const Y = now.getFullYear();
            const monthsElapsed = now.getMonth() + 1;
            const monthsRemaining = 12 - monthsElapsed;
            const yearIncome = income * 12;
            const loggedThisYear = t.expenses.reduce((s, e) => {
                const d = t.parseLocalDate(e.date);
                if (d.getFullYear() !== Y) return s;
                return s + Number(e.amount || 0);
            }, 0);
            const fixedYear = this._fixedMonth() * 12;
            const typVarRemaining = this._typicalVariableMonth() * monthsRemaining;
            const plantedSum = this.items
                .filter(i => i.status === 'open' && i.scheduledMonth && i.scheduledMonth.startsWith(Y + '-'))
                .reduce((s, i) => s + Number(i.cost || 0), 0);
            const yearSpend = loggedThisYear + fixedYear + typVarRemaining + plantedSum;
            return Math.max(0, (yearIncome - yearSpend) / yearIncome);
        }

        // Priority-aware first-fit auto-placement (spec §5.1).
        //   must → walk months forward (earliest fit) so urgent items grab early months
        //   want / nice → walk backward (latest fit) so they sit at year-end and
        //     leave breathing room up front for incoming must items.
        // Does NOT mutate the item.
        findSpot(item) {
            const t = window.expenseTracker;
            if (!t) return null;
            const target = (t.settings && t.settings.savingsTargetRate) || 0.50;
            const months = this.computeHeadroom();
            const order = item.priority === 'must' ? months : months.slice().reverse();
            for (const m of order) {
                if (m.headroom < item.cost) continue;
                const before = item.scheduledMonth;
                item.scheduledMonth = m.ym;
                this._headroomCache = null;
                const rate = this.projectedYearRate();
                item.scheduledMonth = before;
                this._headroomCache = null;
                if (rate >= target) return m.ym;
            }
            return null;
        }

        // Bumping resolution (spec §5.1) for must items blocked by a lower-priority planted item.
        // Returns {mustYm, bumpItem, bumpYm} or null.
        findSpotWithBumping(mustItem) {
            const t = window.expenseTracker; if (!t) return null;
            const target = (t.settings && t.settings.savingsTargetRate) || 0.50;
            const pri = { must: 0, want: 1, nice: 2 };
            const months = this.computeHeadroom();
            const candidates = this.items.filter(i =>
                i.status === 'open' && i.scheduledMonth && pri[i.priority] > pri[mustItem.priority]
            );
            for (const m of months) {
                const bumpsHere = candidates.filter(c => c.scheduledMonth === m.ym);
                for (const bump of bumpsHere) {
                    const remaining = m.headroom + bump.cost;
                    if (remaining < mustItem.cost) continue;
                    const origMust = mustItem.scheduledMonth;
                    const origBump = bump.scheduledMonth;
                    try {
                        mustItem.scheduledMonth = m.ym;
                        bump.scheduledMonth = null;
                        this._headroomCache = null;
                        const bumpTarget = this.findSpot(bump);
                        if (!bumpTarget) continue;
                        bump.scheduledMonth = bumpTarget;
                        this._headroomCache = null;
                        const rate = this.projectedYearRate();
                        if (rate >= target) {
                            return { mustYm: m.ym, bumpItem: { ...bump }, bumpYm: bumpTarget };
                        }
                    } finally {
                        mustItem.scheduledMonth = origMust;
                        bump.scheduledMonth = origBump;
                        this._headroomCache = null;
                    }
                }
            }
            return null;
        }

        // Past-month sweep: scheduled into a now-past month → unschedule.
        _sweepPastScheduled() {
            const d = new Date();
            const todayYM = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
            let changed = false;
            for (const i of this.items) {
                if (i.status === 'open' && i.scheduledMonth && i.scheduledMonth < todayYM) {
                    i.scheduledMonth = null;
                    i.updatedAt = Date.now();
                    changed = true;
                    this._writeRemote(i);
                }
            }
            if (changed) saveLocal(this.items);
        }
    }

    window.wishlistStore = new WishlistStore();
})();

/**
 * Trip CRUD + state machine.
 * Trips live at users/{uid}/trips/{tripId} in Firestore and as
 * localStorage['trips'] for offline. Data shape per spec §5.1.
 */
(function () {
    const LS_KEY = 'trips';

    function loadLocal() {
        try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); }
        catch { return []; }
    }
    function saveLocal(trips) {
        localStorage.setItem(LS_KEY, JSON.stringify(trips));
    }
    function todayLocalDateString() {
        const d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    function genId() {
        return 't_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    }

    class TripsStore {
        constructor() {
            this.trips = loadLocal();
            this.listeners = [];
            this._unsub = null;
        }

        subscribe(fn) {
            this.listeners.push(fn);
            return () => { this.listeners = this.listeners.filter(l => l !== fn); };
        }
        _emit() { for (const l of this.listeners) l(this.trips); }

        all() { return this.trips.slice(); }

        getById(id) { return this.trips.find(t => t.id === id) || null; }

        getState(trip, today = todayLocalDateString()) {
            if (!trip) return 'NONE';
            if (trip.endedAt) return 'ENDED';
            if (today > trip.endDate) return 'ENDED';
            if (trip.startedAt) return 'ACTIVE';
            if (today >= trip.startDate && today <= trip.endDate) return 'ACTIVE';
            if (today < trip.startDate) return 'UPCOMING';
            return 'ENDED';
        }

        getActiveTrip(today = todayLocalDateString()) {
            return this.trips.find(t => this.getState(t, today) === 'ACTIVE') || null;
        }

        getUpcomingTrips(today = todayLocalDateString()) {
            return this.trips.filter(t => this.getState(t, today) === 'UPCOMING');
        }

        getPastTrips(today = todayLocalDateString()) {
            return this.trips.filter(t => this.getState(t, today) === 'ENDED');
        }

        // Spec §5.3 — pick the active trip whose window contains the date.
        pickTripIdForDate(expenseDate, today = todayLocalDateString()) {
            const t = this.trips.find(t =>
                this.getState(t, today) === 'ACTIVE' &&
                expenseDate >= t.startDate &&
                expenseDate <= t.endDate
            );
            return t ? t.id : null;
        }

        async create({ name, budget, startDate, endDate }) {
            const trip = {
                id: genId(),
                name, budget: Number(budget),
                startDate, endDate,
                startedAt: null, endedAt: null,
                createdAt: Date.now(), updatedAt: Date.now()
            };
            this.trips.push(trip);
            saveLocal(this.trips);
            await this._writeRemote(trip);
            this._emit();
            return trip;
        }

        async update(id, patch) {
            const i = this.trips.findIndex(t => t.id === id);
            if (i < 0) return null;
            this.trips[i] = { ...this.trips[i], ...patch, updatedAt: Date.now() };
            saveLocal(this.trips);
            await this._writeRemote(this.trips[i]);
            this._emit();
            return this.trips[i];
        }

        async delete(id) {
            this.trips = this.trips.filter(t => t.id !== id);
            saveLocal(this.trips);
            if (window.currentUser && window.firebaseDb) {
                try {
                    await window.firebaseDb.collection('users').doc(window.currentUser.uid)
                        .collection('trips').doc(id).delete();
                } catch (e) { console.error('trips.delete remote:', e); }
            }
            this._emit();
        }

        async start(id) {
            return this.update(id, { startedAt: Date.now() });
        }

        async end(id) {
            return this.update(id, { endedAt: Date.now() });
        }

        async _writeRemote(trip) {
            if (!window.currentUser || !window.firebaseDb) return;
            try {
                await window.firebaseDb.collection('users').doc(window.currentUser.uid)
                    .collection('trips').doc(trip.id).set(trip);
            } catch (e) { console.error('trips._writeRemote:', e); }
        }

        // Hook from auth.js after sign-in.
        attachRealtime() {
            if (!window.currentUser || !window.firebaseDb) return;
            if (this._unsub) this._unsub();
            this._unsub = window.firebaseDb.collection('users').doc(window.currentUser.uid)
                .collection('trips').onSnapshot(snap => {
                    this.trips = snap.docs.map(d => d.data());
                    saveLocal(this.trips);
                    this._emit();
                });
        }
    }

    window.tripsStore = new TripsStore();
})();

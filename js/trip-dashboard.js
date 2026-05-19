/**
 * Trip dashboard + Trips index renderers. Spec §5.5–§5.6.
 * Reads from window.tripsStore + window.expenseTracker.getTripExpenses(id).
 * Exposes globals: renderTripDashboard, renderTripsIndex, openNewTripModal, closeNewTripModal,
 *   submitNewTrip, onStartTrip, onEndTrip.
 */
(function () {
    function $(id) { return document.getElementById(id); }
    function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
    function todayStr() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
    function fmtRange(a, b) {
        const f = s => window.expenseTracker.parseLocalDate(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const y = window.expenseTracker.parseLocalDate(b).getFullYear();
        return `${f(a)} – ${f(b)}, ${y}`;
    }
    function categoryColor(name) {
        return { Food: '#ff9c66', Coffee: '#ffd166', Transit: '#66d9ff', Transportation: '#66d9ff', Shopping: '#7ee7c1', Entertainment: '#c89eff', Bills: '#b0b6c8' }[name] || '#8b8fa3';
    }

    function pickTripForDashboard() {
        const today = todayStr();
        if (!window.tripsStore) return null;
        // Priority 1: explicit nav-time selection (set by trip teaser, trip card, FAB).
        // Consumes the value into _currentTripId so subsequent in-page re-renders keep it.
        const focusId = window.tripsStore._focusTripId;
        if (focusId) {
            window.tripsStore._focusTripId = null;
            window.tripsStore._currentTripId = focusId;
            const t = window.tripsStore.getById(focusId);
            if (t) return t;
        }
        // Priority 2: in-page state — same trip still being viewed across re-renders.
        const cur = window.tripsStore._currentTripId;
        if (cur) {
            const t = window.tripsStore.getById(cur);
            if (t) return t;
        }
        // Priority 3: pick the active trip (or upcoming) as a sensible default.
        const active = window.tripsStore.getActiveTrip(today);
        if (active) { window.tripsStore._currentTripId = active.id; return active; }
        const upcoming = window.tripsStore.getUpcomingTrips(today)[0];
        if (upcoming) { window.tripsStore._currentTripId = upcoming.id; return upcoming; }
        return null;
    }

    window.renderTripDashboard = function () {
        const root = $('trip-dashboard-content');
        if (!root) return;
        const trip = pickTripForDashboard();
        if (!trip) {
            root.innerHTML = `<div class="today-empty" style="padding:60px 16px"><span class="material-symbols-rounded" style="font-size:36px;color:var(--on-surface-faint)">flight_takeoff</span><div style="margin-top:12px">No trips yet. Tap the <strong>+</strong> in the Trips tab to create one.</div></div>`;
            return;
        }
        const today = todayStr();
        const state = window.tripsStore.getState(trip, today);
        const tripExpenses = window.expenseTracker.getTripExpenses(trip.id);
        const spent = tripExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
        const remaining = Math.max(0, trip.budget - spent);
        const totalDays = window.expenseTracker._tripTotalDays(trip);
        const dayN = state === 'UPCOMING' ? 0 : window.expenseTracker._tripDayNumber(trip, today);
        const cappedDayN = Math.min(dayN, totalDays);
        const fillPct = trip.budget > 0 ? Math.min(100, (spent / trip.budget) * 100) : 0;

        const avgPerDay = cappedDayN > 0 ? Math.round(spent / cappedDayN) : 0;
        const idealPerDay = totalDays > 0 ? Math.round(trip.budget / totalDays) : 0;
        const remainingDays = Math.max(1, totalDays - cappedDayN + 1);
        const aimToday = Math.max(0, Math.round(remaining / remainingDays));

        // Today's transactions for this trip
        const todays = tripExpenses.filter(e => e.date === today);
        const todayTotal = todays.reduce((s, e) => s + Number(e.amount || 0), 0);
        const txnRows = todays.length === 0
            ? `<div class="today-empty">Nothing logged today yet.</div>`
            : todays.map(e => {
                const sw = e.category === 'Food' ? 'food' : (e.category === 'Transit' || e.category === 'Transportation') ? 'transit' : (e.category === 'Entertainment' || e.category === 'Fun') ? 'fun' : 'shop';
                const icon = sw === 'food' ? 'restaurant' : sw === 'transit' ? 'subway' : sw === 'fun' ? 'museum' : 'shopping_bag';
                return `<div class="today-row"><div class="swatch ${sw}"><span class="material-symbols-rounded">${icon}</span></div><div class="desc"><span class="name">${escapeHtml(e.description || 'Expense')}</span><span class="meta">${escapeHtml(e.category || 'Other')}</span></div><div class="amount">$${Number(e.amount).toFixed(2)}</div></div>`;
            }).join('');

        // Breakdown
        const totals = {};
        for (const e of tripExpenses) totals[e.category] = (totals[e.category] || 0) + Number(e.amount || 0);
        const ordered = Object.entries(totals).sort((a, b) => b[1] - a[1]);
        const expandedCat = window.tripsStore._expandedBreakdownCat;
        const breakdownRows = ordered.length === 0 ? `<div class="today-empty">No expenses yet.</div>` : ordered.map(([cat, amt]) => {
            const pct = spent > 0 ? Math.round((amt / spent) * 100) : 0;
            const isExpanded = expandedCat === cat;
            const catKey = JSON.stringify(cat).replace(/"/g, '&quot;');
            const head = `<div class="bd-row${isExpanded ? ' expanded' : ''}" onclick="onTripBreakdownToggle(${catKey})"><div class="bd-cat"><span class="dot" style="background:${categoryColor(cat)}"></span>${escapeHtml(cat)}</div><div class="bd-bar"><span style="width:${pct}%;background:${categoryColor(cat)}"></span></div><div class="bd-amount">$${Math.round(amt)}<span class="pct">${pct}%</span><span class="bd-chev material-symbols-rounded">${isExpanded ? 'expand_less' : 'expand_more'}</span></div></div>`;
            if (!isExpanded) return head;
            const txns = tripExpenses
                .filter(e => e.category === cat)
                .sort((a, b) => (b.date.localeCompare(a.date)) || b.timestamp - a.timestamp);
            const txnRows = txns.map(t => `<div class="bd-txn"><span class="bd-txn-date">${t.date}</span><span class="bd-txn-desc">${escapeHtml(t.description || 'Expense')}</span><span class="bd-txn-amt">$${Number(t.amount).toFixed(2)}</span></div>`).join('');
            return `${head}<div class="bd-detail">${txnRows}</div>`;
        }).join('');

        // Daily rhythm
        const perDay = new Array(totalDays).fill(0);
        for (const e of tripExpenses) {
            const idx = Math.floor((window.expenseTracker.parseLocalDate(e.date) - window.expenseTracker.parseLocalDate(trip.startDate)) / 86400000);
            if (idx >= 0 && idx < totalDays) perDay[idx] += Number(e.amount || 0);
        }
        const maxDay = Math.max(1, ...perDay);
        const dayBars = perDay.map((v, i) => {
            const dnum = window.expenseTracker.parseLocalDate(trip.startDate);
            dnum.setDate(dnum.getDate() + i);
            const isToday = window.expenseTracker.getLocalDateString(dnum) === today;
            const isFuture = i >= cappedDayN;
            const cls = isFuture ? 'day-bar future' : isToday ? 'day-bar today' : 'day-bar';
            const h = isFuture ? 20 : Math.max(8, (v / maxDay) * 100);
            const amountLabel = !isFuture && v > 0 ? `<div class="day-amount">$${Math.round(v)}</div>` : '';
            return `<div class="day-bar-wrap"><div class="${cls}" style="height:${h}%">${amountLabel}</div><div class="day-num${isToday ? ' today' : ''}">${dnum.getDate()}</div></div>`;
        }).join('');

        // Action buttons
        let actionBtn = '';
        if (state === 'UPCOMING' || (state === 'ACTIVE' && !trip.startedAt)) {
            actionBtn = `<button class="end-trip start-trip" onclick="onStartTrip('${trip.id}')"><span class="material-symbols-rounded">play_arrow</span> Start Trip</button>`;
        } else if (state === 'ACTIVE') {
            actionBtn = `<button class="end-trip" onclick="onEndTrip('${trip.id}')"><span class="material-symbols-rounded">flag</span> End trip early</button>`;
        }

        const insightMsg = state === 'UPCOMING'
            ? `Trip starts ${fmtRange(trip.startDate, trip.endDate).split(',')[0]}. Tap <strong>Start Trip</strong> when you arrive.`
            : `Aim under <strong>$${aimToday}/day</strong> for the rest to land on budget.`;

        root.innerHTML = `
<div class="page-toolbar">
    <button class="page-toolbar-back" onclick="showPage('trips')" aria-label="All trips"><span class="material-symbols-rounded">arrow_back</span></button>
    ${state === 'ACTIVE' ? '<div class="trip-pill">on trip</div>' : '<div class="page-toolbar-spacer"></div>'}
    <div class="page-toolbar-spacer"></div>
</div>
<div class="trip-hero">
    <div class="trip-eyebrow"><span class="material-symbols-rounded">explore</span> ${escapeHtml(trip.name)} · ${state}</div>
    <div class="trip-name">${escapeHtml(trip.name)}</div>
    <div class="trip-sub"><div class="trip-day-counter">DAY ${String(cappedDayN).padStart(2,'0')} / ${String(totalDays).padStart(2,'0')}</div><div class="trip-dates">${fmtRange(trip.startDate, trip.endDate)}</div></div>
    <div class="trip-numbers">
        <div class="trip-spent"><span class="currency">$</span>${Math.round(spent)}</div>
        <div class="trip-of">of <strong>$${trip.budget}</strong> budget<br><span style="opacity:0.6">$${Math.round(remaining)} remaining</span></div>
    </div>
    <div class="trip-bar-wrap"><div class="trip-bar" style="width:${fillPct}%"></div></div>
    <div class="trip-pace">
        <div class="pace-cell"><div class="label">Avg / day</div><div class="value">$${avgPerDay}</div></div>
        <div class="pace-cell"><div class="label">Ideal / day</div><div class="value">$${idealPerDay}</div></div>
        <div class="pace-cell recovery"><div class="label">Aim today</div><div class="value">$${aimToday}</div></div>
    </div>
</div>
<div class="insight trip"><span class="material-symbols-rounded">trending_up</span><div class="text">${insightMsg}</div></div>
<div class="section-head"><h2 class="section-title">Today</h2><span class="section-meta">${todays.length} txns · $${Math.round(todayTotal)}</span></div>
<div class="today-card">${txnRows}</div>
<button class="add-fab" onclick="window.tripsStore._focusTripId='${trip.id}';showPage('add-expense')"><span class="material-symbols-rounded">add</span> Log a trip expense</button>
<div class="section-head"><h2 class="section-title">Breakdown</h2><span class="section-meta">since day 1</span></div>
<div class="breakdown">${breakdownRows}</div>
<div class="section-head"><h2 class="section-title">Daily rhythm</h2><span class="section-meta">${cappedDayN} of ${totalDays}</span></div>
<div class="day-strip"><div class="day-axis" style="--days:${totalDays}">${dayBars}</div><div class="day-axis-foot"><span>day 1</span>${state === 'ACTIVE' ? '<span style="color:var(--trip-2)">today</span>' : ''}<span>day ${totalDays}</span></div></div>
${actionBtn}`;
    };

    window.renderTripsIndex = function () {
        const root = $('trips-page-content');
        if (!root) return;
        const today = todayStr();
        const all = window.tripsStore.all();
        const Y = new Date().getFullYear();
        const yearTrips = all.filter(t => t.startDate.startsWith(String(Y)) || t.endDate.startsWith(String(Y)));
        const active = yearTrips.filter(t => window.tripsStore.getState(t, today) === 'ACTIVE');
        const upcoming = yearTrips.filter(t => window.tripsStore.getState(t, today) === 'UPCOMING').sort((a, b) => a.startDate.localeCompare(b.startDate));
        const past = yearTrips.filter(t => window.tripsStore.getState(t, today) === 'ENDED').sort((a, b) => b.startDate.localeCompare(a.startDate));

        const totalBudget = yearTrips.reduce((s, t) => s + t.budget, 0);
        const yearSpend = yearTrips.reduce((s, t) => s + window.expenseTracker.getTripExpenses(t.id).reduce((ss, e) => ss + Number(e.amount || 0), 0), 0);

        function card(t, kind) {
            const spent = window.expenseTracker.getTripExpenses(t.id).reduce((s, e) => s + Number(e.amount || 0), 0);
            const pct = t.budget > 0 ? Math.min(100, (spent / t.budget) * 100) : 0;
            const over = spent > t.budget;
            const totalDays = window.expenseTracker._tripTotalDays(t);
            let pillTxt;
            if (kind === 'active') pillTxt = `active · day ${window.expenseTracker._tripDayNumber(t, today)} / ${totalDays}`;
            else if (kind === 'upcoming') {
                const n = Math.max(0, Math.ceil((window.expenseTracker.parseLocalDate(t.startDate) - window.expenseTracker.parseLocalDate(today)) / 86400000));
                pillTxt = `in ${n} days`;
            } else pillTxt = window.expenseTracker.parseLocalDate(t.startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            return `<div class="trip-card ${kind}${over ? ' over' : ''}" onclick="window.tripsStore._focusTripId='${t.id}';showPage('trip-dashboard')">
    <span class="pill">${pillTxt}</span>
    <div class="name">${escapeHtml(t.name)}</div>
    <div class="meta">${fmtRange(t.startDate, t.endDate)}</div>
    <div class="row"><div class="spent">$${Math.round(spent)}<span class="of"> / $${t.budget}</span></div><div class="mini-bar"><span style="width:${pct}%"></span></div></div>
    <span class="chev material-symbols-rounded">chevron_right</span>
</div>`;
        }

        root.innerHTML = `
<div class="page-toolbar">
    <h1 class="page-title">Your trips</h1>
    <button class="page-toolbar-action" onclick="openNewTripModal()" aria-label="New trip"><span class="material-symbols-rounded">add</span></button>
</div>
<div class="page-subtitle">${Y} · ${yearTrips.length} trip${yearTrips.length === 1 ? '' : 's'} planned</div>
<div class="year-summary">
    <div class="ys-label">Spent on trips this year</div>
    <div class="ys-num"><span class="currency">$</span>${Math.round(yearSpend).toLocaleString()}</div>
    <div class="ys-row">
        <div class="ys-cell"><div class="v">${past.length} trip${past.length === 1 ? '' : 's'}</div><div class="l">completed</div></div>
        <div class="ys-cell"><div class="v">${active.length} active</div><div class="l">right now</div></div>
        <div class="ys-cell"><div class="v">$${totalBudget.toLocaleString()}</div><div class="l">total budget</div></div>
    </div>
</div>
${active.map(t => card(t, 'active')).join('')}
${upcoming.length ? '<div class="divider-label">Upcoming</div>' + upcoming.map(t => card(t, 'upcoming')).join('') : ''}
${past.length ? `<div class="divider-label">Past · ${Y}</div>` + past.map(t => card(t, 'past')).join('') : ''}
${all.length === 0 ? `<div class="today-empty" style="padding:40px 16px"><div>No trips yet. Tap <strong>+</strong> above to plan one.</div></div>` : ''}`;
    };

    window.openNewTripModal = function () {
        const modal = $('new-trip-modal');
        const card = $('new-trip-modal-card');
        if (!modal || !card) return;
        const today = todayStr();
        const next7 = (() => { const d = new Date(); d.setDate(d.getDate() + 7); return window.expenseTracker.getLocalDateString(d); })();
        card.innerHTML = `
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
    <h3 class="f-serif" style="font-size:20px;font-weight:500">New trip</h3>
    <button class="icon-btn" onclick="closeNewTripModal()"><span class="material-symbols-rounded">close</span></button>
</div>
<form class="new-trip-form" onsubmit="event.preventDefault();submitNewTrip();">
    <input id="nt-name" placeholder="Trip name (e.g. New York)" required maxlength="40">
    <input id="nt-budget" type="number" step="1" min="1" placeholder="Budget ($)" required>
    <div class="row2"><input id="nt-start" type="date" value="${today}" required><input id="nt-end" type="date" value="${next7}" required></div>
    <div id="nt-error" class="nt-error hidden" role="alert"></div>
    <button type="submit" class="primary">Create trip</button>
    <button type="button" class="ghost" onclick="closeNewTripModal()">Cancel</button>
</form>`;
        modal.classList.remove('hidden');
    };

    window.closeNewTripModal = function () {
        const modal = $('new-trip-modal'); if (modal) modal.classList.add('hidden');
    };

    window.submitNewTrip = async function () {
        const name = $('nt-name').value.trim();
        const budget = Number($('nt-budget').value);
        const startDate = $('nt-start').value;
        const endDate = $('nt-end').value;
        const errEl = $('nt-error');
        if (errEl) { errEl.textContent = ''; errEl.classList.add('hidden'); }
        if (!name || !budget || !startDate || !endDate) {
            showTripFormError('All fields are required.');
            return;
        }
        if (endDate < startDate) {
            showTripFormError('End date must be on or after start date.');
            return;
        }
        const overlap = window.tripsStore.findOverlap(startDate, endDate);
        if (overlap) {
            showTripFormError(`Dates overlap with "${overlap.name}" (${overlap.startDate} – ${overlap.endDate}).`);
            return;
        }
        try {
            await window.tripsStore.create({ name, budget, startDate, endDate });
        } catch (e) {
            // Defense-in-depth: trips.js also enforces the rule.
            if (e && e.code === 'TRIP_OVERLAP') {
                showTripFormError(`Dates overlap with "${e.overlap.name}" (${e.overlap.startDate} – ${e.overlap.endDate}).`);
                return;
            }
            showTripFormError('Could not save trip. Try again.');
            return;
        }
        window.closeNewTripModal();
        window.renderTripsIndex();
        if (window.expenseTracker) window.expenseTracker.updateDashboard();
    };

    function showTripFormError(msg) {
        const el = document.getElementById('nt-error');
        if (!el) { alert(msg); return; }
        el.textContent = msg;
        el.classList.remove('hidden');
    }

    window.onStartTrip = async function (id) {
        if (!confirm('Start this trip now?')) return;
        await window.tripsStore.start(id);
        window.renderTripDashboard();
        if (window.expenseTracker) window.expenseTracker.updateDashboard();
    };

    window.onEndTrip = async function (id) {
        if (!confirm('End this trip? Future expenses won\'t auto-tag to it.')) return;
        await window.tripsStore.end(id);
        window.renderTripDashboard();
        if (window.expenseTracker) window.expenseTracker.updateDashboard();
    };

    window.onTripBreakdownToggle = function (cat) {
        if (!window.tripsStore) return;
        const cur = window.tripsStore._expandedBreakdownCat;
        window.tripsStore._expandedBreakdownCat = cur === cat ? null : cat;
        window.renderTripDashboard();
    };

    if (window.tripsStore) window.tripsStore.subscribe(() => {
        if (!document.getElementById('trips-page').classList.contains('hidden')) window.renderTripsIndex();
        if (!document.getElementById('trip-dashboard-page').classList.contains('hidden')) window.renderTripDashboard();
    });
})();

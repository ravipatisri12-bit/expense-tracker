/**
 * Plan page renderer + wishlist actions. Spec §4.
 * Reads from window.wishlistStore and window.expenseTracker.
 * Exposes globals: renderPlanPage, openWishModal, closeWishModal, submitWish,
 *   selectPlanMonth, onWishMarkBought, onWishCancel, onWishUncancel,
 *   onWishUnschedule, onWishFindSpot, onWishDelete, onWishEdit,
 *   onWishPriPill, onSavingsTargetEdit, switchWishTab.
 */
(function () {
    function $(id) { return document.getElementById(id); }
    function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
    function fmt(n) { return Math.round(Number(n) || 0).toLocaleString(); }
    function ymLabel(ym) {
        const [y, m] = ym.split('-').map(Number);
        return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    }

    function getWlTab() { return window.expenseTracker?._wlTab || 'open'; }
    function setWlTab(t) { if (window.expenseTracker) window.expenseTracker._wlTab = t; }
    function getCurrentPlanMonth() { return window.expenseTracker?._currentPlanMonth || null; }
    function setCurrentPlanMonth(ym) { if (window.expenseTracker) window.expenseTracker._currentPlanMonth = ym; }

    window.renderPlanPage = function () {
        renderHeaderStrip();
        renderLane();
        renderMonthDetail();
        renderWishlist();
        const fab = $('plan-fab'); if (fab) fab.classList.remove('hidden');
        const meta = $('plan-page-meta');
        if (meta) {
            const today = new Date();
            meta.textContent = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase() + ' · ‹ → DEC ›';
        }
    };

    function renderHeaderStrip() {
        const root = $('plan-header-strip'); if (!root) return;
        const t = window.expenseTracker, w = window.wishlistStore;
        if (!t || !w) { root.innerHTML = ''; return; }
        const target = (t.settings && t.settings.savingsTargetRate) || 0.50;
        const targetPct = Math.round(target * 100);
        const incomeMissing = !(t.settings && t.settings.income > 0);
        if (incomeMissing) {
            root.innerHTML = `<div class="plan-header"><div class="eyebrow"><span class="material-symbols-rounded" style="font-size:14px">event_note</span> Spending planner</div><div class="headline">Set your monthly income in <a href="#" onclick="event.preventDefault();showPage('settings')" style="color:var(--plan-1);text-decoration:underline">Settings</a> to use the planner.</div></div>`;
            return;
        }
        const projected = w.projectedYearRate();
        const projectedPct = Math.round(projected * 100);
        const delta = projected - target;
        const deltaCls = delta >= 0 ? 'delta-good' : 'delta-bad';
        // Plain-English status: "saving 57% (target 50%)" — no jargon.
        const statusText = delta >= 0
            ? `on pace · saving ${projectedPct}% (target ${targetPct}%)`
            : `behind · saving ${projectedPct}% (target ${targetPct}%)`;
        const open = w.open();
        const planted = open.filter(i => i.scheduledMonth).length;
        const unplaced = open.filter(i => !i.scheduledMonth).length;

        // Target-unreachable check: even with no scheduled wishes, projected < target?
        const itemsBackup = w.items;
        const ratesNoWishes = (() => {
            try {
                w.items = itemsBackup.map(i => ({ ...i, scheduledMonth: null }));
                w._headroomCache = null;
                return w.projectedYearRate();
            } finally {
                w.items = itemsBackup;
                w._headroomCache = null;
            }
        })();
        const unreachable = ratesNoWishes < target - 0.005;
        const unreachableBanner = unreachable
            ? `<div class="meta" style="color:#ffd166;border-top:1px dashed rgba(255,210,77,0.3);padding-top:8px;margin-top:10px"><span class="material-symbols-rounded" style="font-size:14px">warning</span> Current pace ${Math.round(ratesNoWishes * 100)}% — spending too high to reach ${targetPct}% even with no wishes</div>`
            : '';

        root.innerHTML = `
<div class="plan-header">
    <div class="eyebrow"><span class="material-symbols-rounded" style="font-size:14px">event_note</span> Spending planner</div>
    <div class="headline">Targeting <span class="pct" onclick="onSavingsTargetEdit()">${targetPct}% saved</span> by Dec</div>
    <div class="meta">
        <span class="${deltaCls}">${statusText}</span>
        <span style="opacity:.5">·</span>
        <span>${planted} planted</span>
        <span style="opacity:.5">·</span>
        <span>${unplaced} unplaced</span>
    </div>
    ${unreachableBanner}
</div>`;
    }

    function renderLane() {
        const root = $('plan-lane-section'); if (!root) return;
        const w = window.wishlistStore; if (!w) { root.innerHTML = ''; return; }
        const months = w.computeHeadroom();
        const sel = getCurrentPlanMonth();
        const cards = months.map(m => {
            const cls = m.headroom >= 500 ? 'good' : m.headroom >= 0 ? 'warn' : 'bad';
            const empty = m.plantedItems.length === 0 ? 'empty' : '';
            const selectedCls = sel === m.ym ? 'selected' : '';
            const items = m.plantedItems.slice(0, 3).map(i => `<div class="pi ${i.priority}"><span class="name">${escapeHtml(i.name)}</span><span class="cost">$${fmt(i.cost)}</span></div>`).join('');
            const more = m.plantedItems.length > 3 ? `<div class="pi" style="border-left:0;background:transparent;color:var(--on-surface-faint);font-family:'JetBrains Mono';font-size:10px">+${m.plantedItems.length - 3} more</div>` : '';
            const afterCommit = m.income - m.fixed - m.typicalVariable - m.planted;
            const pctSaved = m.income > 0 ? Math.max(0, Math.round((afterCommit / m.income) * 100)) : 0;
            const progressW = Math.min(100, Math.max(0, pctSaved));
            // Trending line: current month shows projected total spend; future months show trailing avg
            const trendLine = m.isCurrent
                ? `trending $${fmt(m.fixed + m.projectedVariable + m.planted)} spend`
                : `est. $${fmt(m.fixed + m.typicalVariable + m.planted)} spend`;
            return `
<div class="month-card ${empty} ${selectedCls}" onclick="selectPlanMonth('${m.ym}')">
    <div class="head"><span class="name">${m.label}<span class="yr">${m.year}</span></span><span class="headroom-chip ${cls}">${m.headroom >= 0 ? '+' : ''}$${fmt(m.headroom)}</span></div>
    <div class="planted">${items || '<div style="font-size:11px;color:var(--on-surface-faint);font-family:Inter Tight">no items</div>'}${more}</div>
    <div class="progress"><span style="width:${progressW}%"></span></div>
    <div class="footnote">${pctSaved}% saved · ${trendLine}</div>
</div>`;
        }).join('');
        root.innerHTML = `
<div class="plan-section-head"><span class="title">Months ahead</span><span class="meta">${months.length} mo</span></div>
<div class="plan-lane">${cards}</div>`;
    }

    function renderMonthDetail() {
        const root = $('plan-month-detail'); if (!root) return;
        const ym = getCurrentPlanMonth();
        const w = window.wishlistStore; if (!w) { root.classList.add('hidden'); return; }
        if (!ym) { root.classList.add('hidden'); root.innerHTML = ''; return; }
        const m = w.computeHeadroom().find(x => x.ym === ym);
        if (!m) { root.classList.add('hidden'); return; }
        root.classList.remove('hidden');
        const longLabel = m.longLabel.toUpperCase();
        const afterCommit = m.income - m.fixed - m.typicalVariable - m.planted;
        const afterCommitPct = m.income > 0 ? Math.round((afterCommit / m.income) * 100) : 0;
        const totalSpend = m.fixed + m.typicalVariable + m.planted;
        const itemRows = m.plantedItems.map(i => `
<div class="row">
    <span class="badge ${i.priority}">${i.priority}</span>
    <span class="name">${escapeHtml(i.name)}</span>
    <span class="cost">$${fmt(i.cost)}</span>
    <button class="x" onclick="onWishUnschedule('${i.id}')" aria-label="Remove from this month"><span class="material-symbols-rounded" style="font-size:18px">close</span></button>
</div>`).join('');

        // Variable line is different for the current month vs future months.
        let variableRow;
        if (m.isCurrent) {
            variableRow = `<div class="row muted"><span>− Variable (so far $${fmt(m.mtdVariable)} → trending $${fmt(m.projectedVariable)})</span><span>−$${fmt(m.projectedVariable)}</span></div>`;
        } else {
            variableRow = `<div class="row muted"><span>− Typical variable (3-mo avg)</span><span>−$${fmt(m.typicalVariable)}</span></div>`;
        }

        root.innerHTML = `
<div class="month-detail-card">
    <div class="eyebrow">EXPANDED · ${longLabel} ${m.year}${m.isCurrent ? ' · CURRENT' : ''}</div>
    <div class="name">${m.longLabel}</div>
    <div class="table">
        <div class="row"><span>Income</span><span>$${fmt(m.income)}</span></div>
        <div class="row muted"><span>− Fixed (rent + utilities + insurance)</span><span>−$${fmt(m.fixed)}</span></div>
        ${variableRow}
        <div class="sep"></div>
        <div class="row"><span>Available room</span><span>$${fmt(m.income - m.fixed - m.typicalVariable)}</span></div>
        ${m.plantedItems.map(i => `<div class="row muted"><span>− Planted: ${escapeHtml(i.name)}</span><span>−$${fmt(i.cost)}</span></div>`).join('')}
        <div class="sep"></div>
        <div class="row total ${afterCommit >= 0 ? 'good' : ''}"><span>After commitments</span><span>$${fmt(afterCommit)} (${afterCommitPct}% of income)</span></div>
        <div class="row muted"><span>Total spend</span><span>$${fmt(totalSpend)}</span></div>
    </div>
    ${itemRows ? `<div class="items">${itemRows}</div>` : ''}
</div>`;
    }

    function renderWishlist() {
        const root = $('plan-wishlist-section'); if (!root) return;
        const w = window.wishlistStore; if (!w) { root.innerHTML = ''; return; }
        const tab = getWlTab();
        const tabs = ['open', 'bought', 'cancelled'];
        const counts = { open: w.open().length, bought: w.bought().length, cancelled: w.cancelled().length };
        const tabBtns = tabs.map(t => `<button class="${tab === t ? 'active' : ''}" onclick="switchWishTab('${t}')">${t.charAt(0).toUpperCase() + t.slice(1)} · ${counts[t]}</button>`).join('');

        const months = w.computeHeadroom();
        const maxHeadroom = months.reduce((mx, x) => Math.max(mx, x.headroom), 0);

        let body = '';
        if (tab === 'open') {
            const unsched = w.unscheduled();
            const sched = w.open().filter(i => i.scheduledMonth);
            sched.sort((a, b) => (a.scheduledMonth || '').localeCompare(b.scheduledMonth || ''));
            const renderRow = (i) => {
                const m = i.scheduledMonth;
                let monthChip;
                if (m) {
                    monthChip = `<span class="month-chip" onclick="selectPlanMonth('${m}');document.getElementById('plan-page').scrollIntoView({behavior:'smooth'})">${ymLabel(m)}</span>`;
                } else if (i.cost > maxHeadroom && maxHeadroom > 0) {
                    monthChip = `<button class="find-spot fail" onclick="onWishFindSpot('${i.id}')" title="Cost exceeds any single-month headroom — split into two wishes or wait">TOO BIG</button>`;
                } else {
                    const ymCandidate = window.wishlistStore.findSpot(i);
                    monthChip = ymCandidate
                        ? `<button class="find-spot" onclick="onWishFindSpot('${i.id}')">FIND A SPOT</button>`
                        : `<button class="find-spot fail" onclick="onWishFindSpot('${i.id}')" title="Won't fit before Dec at current pace">WON'T FIT</button>`;
                }
                const note = i.notes ? `<div class="note">${escapeHtml(i.notes)}</div>` : '';
                return `
<div class="wl-row">
    <span class="badge ${i.priority}">${i.priority}</span>
    <div class="body"><div class="name">${escapeHtml(i.name)}</div>${note}</div>
    <span class="cost">$${fmt(i.cost)}</span>
    ${monthChip}
    <div class="actions">
        <button onclick="onWishMarkBought('${i.id}')" aria-label="Mark bought" title="Mark bought"><span class="material-symbols-rounded" style="font-size:18px">check</span></button>
        <button onclick="onWishEdit('${i.id}')" aria-label="More" title="Edit"><span class="material-symbols-rounded" style="font-size:18px">more_horiz</span></button>
    </div>
</div>`;
            };
            const unschedHtml = unsched.length === 0 ? '' : `<div class="wl-section-label">Unscheduled · ${unsched.length}</div><div class="wl-card">${unsched.map(renderRow).join('')}</div>`;
            const schedHtml = sched.length === 0 ? '' : `<div class="wl-section-label">Scheduled · ${sched.length}</div><div class="wl-card">${sched.map(renderRow).join('')}</div>`;
            body = unschedHtml + schedHtml;
            if (!body) body = `<div class="plan-empty">No wishes yet. Tap <strong>+</strong> to add one.</div>`;
        } else if (tab === 'bought') {
            const list = w.bought();
            body = list.length === 0
                ? `<div class="plan-empty">Nothing bought yet.</div>`
                : `<div class="wl-card">${list.map(i => `
<div class="wl-row bought">
    <span class="badge ${i.priority}">${i.priority}</span>
    <div class="body"><div class="name">${escapeHtml(i.name)}</div></div>
    <span class="cost">$${fmt(i.cost)}</span>
    <span class="done-chip">DONE</span>
    <div class="actions"><button onclick="onWishDelete('${i.id}')" aria-label="Delete"><span class="material-symbols-rounded" style="font-size:18px">delete</span></button></div>
</div>`).join('')}</div>`;
        } else {
            const list = w.cancelled();
            body = list.length === 0
                ? `<div class="plan-empty">No cancelled wishes.</div>`
                : `<div class="wl-card">${list.map(i => `
<div class="wl-row" style="opacity:0.6">
    <span class="badge ${i.priority}">${i.priority}</span>
    <div class="body"><div class="name">${escapeHtml(i.name)}</div></div>
    <span class="cost">$${fmt(i.cost)}</span>
    <div class="actions">
        <button onclick="onWishUncancel('${i.id}')" aria-label="Restore"><span class="material-symbols-rounded" style="font-size:18px">undo</span></button>
        <button onclick="onWishDelete('${i.id}')" aria-label="Delete"><span class="material-symbols-rounded" style="font-size:18px">delete</span></button>
    </div>
</div>`).join('')}</div>`;
        }
        root.innerHTML = `
<div class="plan-section-head"><span class="title">Wishlist</span></div>
<div class="wl-tabs">${tabBtns}</div>
${body}`;
    }

    window.switchWishTab = function (t) {
        if (!['open', 'bought', 'cancelled'].includes(t)) return;
        setWlTab(t);
        renderWishlist();
    };

    window.selectPlanMonth = function (ym) {
        const cur = getCurrentPlanMonth();
        setCurrentPlanMonth(cur === ym ? null : ym);
        renderLane();
        renderMonthDetail();
    };

    // === Modal ===
    function getEditState() { return window.expenseTracker?._wishEditId || null; }
    function setEditState(id) { if (window.expenseTracker) window.expenseTracker._wishEditId = id; }
    function getModalPriority() { return window.expenseTracker?._wishModalPri || 'want'; }
    function setModalPriority(p) { if (window.expenseTracker) window.expenseTracker._wishModalPri = p; }

    function renderModal() {
        const card = $('wish-modal-card'); if (!card) return;
        const editId = getEditState();
        const item = editId ? window.wishlistStore.getById(editId) : null;
        const pri = item ? item.priority : (getModalPriority() || 'want');
        setModalPriority(pri);
        card.innerHTML = `
<form class="wish-modal-form" onsubmit="event.preventDefault();submitWish()">
    <div style="display:flex;align-items:center;justify-content:space-between"><h3 style="font-family:'Fraunces',serif;font-size:22px;color:var(--md-sys-color-on-surface);margin:0">${editId ? 'Edit wish' : 'Add a wish'}</h3><button type="button" onclick="closeWishModal()" style="background:transparent;border:0;color:var(--on-surface-faint);cursor:pointer"><span class="material-symbols-rounded">close</span></button></div>
    <div><label>Name</label><input type="text" id="wish-name" required maxlength="80" value="${item ? escapeHtml(item.name) : ''}" placeholder="e.g. New York trip"></div>
    <div><label>Cost</label><input type="number" id="wish-cost" required min="0.01" step="0.01" value="${item ? item.cost : ''}" placeholder="0"></div>
    <div><label>Priority</label>
        <div class="pri-pills">
            <button type="button" data-p="must" class="${pri === 'must' ? 'active' : ''}" onclick="onWishPriPill('must')">Must</button>
            <button type="button" data-p="want" class="${pri === 'want' ? 'active' : ''}" onclick="onWishPriPill('want')">Want</button>
            <button type="button" data-p="nice" class="${pri === 'nice' ? 'active' : ''}" onclick="onWishPriPill('nice')">Nice</button>
        </div>
    </div>
    <div><label>Notes (optional)</label><textarea id="wish-notes" rows="2" maxlength="200">${item ? escapeHtml(item.notes || '') : ''}</textarea></div>
    <div class="actions">
        <button type="submit" class="primary">${editId ? 'Save' : 'Add'}</button>
        ${editId ? `<button type="button" class="secondary" onclick="onWishDelete('${editId}')">Delete</button>` : `<button type="button" class="secondary" onclick="closeWishModal()">Cancel</button>`}
    </div>
</form>`;
        setTimeout(() => { const n = $('wish-name'); if (n) n.focus(); }, 50);
    }

    function openWishModal(editId) {
        const m = $('wish-modal'); if (!m) return;
        setEditState(editId || null);
        if (!editId) setModalPriority('want');
        renderModal();
        m.classList.remove('hidden');
    }
    window.openWishModal = openWishModal;

    window.closeWishModal = function () {
        const m = $('wish-modal'); if (!m) return;
        m.classList.add('hidden');
        setEditState(null);
    };

    window.onWishPriPill = function (p) {
        if (!['must', 'want', 'nice'].includes(p)) return;
        setModalPriority(p);
        renderModal();
    };

    window.submitWish = async function () {
        const name = $('wish-name')?.value.trim();
        const cost = parseFloat($('wish-cost')?.value);
        const notes = $('wish-notes')?.value.trim() || '';
        const priority = getModalPriority();
        if (!name || !cost || cost <= 0) return;
        const editId = getEditState();
        try {
            if (editId) {
                await window.wishlistStore.update(editId, { name, cost, priority, notes });
            } else {
                const item = await window.wishlistStore.create({ name, cost, priority, notes });
                const ym = window.wishlistStore.findSpot(item);
                if (ym) await window.wishlistStore.update(item.id, { scheduledMonth: ym });
            }
            window.closeWishModal();
        } catch (e) {
            alert(e.message || 'Could not save wish.');
        }
    };

    window.onWishMarkBought = async function (id) {
        await window.wishlistStore.update(id, { status: 'bought' });
    };
    window.onWishCancel = async function (id) {
        await window.wishlistStore.update(id, { status: 'cancelled' });
    };
    window.onWishUncancel = async function (id) {
        await window.wishlistStore.update(id, { status: 'open' });
    };
    window.onWishUnschedule = async function (id) {
        await window.wishlistStore.update(id, { scheduledMonth: null });
    };
    window.onWishDelete = async function (id) {
        if (!confirm('Delete this wish? This cannot be undone.')) return;
        await window.wishlistStore.delete(id);
        if (getEditState() === id) window.closeWishModal();
    };
    window.onWishEdit = function (id) { window.openWishModal(id); };
    window.onWishFindSpot = async function (id) {
        const item = window.wishlistStore.getById(id);
        if (!item) return;
        const ym = window.wishlistStore.findSpot(item);
        if (ym) {
            await window.wishlistStore.update(id, { scheduledMonth: ym });
            return;
        }
        // No straight fit. For must items, try bumping a lower-priority planted item.
        if (item.priority === 'must' && typeof window.wishlistStore.findSpotWithBumping === 'function') {
            const bump = window.wishlistStore.findSpotWithBumping(item);
            if (bump) {
                const bumpItem = window.wishlistStore.getById(bump.bumpItem.id);
                if (bumpItem && confirm(`"${item.name}" needs $${fmt(item.cost)}.\n${ymLabel(bump.mustYm)} is full.\n\nMove "${bumpItem.name}" ($${fmt(bumpItem.cost)}, ${bumpItem.priority}) to ${ymLabel(bump.bumpYm)} to make room?`)) {
                    await window.wishlistStore.update(bumpItem.id, { scheduledMonth: bump.bumpYm });
                    await window.wishlistStore.update(id, { scheduledMonth: bump.mustYm });
                    return;
                }
            }
        }
        alert(`"${item.name}" won't fit before Dec at current pace.\n\nIncrease income, cancel something, or wait.`);
    };

    window.onSavingsTargetEdit = function () {
        const t = window.expenseTracker; if (!t) return;
        const cur = (t.settings && t.settings.savingsTargetRate) || 0.50;
        const input = prompt(`Savings target (30–70%):`, Math.round(cur * 100));
        if (input == null) return;
        let pct = parseFloat(input);
        if (!Number.isFinite(pct)) return;
        pct = Math.max(30, Math.min(70, pct));
        t.settings.savingsTargetRate = pct / 100;
        localStorage.setItem('settings', JSON.stringify(t.settings));
        if (window.currentUser && typeof t.saveSettingsToFirebase === 'function') t.saveSettingsToFirebase();
        if (window.wishlistStore) window.wishlistStore.bustCache();
        window.renderPlanPage();
    };

    // Re-render Plan when wishlistStore mutates (after page load).
    function attachStoreSubscription() {
        if (!window.wishlistStore) return;
        window.wishlistStore.subscribe(() => {
            if (window.expenseTracker && window.expenseTracker.currentPage === 'plan') {
                window.renderPlanPage();
            }
        });
    }
    if (window.wishlistStore) attachStoreSubscription();
    else document.addEventListener('DOMContentLoaded', attachStoreSubscription);
})();

// Sender for Ledgr daily notifications. Runs hourly via GitHub Actions.
// For each registered FCM token, checks the device's local hour and sends:
//   09:00 → daily budget room
//   18:00 → afternoon check-in
//   22:00 → end-of-day summary + streak / check-in nudge
//
// Required env: FIREBASE_SERVICE_ACCOUNT (full JSON of a service-account key).
// Optional env: FORCE_SLOT=morning|afternoon|evening|<hour-int> bypasses the local-hour gate.

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

const MONTHLY_TOTAL_SOFT = 1000;
const MONTHLY_TOTAL_HARD = 2000;
const MONTHLY_FOOD = 400;
const FOOD_CATEGORIES = new Set(['Food']);

const SLOT_BUDGET_ROOM = 9;
const SLOT_AFTERNOON = 18;
const SLOT_END_OF_DAY = 22;

const MOOD_LABEL = { 'no-spend': 'No Spend', essential: 'Essentials', wants: 'Wants' };

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
initializeApp({ credential: cert(sa), projectId: sa.project_id });
const db = getFirestore();
const messaging = getMessaging();

function localHour(tz) {
    const fmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: tz });
    return parseInt(fmt.format(new Date()), 10);
}

function localDateString(tz) {
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
    return fmt.format(new Date());
}

function localMonthName(tz) {
    return new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'long' }).format(new Date());
}

function startOfMonthString(tz) {
    return localDateString(tz).slice(0, 8) + '01';
}

function daysLeftInMonth(tz) {
    const today = localDateString(tz);
    const [y, m] = today.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const day = parseInt(today.slice(8, 10), 10);
    return lastDay - day + 1;
}

function sumExpenses(expenses, predicate = () => true) {
    return expenses.reduce((s, e) => s + (predicate(e) ? Number(e.amount || 0) : 0), 0);
}

function isFood(e) {
    return FOOD_CATEGORIES.has(e.category);
}

function fmt(n) {
    return '$' + Math.round(n);
}

async function fetchUserExpenses(uid, fromDate, toDate) {
    const snap = await db.collection('users').doc(uid).collection('expenses')
        .where('date', '>=', fromDate)
        .where('date', '<=', toDate)
        .get();
    return snap.docs.map(d => d.data());
}

async function fetchGamification(uid) {
    try {
        const doc = await db.collection('users').doc(uid).collection('state').doc('gamification').get();
        return doc.exists ? doc.data() : null;
    } catch { return null; }
}

// Pick the tightest budget cap that is still achievable, then derive a
// realistic per-day target toward that cap. Switching caps as earlier ones
// blow keeps the copy honest instead of saying "$0 left" forever.
function getActiveTarget(ctx) {
    const dl = Math.max(1, ctx.daysLeft);
    if (ctx.monthTotal > MONTHLY_TOTAL_HARD) {
        return { state: 'HARD_OVER', dailyTotal: 0, dailyFood: 0 };
    }
    if (ctx.monthTotal > MONTHLY_TOTAL_SOFT) {
        const dailyTotal = Math.round((MONTHLY_TOTAL_HARD - ctx.monthTotal) / dl);
        return { state: 'SOFT_OVER', dailyTotal, dailyFood: 0 };
    }
    if (ctx.monthFood > MONTHLY_FOOD) {
        const dailyTotal = Math.round((MONTHLY_TOTAL_SOFT - ctx.monthTotal) / dl);
        return { state: 'FOOD_OVER', dailyTotal, dailyFood: 0 };
    }
    return {
        state: 'HEALTHY',
        dailyTotal: Math.round((MONTHLY_TOTAL_SOFT - ctx.monthTotal) / dl),
        dailyFood: Math.round((MONTHLY_FOOD - ctx.monthFood) / dl)
    };
}

function buildMessage(slot, ctx) {
    const t = getActiveTarget(ctx);

    if (slot === SLOT_BUDGET_ROOM) {
        if (t.state === 'HARD_OVER') {
            return {
                title: `! Over ${fmt(MONTHLY_TOTAL_HARD)} cap — reset soon`,
                body: `What's spent is gone — log the day\n${ctx.daysLeft} days to wrap up ${ctx.monthName}`
            };
        }
        if (t.state === 'SOFT_OVER') {
            return {
                title: `! Over ${fmt(MONTHLY_TOTAL_SOFT)} — aim ${fmt(t.dailyTotal)}/day`,
                body: `Stay under ${fmt(MONTHLY_TOTAL_HARD)} hard cap\n${ctx.daysLeft} days left in ${ctx.monthName}`
            };
        }
        if (t.state === 'FOOD_OVER') {
            return {
                title: `→ ${fmt(t.dailyTotal)} to spend today`,
                body: `Food cap blown — needs only\n${ctx.daysLeft} days left in ${ctx.monthName}`
            };
        }
        return {
            title: `→ ${fmt(t.dailyTotal)} to spend today`,
            body: `${fmt(t.dailyFood)} of that on food\n${ctx.daysLeft} days left in ${ctx.monthName}`
        };
    }

    if (slot === SLOT_AFTERNOON) {
        const todayLine = ctx.todayCount === 0
            ? `· ${fmt(0)} today so far`
            : `· ${fmt(ctx.todayTotal)} today, ${fmt(ctx.todayFood)} on food`;
        if (t.state === 'HARD_OVER') {
            return {
                title: todayLine.replace('·', '!'),
                body: `${fmt(ctx.monthTotal)} of ${fmt(MONTHLY_TOTAL_HARD)} hard ceiling\nReset starts ${ctx.daysLeft} days from now`
            };
        }
        if (t.state === 'SOFT_OVER') {
            return {
                title: todayLine.replace('·', '!'),
                body: `${fmt(ctx.monthTotal)} of ${fmt(MONTHLY_TOTAL_HARD)} hard cap\nAim ${fmt(t.dailyTotal)}/day to stay under`
            };
        }
        if (t.state === 'FOOD_OVER') {
            return {
                title: todayLine,
                body: `Food cap blown — needs only\n${fmt(ctx.monthTotal)} of ${fmt(MONTHLY_TOTAL_SOFT)} this month`
            };
        }
        const room = t.dailyTotal * ctx.daysLeft;
        return {
            title: todayLine,
            body: `Month: ${fmt(ctx.monthTotal)} of ${fmt(MONTHLY_TOTAL_SOFT)}\n${fmt(room)} left, ${ctx.daysLeft} days`
        };
    }

    // evening
    if (!ctx.checkedIn) {
        return {
            title: `? ${fmt(ctx.todayTotal)} today — tag it`,
            body: `Tap: No Spend, Essentials, or Wants\n${ctx.streak ? `${ctx.streak} day streak going` : 'Start a streak tonight'}`
        };
    }
    const moodLabel = MOOD_LABEL[ctx.mood] || 'Logged';
    const streakBit = ctx.streak ? `${ctx.streak} day streak` : 'first day';
    let symbol, paceWord;
    if (t.state === 'HARD_OVER') { symbol = '!'; paceWord = 'over hard cap'; }
    else if (t.state === 'SOFT_OVER') { symbol = '!'; paceWord = `over ${fmt(MONTHLY_TOTAL_SOFT)} target`; }
    else if (t.state === 'FOOD_OVER') { symbol = '·'; paceWord = 'food cap blown'; }
    else { symbol = '✓'; paceWord = 'under pace'; }
    return {
        title: `${symbol} ${fmt(ctx.todayTotal)} today — ${paceWord}`,
        body: `Tagged "${moodLabel}" — ${streakBit}\n${fmt(ctx.monthTotal)} of ${fmt(MONTHLY_TOTAL_SOFT)} this month`
    };
}

async function fetchActiveTrip(uid, today) {
    try {
        const snap = await db.collection('users').doc(uid).collection('trips').get();
        if (snap.empty) return null;
        for (const doc of snap.docs) {
            const t = doc.data();
            if (t.endedAt) continue;
            if (today > t.endDate) continue;
            if (t.startedAt) return t;
            if (today >= t.startDate && today <= t.endDate) return t;
        }
        return null;
    } catch (e) {
        console.error('fetchActiveTrip failed:', e.message);
        return null;
    }
}

async function fetchTripExpenses(uid, tripId) {
    const snap = await db.collection('users').doc(uid).collection('expenses')
        .where('tripId', '==', tripId).get();
    return snap.docs.map(d => d.data());
}

function buildTripMessage(slot, ctx) {
    // ctx: { trip, tripSpent, today, todayTotal, daysLeft, totalDays, dayNum }
    const remaining = Math.max(0, ctx.trip.budget - ctx.tripSpent);
    const idealRest = Math.max(1, ctx.totalDays - ctx.dayNum + 1);
    const aim = Math.round(remaining / idealRest);
    if (slot === SLOT_BUDGET_ROOM) {
        return {
            title: `→ $${aim} to spend on the trip today`,
            body: `Day ${ctx.dayNum} of ${ctx.totalDays} · $${Math.round(remaining)} left of $${ctx.trip.budget} budget`
        };
    }
    if (slot === SLOT_AFTERNOON) {
        const todayLine = ctx.todayTotal > 0 ? `· $${Math.round(ctx.todayTotal)} today` : `· $0 today so far`;
        return {
            title: todayLine,
            body: `${ctx.trip.name}: $${Math.round(ctx.tripSpent)} of $${ctx.trip.budget} · ${ctx.daysLeft} days left`
        };
    }
    // evening
    const symbol = ctx.tripSpent > ctx.trip.budget ? '!' : ctx.todayTotal <= aim ? '✓' : '·';
    const word = ctx.tripSpent > ctx.trip.budget ? 'over trip budget' : ctx.todayTotal <= aim ? 'under trip pace' : 'over trip pace';
    return {
        title: `${symbol} $${Math.round(ctx.todayTotal)} today — ${word}`,
        body: `Day ${ctx.dayNum} done · $${Math.round(remaining)} left of $${ctx.trip.budget} budget`
    };
}

async function processToken(uid, tokenDoc, gamification, forceSlot) {
    const data = tokenDoc.data();
    const tz = data.tz || 'America/Los_Angeles';
    const hour = forceSlot ?? localHour(tz);
    if (hour !== SLOT_BUDGET_ROOM && hour !== SLOT_AFTERNOON && hour !== SLOT_END_OF_DAY) return;

    const today = localDateString(tz);
    const monthStart = startOfMonthString(tz);
    const expenses = await fetchUserExpenses(uid, monthStart, today);
    const todayExpenses = expenses.filter(e => e.date === today);

    const trip = await fetchActiveTrip(uid, today);
    let title, body;
    if (trip) {
        const tripExpenses = await fetchTripExpenses(uid, trip.id);
        const tripSpent = tripExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
        const todayTripTotal = tripExpenses.filter(e => e.date === today).reduce((s, e) => s + Number(e.amount || 0), 0);
        const totalDays = Math.floor((new Date(trip.endDate) - new Date(trip.startDate)) / 86400000) + 1;
        const dayNum = Math.max(1, Math.floor((new Date(today) - new Date(trip.startDate)) / 86400000) + 1);
        const cappedDay = Math.min(dayNum, totalDays);
        const daysLeft = Math.max(0, totalDays - cappedDay);
        const ctx = { trip, tripSpent, today, todayTotal: todayTripTotal, daysLeft, totalDays, dayNum: cappedDay };
        ({ title, body } = buildTripMessage(hour, ctx));
    } else {
        // Spec §2 — monthly cap math excludes trip expenses.
        const regularThisMonth = expenses.filter(e => e.tripId == null);
        const ctx = {
            todayTotal: sumExpenses(todayExpenses.filter(e => e.tripId == null)),
            todayFood: sumExpenses(todayExpenses.filter(e => e.tripId == null), isFood),
            monthTotal: sumExpenses(regularThisMonth),
            monthFood: sumExpenses(regularThisMonth, isFood),
            daysLeft: daysLeftInMonth(tz),
            todayCount: todayExpenses.length,
            monthName: localMonthName(tz),
            streak: gamification?.streak?.current || 0,
            checkedIn: !!gamification?.dailyLog?.[today]?.checkedIn,
            mood: gamification?.dailyLog?.[today]?.mood || null
        };
        ({ title, body } = buildMessage(hour, ctx));
    }

    try {
        await messaging.send({ token: data.token, notification: { title, body } });
        console.log(`Sent ${hour}h to ${uid} / ${data.token.slice(0, 12)}…${trip ? ' (trip)' : ''}`);
    } catch (err) {
        const code = err.errorInfo?.code;
        if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-argument') {
            await tokenDoc.ref.delete();
            console.log(`Removed stale token for ${uid}: ${code}`);
        } else {
            console.error(`Send failed for ${uid}:`, err.message);
        }
    }
}

async function main() {
    const forceSlotEnv = process.env.FORCE_SLOT;
    const slotMap = { morning: SLOT_BUDGET_ROOM, afternoon: SLOT_AFTERNOON, evening: SLOT_END_OF_DAY };
    const forceSlot = forceSlotEnv ? (slotMap[forceSlotEnv] ?? parseInt(forceSlotEnv, 10)) : undefined;
    if (forceSlot !== undefined) console.log(`FORCE_SLOT active: hour ${forceSlot}`);

    const users = await db.collection('users').get();
    for (const userDoc of users.docs) {
        const tokens = await userDoc.ref.collection('fcmTokens').get();
        if (tokens.empty) continue;
        const gamification = await fetchGamification(userDoc.id);
        for (const tokenDoc of tokens.docs) {
            await processToken(userDoc.id, tokenDoc, gamification, forceSlot);
        }
    }
}

main().catch(err => { console.error(err); process.exit(1); });

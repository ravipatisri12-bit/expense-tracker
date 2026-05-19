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

async function processToken(uid, tokenDoc, gamification, forceSlot) {
    const data = tokenDoc.data();
    const tz = data.tz || 'America/Los_Angeles';
    const hour = forceSlot ?? localHour(tz);
    if (hour !== SLOT_BUDGET_ROOM && hour !== SLOT_AFTERNOON && hour !== SLOT_END_OF_DAY) return;

    const today = localDateString(tz);
    const monthStart = startOfMonthString(tz);
    const expenses = await fetchUserExpenses(uid, monthStart, today);
    const todayExpenses = expenses.filter(e => e.date === today);
    const ctx = {
        todayTotal: sumExpenses(todayExpenses),
        todayFood: sumExpenses(todayExpenses, isFood),
        monthTotal: sumExpenses(expenses),
        monthFood: sumExpenses(expenses, isFood),
        daysLeft: daysLeftInMonth(tz),
        todayCount: todayExpenses.length,
        monthName: localMonthName(tz),
        streak: gamification?.streak?.current || 0,
        checkedIn: !!gamification?.dailyLog?.[today]?.checkedIn,
        mood: gamification?.dailyLog?.[today]?.mood || null
    };
    const { title, body } = buildMessage(hour, ctx);

    try {
        await messaging.send({ token: data.token, notification: { title, body } });
        console.log(`Sent ${hour}h to ${uid} / ${data.token.slice(0, 12)}…`);
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

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

function buildMessage(slot, ctx) {
    const totalRoom = Math.max(0, MONTHLY_TOTAL_SOFT - ctx.monthTotal);
    const foodRoom = Math.max(0, MONTHLY_FOOD - ctx.monthFood);
    const dailyTotalTarget = Math.round(totalRoom / Math.max(1, ctx.daysLeft));
    const dailyFoodTarget = Math.round(foodRoom / Math.max(1, ctx.daysLeft));
    const overHard = ctx.monthTotal > MONTHLY_TOTAL_HARD;
    const overSoft = ctx.monthTotal > MONTHLY_TOTAL_SOFT;

    if (slot === SLOT_BUDGET_ROOM) {
        if (overHard) {
            return {
                title: `Heads up — over your ${fmt(MONTHLY_TOTAL_HARD)} cap`,
                body: `Tighten food today: ${fmt(dailyFoodTarget)} budget left\n${ctx.daysLeft} days to go in ${ctx.monthName}`
            };
        }
        return {
            title: `You can spend ${fmt(dailyTotalTarget)} today`,
            body: `${fmt(dailyFoodTarget)} of that on food\n${ctx.daysLeft} days left in ${ctx.monthName}`
        };
    }

    if (slot === SLOT_AFTERNOON) {
        if (ctx.todayCount === 0) {
            return {
                title: 'Quiet day so far',
                body: `Nothing logged yet\n${fmt(ctx.monthTotal)} of ${fmt(MONTHLY_TOTAL_SOFT)} this month`
            };
        }
        return {
            title: `${fmt(ctx.todayTotal)} spent so far today`,
            body: `Food: ${fmt(ctx.todayFood)} of ${fmt(MONTHLY_FOOD)} month cap\n${fmt(ctx.monthTotal)} of ${fmt(MONTHLY_TOTAL_SOFT)} monthly target`
        };
    }

    // evening
    const paceWord = overHard ? 'over hard cap' : overSoft ? 'over pace' : 'under pace';
    if (!ctx.checkedIn) {
        return {
            title: 'Tag today before bed',
            body: `Tap to log: No Spend, Essentials, or Wants\n${ctx.streak ? `${ctx.streak} day streak going` : 'Start a streak tonight'}`
        };
    }
    const moodLabel = MOOD_LABEL[ctx.mood] || 'Logged';
    const streakBit = ctx.streak ? `${ctx.streak} day streak` : 'first day';
    return {
        title: `${fmt(ctx.todayTotal)} today — ${paceWord}`,
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

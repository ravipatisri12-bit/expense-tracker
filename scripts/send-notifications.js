// Sender for Ledgr daily notifications. Runs hourly via GitHub Actions.
// For each registered FCM token, checks the device's local hour and sends:
//   09:00 → daily budget room
//   18:00 → afternoon check-in
//   22:00 → end-of-day summary + streak
//
// Required env: FIREBASE_SERVICE_ACCOUNT (full JSON of a service-account key).

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
    return fmt.format(new Date()); // YYYY-MM-DD
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

function calcFoodStreak(expenses, todayStr) {
    const foodDays = new Set(expenses.filter(isFood).map(e => e.date));
    let streak = 0;
    const cursor = new Date(todayStr + 'T00:00:00');
    while (true) {
        const ds = cursor.toISOString().slice(0, 10);
        if (foodDays.has(ds)) break;
        streak++;
        cursor.setDate(cursor.getDate() - 1);
        if (streak > 365) break;
    }
    return streak;
}

function buildMessage(slot, ctx) {
    const { todayTotal, todayFood, monthTotal, monthFood, daysLeft, streak, todayCount } = ctx;
    const totalRoom = Math.max(0, MONTHLY_TOTAL_SOFT - monthTotal);
    const foodRoom = Math.max(0, MONTHLY_FOOD - monthFood);
    const dailyTotalTarget = Math.round(totalRoom / Math.max(1, daysLeft));
    const dailyFoodTarget = Math.round(foodRoom / Math.max(1, daysLeft));

    if (slot === SLOT_BUDGET_ROOM) {
        return {
            title: 'Daily target',
            body: `Room: ${fmt(dailyTotalTarget)} total · ${fmt(dailyFoodTarget)} food\n${daysLeft} days left in month`
        };
    }
    if (slot === SLOT_AFTERNOON) {
        return {
            title: 'Day so far',
            body: `Today: ${fmt(todayTotal)} · food ${fmt(todayFood)}\nMonth: ${fmt(monthTotal)} of ${fmt(MONTHLY_TOTAL_SOFT)}`
        };
    }
    // End of day
    const noSpend = todayCount === 0 ? ' · no-spend day' : '';
    let pace;
    if (monthTotal > MONTHLY_TOTAL_HARD) pace = 'Over hard cap';
    else if (monthTotal > MONTHLY_TOTAL_SOFT) pace = 'Over soft pace';
    else pace = 'Under pace';
    return {
        title: 'Day done',
        body: `${fmt(todayTotal)} today · food ${fmt(todayFood)}${noSpend}\nStreak: Day ${streak} · ${pace}`
    };
}

async function processToken(uid, tokenDoc, forceSlot) {
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
        streak: calcFoodStreak(expenses, today),
        todayCount: todayExpenses.length
    };
    const { title, body } = buildMessage(hour, ctx);

    try {
        await messaging.send({
            token: data.token,
            notification: { title, body }
        });
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
        for (const tokenDoc of tokens.docs) {
            await processToken(userDoc.id, tokenDoc, forceSlot);
        }
    }
}

main().catch(err => { console.error(err); process.exit(1); });

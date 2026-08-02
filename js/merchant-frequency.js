/**
 * Merchant frequency aggregation. Spec §7.2.
 * Sorted by visit count desc by default. Normalizes merchant names by
 * stripping common payment-processor prefixes ('TST*', 'SQ *', 'TST* ', 'PAYPAL *')
 * and lowercasing for the dedupe key, but keeping the title-case original for display.
 */
(function () {
    function normalizeKey(s) {
        return String(s || '')
            .replace(/^TST\*\s*/i, '')
            .replace(/^SQ\s*\*\s*/i, '')
            .replace(/^PAYPAL\s*\*\s*/i, '')
            .replace(/[#]\d+\s*$/, '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }
    function titleCase(s) {
        return String(s || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    }
    function aggregate(expenses, year) {
        const map = new Map();
        for (const e of expenses) {
            if (!e.description) continue;
            // Spending rows only (kind absent means 'variable'). "Top regulars"
            // ranks by visit count, so a monthly paycheck or rent payment would
            // otherwise sit at the top of the list as the most-visited merchant.
            if ((e.kind || 'variable') !== 'variable') continue;
            if (year != null && !String(e.date).startsWith(String(year))) continue;
            const key = normalizeKey(e.description);
            if (!key) continue;
            if (!map.has(key)) map.set(key, { name: titleCase(key), key, visits: 0, total: 0, sample: e.description, category: e.category });
            const r = map.get(key);
            r.visits += 1;
            r.total += Number(e.amount || 0);
        }
        return [...map.values()].sort((a, b) => b.visits - a.visits || b.total - a.total);
    }
    window.MerchantFrequency = { aggregate, normalizeKey };
})();

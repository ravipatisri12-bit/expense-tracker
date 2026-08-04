const { chromium } = require('/tmp/pwdrv/node_modules/playwright');
const fs = require('fs');

const results = [];
const t = (name, pass, detail) => { results.push({ name, pass, detail }); console.log((pass ? 'PASS  ' : 'FAIL  ') + name + (detail ? '   ' + detail : '')); };

(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const p = await b.newPage({ viewport: { width: 400, height: 1700 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
  let promptName = 'Gym membership';
  p.on('dialog', async d => await d.accept(promptName));

  await p.goto('http://localhost:5250/', { waitUntil: 'load' });
  await p.waitForTimeout(1400);
  await p.evaluate(fs.readFileSync('/Users/sreekarh/Desktop/modern-expense-tracker/tools/seed-demo-data.js', 'utf8'));
  await p.evaluate(() => window.seedDemoData());
  await p.reload({ waitUntil: 'load' });
  await p.waitForTimeout(1900);

  // ---- Home must show variable spend only ----
  const home = await p.evaluate(() => {
    const el = document.getElementById('home-month-hero');
    const m = el.innerText.match(/\$[\d,]+/);
    const t = window.expenseTracker, n = new Date();
    const variable = t.spendingRows()
      .filter(e => { const d = t.parseLocalDate(e.date); return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth(); })
      .reduce((s, e) => s + Number(e.amount || 0), 0);
    return { hero: m ? m[0] : null, variable: Math.round(variable), all: t.expenses.length, gated: t.spendingRows().length };
  });
  t('Home hero shows variable spend only', home.hero === '$' + home.variable, `hero=${home.hero} variable=$${home.variable}`);
  t('Gate excludes fixed+income rows', home.gated < home.all, `${home.gated} of ${home.all} rows count as spending`);

  // ---- Months tab ----
  await p.evaluate(() => window.showPage('history'));
  await p.waitForTimeout(1300);
  const nav = await p.evaluate(() => ({
    tab: [...document.querySelectorAll('nav .nav-btn')].map(b => b.innerText.trim()).join('|'),
    title: (document.querySelector('#history-page .page-title') || {}).textContent
  }));
  t('Tab renamed to Months', /Months/.test(nav.tab) && !/History/.test(nav.tab), nav.tab);
  t('Page title says Months', (nav.title || '').trim() === 'Months', nav.title);

  // ---- entry card collapsed by default ----
  const collapsed = await p.evaluate(() => {
    const c = document.querySelector('.ledger-entry');
    return { open: c.classList.contains('is-open'), inputs: document.querySelectorAll('#history-ledger-entry input').length,
             summary: (document.querySelector('.le-collapsed-sum') || {}).textContent };
  });
  t('Entry card collapsed by default', !collapsed.open && collapsed.inputs === 0, `summary="${collapsed.summary}"`);
  t('Collapsed header still shows totals', /fixed/.test(collapsed.summary || '') && /income/.test(collapsed.summary || ''), collapsed.summary);

  // ---- expand ----
  await p.evaluate(() => document.querySelector('.le-toggle').click());
  await p.waitForTimeout(800);
  const rows = () => p.evaluate(() => [...document.querySelectorAll('#history-ledger-entry .le-row')].map(r => ({
    name: (r.querySelector('.le-name-text') || {}).textContent,
    cls: r.className.replace('le-row ', ''),
    val: (r.querySelector('input') || {}).value,
    x: (r.querySelector('.le-clear') || {}).getAttribute ? r.querySelector('.le-clear').getAttribute('onclick') : null
  })));
  const r0 = await rows();
  t('Names carried from last month with BLANK amounts',
    r0.some(r => /utilities/i.test(r.name) && r.val === ''), r0.map(r => `${r.name}="${r.val}"`).join(' '));
  t('Existing row pre-filled and marked saved',
    r0.some(r => /^rent$/i.test(r.name) && r.val === '1200' && r.cls === 'is-set'), '');

  // ---- accumulation ----
  const readFixed = () => p.evaluate(() => {
    const t = window.expenseTracker, n = new Date();
    const f = t.fixedFor(n.getFullYear(), n.getMonth());
    return { total: f.total, count: f.count, estimated: f.estimated };
  });
  const before = await readFixed();
  const u = await p.$('#history-ledger-entry input[data-name="Utilities"]');
  await u.click(); await p.keyboard.type('145'); await p.keyboard.press('Tab');
  await p.waitForTimeout(1300);
  const after = await readFixed();
  t('Entering an amount ACCUMULATES the month',
    after.total === before.total + 145 && after.count === before.count + 1,
    `$${before.total}(${before.count}) -> $${after.total}(${after.count})`);

  const homeAfter = await p.evaluate(() => {
    const el = document.getElementById('home-month-hero');
    const m = el.innerText.match(/\$[\d,]+/); return m ? m[0] : null;
  });
  t('Home does NOT move when fixed costs are added', homeAfter === home.hero, `${home.hero} -> ${homeAfter}`);

  // ---- editing updates in place, no duplicate ----
  const u2 = await p.$('#history-ledger-entry input[data-name="Utilities"]');
  await u2.click();
  await p.keyboard.down('Meta'); await p.keyboard.press('a'); await p.keyboard.up('Meta');
  await p.keyboard.type('164.90'); await p.keyboard.press('Tab');
  await p.waitForTimeout(1300);
  const edited = await readFixed();
  const dupCheck = await p.evaluate(() => {
    const t = window.expenseTracker, n = new Date();
    return t.kindRowsForMonth('fixed', n.getFullYear(), n.getMonth())
      .filter(e => /utilities/i.test(e.description)).length;
  });
  t('Editing updates in place (no duplicate row)', dupCheck === 1 && edited.count === after.count, `utilities rows=${dupCheck} count=${edited.count}`);

  // ---- Add item, then remove it while blank ----
  promptName = 'Gym membership';
  await p.evaluate(() => document.querySelector("#history-ledger-entry [onclick*=\"onLedgerAddRow('fixed')\"]").click());
  await p.waitForTimeout(800);
  const withDraft = await rows();
  const draft = withDraft.find(r => /gym/i.test(r.name));
  t('Add item creates ONE row (no duplicate)', withDraft.filter(r => /gym/i.test(r.name)).length === 1, '');
  t('Blank draft has a remove button', !!draft && /onLedgerDraftRemove/.test(draft.x || ''), draft ? draft.x : 'no row');

  await p.evaluate(() => {
    const row = [...document.querySelectorAll('#history-ledger-entry .le-row')]
      .find(r => /gym/i.test((r.querySelector('.le-name-text') || {}).textContent || ''));
    if (row) row.querySelector('.le-clear').click();
  });
  await p.waitForTimeout(800);
  t('Blank draft can be removed', (await rows()).every(r => !/gym/i.test(r.name)), '');

  // ---- past month ----
  await p.evaluate(() => window.onLedgerMonthStep(-1));
  await p.waitForTimeout(1100);
  const past = await p.evaluate(() => ({
    label: (document.querySelector('.le-title') || {}).textContent,
    inputs: document.querySelectorAll('#history-ledger-entry input').length
  }));
  t('Can navigate to a PAST month and edit it', past.inputs > 0 && !/current/i.test(past.label || ''), `label="${(past.label||'').trim()}"`);

  // ---- income renders positive in Txns ----
  await p.evaluate(() => window.showPage('transactions'));
  await p.waitForTimeout(1200);
  const txn = await p.evaluate(() => {
    // Read the ROW, not the day-header group: the header carries the day's expense
    // subtotal (a negative) which otherwise gets scooped up alongside the income row.
    const rows = [...document.querySelectorAll('#all-transactions > div > div')]
      .map(e => (e.innerText || '').replace(/\s+/g, ' ').trim())
      .filter(x => /Paycheck/i.test(x));
    return { sample: rows.slice(0, 3).map(s => s.slice(0, 70)) };
  });
  const anyPositive = txn.sample.some(s => /\+\s*\$/.test(s));
  const anyNegative = txn.sample.some(s => /-\s*\$[\d,]*\d/.test(s) && /Paycheck/i.test(s));
  t('Income renders POSITIVE in Txns (not -$4,000)', anyPositive && !anyNegative, txn.sample[0] || '(none found)');

  console.log('\nconsole errors:', errs.length);
  errs.slice(0, 4).forEach(e => console.log('  ' + e));
  const failed = results.filter(r => !r.pass);
  console.log('\n' + (results.length - failed.length) + '/' + results.length + ' checks passed');
  if (failed.length) { console.log('FAILED:'); failed.forEach(f => console.log('  - ' + f.name)); }
  await b.close();
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('HARNESS FAILED:', e.message); process.exit(1); });

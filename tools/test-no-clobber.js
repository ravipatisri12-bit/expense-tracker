const { chromium } = require('/tmp/pwdrv/node_modules/playwright');

(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const p = await b.newPage({ viewport: { width: 400, height: 900 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:5250/', { waitUntil: 'load' });
  await p.waitForTimeout(1600);

  const r = await p.evaluate(() => {
    const t = window.expenseTracker;
    t.expenses = [];
    t.saveExpenses();

    // 1. an importer writes a row and guesses the category
    const imported = {
      id: 'gm_TESTMSG1', gmailMessageId: 'TESTMSG1', amount: 13.20,
      description: 'KWALITY ICE CREA', category: 'Other', date: '2026-08-01',
      timestamp: 1, excludeFromBudget: false, tripId: null, source: 'gmail'
    };
    const first = t.addExpensesBatch([imported]);

    // 2. the user corrects the category by hand
    const row = t.expenses.find(e => String(e.id) === 'gm_TESTMSG1');
    row.category = 'Food';
    row.description = 'Kwality Ice Cream (edited)';
    t.saveExpenses();
    const afterEdit = { category: row.category, description: row.description };

    // 3. the SAME email is imported again — the ledger has forgotten it
    const second = t.addExpensesBatch([{ ...imported }]);

    const now = t.expenses.find(e => String(e.id) === 'gm_TESTMSG1');
    return {
      firstAdd: first,
      afterEdit,
      secondAdd: second,
      rowCount: t.expenses.filter(e => String(e.id) === 'gm_TESTMSG1').length,
      categoryNow: now.category,
      descriptionNow: now.description
    };
  });

  console.log('1st import        :', JSON.stringify(r.firstAdd));
  console.log('after manual edit :', JSON.stringify(r.afterEdit));
  console.log('2nd import (dup)  :', JSON.stringify(r.secondAdd));
  console.log('rows with that id :', r.rowCount);
  console.log('category now      :', r.categoryNow);
  console.log('description now   :', r.descriptionNow);
  console.log();
  const pass = r.rowCount === 1 && r.categoryNow === 'Food' &&
               r.descriptionNow === 'Kwality Ice Cream (edited)' &&
               r.secondAdd.added === 0 && r.secondAdd.skipped === 1;
  console.log(pass ? 'PASS — re-import did not clobber the edit and did not duplicate'
                   : 'FAIL — edit was lost or a duplicate appeared');
  console.log('errors:', errs.length);
  errs.slice(0, 3).forEach(e => console.log('  ' + e));
  await b.close();
  process.exit(pass ? 0 : 1);
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });

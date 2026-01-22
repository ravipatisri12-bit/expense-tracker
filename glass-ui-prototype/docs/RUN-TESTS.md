# How to Run Tests

## Quick Start

### Run All Automated Tests
```bash
cd glass-ui-prototype
node test-responsive.js && node test-accessibility.js && node test-persistence.js
```

### Open All Interactive Tests
Open these files in your browser:
- `test-responsive.html`
- `test-accessibility.html`
- `test-persistence.html`

---

## Individual Test Suites

### 1. Responsive Behavior Tests

**Automated:**
```bash
node test-responsive.js
```

**Interactive:**
- Open `test-responsive.html` in browser
- Click "Run All Tests"
- Use viewport buttons to test different widths
- Verify no horizontal scrolling

**What it tests:**
- CSS breakpoints (320px, 375px, 414px, 768px)
- Horizontal overflow prevention
- Touch target sizes (44px minimum)
- Viewport meta tag configuration

---

### 2. Accessibility Tests

**Automated:**
```bash
node test-accessibility.js
```

**Interactive:**
- Open `test-accessibility.html` in browser
- Click "Run All Tests"
- Press Tab to test keyboard navigation
- Enable OS accessibility features to test

**What it tests:**
- Keyboard navigation support
- Focus states (2px blue outline)
- Reduced motion support
- High contrast mode support
- Color contrast ratios
- Semantic HTML structure

**Manual verification required:**
- Tab through all elements
- Enable "Reduce Motion" in OS settings
- Enable "Increase Contrast" in OS settings
- Use screen reader (VoiceOver on Mac, NVDA on Windows)

---

### 3. Data Persistence Tests

**Automated:**
```bash
node test-persistence.js
```

**Interactive:**
- Open `test-persistence.html` in browser
- Click "Run All Tests"
- Check "Current LocalStorage State" section
- Test multi-tab behavior

**What it tests:**
- localStorage implementation
- Expense persistence
- Settings persistence
- Data loading on init
- Immediate persistence on changes
- Error handling

**Manual verification required:**
1. Add expenses in main app
2. Close browser completely
3. Reopen and verify data persists
4. Update settings
5. Close and verify settings persist
6. Open multiple tabs and verify sync

---

## Test Results

All tests should show:
- ✅ PASS for passing tests
- ⚠️ WARNING for optional features
- ❌ FAIL for failing tests

### Expected Results:
- **Responsive:** 5/5 tests pass
- **Accessibility:** 6/6 tests pass
- **Persistence:** 6/6 tests pass

---

## Troubleshooting

### Tests fail to run
- Ensure you're in the `glass-ui-prototype` directory
- Check that Node.js is installed: `node --version`
- Verify test files exist: `ls test-*.js`

### Browser tests don't work
- Open browser console (F12) to see errors
- Check that `index.html` and `script.js` exist
- Verify browser supports localStorage
- Try in different browser (Chrome, Firefox, Safari)

### localStorage tests fail
- Clear browser data and try again
- Check browser privacy settings
- Verify localStorage is not disabled
- Try in non-incognito/private mode

---

## CI/CD Integration

To run tests in CI/CD pipeline:

```bash
#!/bin/bash
cd glass-ui-prototype

echo "Running responsive tests..."
node test-responsive.js || exit 1

echo "Running accessibility tests..."
node test-accessibility.js || exit 1

echo "Running persistence tests..."
node test-persistence.js || exit 1

echo "All tests passed!"
```

---

## Browser DevTools Tips

### Check Responsive Design:
1. Open DevTools (F12)
2. Click device toolbar icon (Ctrl+Shift+M)
3. Select device or enter custom dimensions
4. Test at: 320px, 375px, 414px, 768px

### Check Accessibility:
1. Open DevTools (F12)
2. Go to "Lighthouse" tab
3. Select "Accessibility" category
4. Click "Generate report"

### Check localStorage:
1. Open DevTools (F12)
2. Go to "Application" tab
3. Expand "Local Storage" in sidebar
4. Click on your domain
5. View stored data

---

## Next Steps

After running all tests:
1. Review TESTING-SUMMARY.md for detailed results
2. Complete manual testing checklist
3. Test on real devices
4. Test with actual screen readers
5. Verify in different browsers

---

## Support

If tests fail or you need help:
1. Check console output for error messages
2. Review TESTING-SUMMARY.md for requirements
3. Check browser compatibility
4. Verify all files are present
5. Try clearing browser cache/data

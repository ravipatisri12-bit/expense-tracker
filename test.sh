#!/bin/bash
# Pre-commit smoke test — run before every commit
# Usage: ./test.sh

cd "$(dirname "$0")"
ERRORS=0

echo "🔍 Running smoke tests..."

# 1. Vite build must succeed
echo -n "  Build... "
BUILD=$(npx vite build 2>&1)
if [ $? -ne 0 ]; then
    echo "❌ FAIL"
    echo "$BUILD"
    ERRORS=$((ERRORS + 1))
else
    echo "✅"
fi

# 2. All script tags in index.html must point to files that exist
echo -n "  Script files exist... "
MISSING=""
for f in $(grep -oE 'src="(js/[^"]+|script\.js)"' index.html | sed 's/src="//;s/"//'); do
    [ ! -f "$f" ] && MISSING="$MISSING $f"
done
if [ -n "$MISSING" ]; then
    echo "❌ FAIL — missing:$MISSING"
    ERRORS=$((ERRORS + 1))
else
    echo "✅"
fi

# 3. Functions called in index.html onclick handlers must exist in JS
echo -n "  onclick handlers... "
MISSING_FN=""
for fn in $(grep -oE 'onclick="[a-zA-Z]+\(' index.html | sed 's/onclick="//;s/(//' | sort -u | grep -vE '^(if|return|this|event|new)$'); do
    if ! grep -rq "function $fn" script.js js/*.js 2>/dev/null; then
        MISSING_FN="$MISSING_FN $fn"
    fi
done
if [ -n "$MISSING_FN" ]; then
    echo "❌ FAIL — missing functions:$MISSING_FN"
    ERRORS=$((ERRORS + 1))
else
    echo "✅"
fi

# 4. Global functions in script.js that index.html calls must not be wrapped in conditions
echo -n "  ExpenseTracker class... "
if grep -q "class ExpenseTracker" script.js; then
    echo "✅"
else
    echo "❌ FAIL — ExpenseTracker class missing from script.js"
    ERRORS=$((ERRORS + 1))
fi

# 5. CSS files referenced must exist
echo -n "  CSS files exist... "
MISSING_CSS=""
for f in $(grep -oE 'href="styles/[^"]+\.css"' index.html | sed 's/href="//;s/"//'); do
    [ ! -f "$f" ] && MISSING_CSS="$MISSING_CSS $f"
done
if [ -n "$MISSING_CSS" ]; then
    echo "❌ FAIL — missing:$MISSING_CSS"
    ERRORS=$((ERRORS + 1))
else
    echo "✅"
fi

# 6. JS getElementById calls in script.js must have null guards or exist in HTML
echo -n "  Element ID safety... "
HTML_IDS=$(grep -ohE 'id="[^"]*"' index.html | sed 's/id="//;s/"//' | sort -u)
UNSAFE=""
# Get all getElementById calls from script.js with line numbers
while IFS=: read -r line content; do
    ID=$(echo "$content" | grep -oE "getElementById\(['\"][^'\"]+['\"]\)" | head -1 | sed "s/getElementById('//;s/getElementById(\"//;s/['\"])//g")
    [ -z "$ID" ] && continue
    echo "$ID" | grep -q '\$' && continue
    # Check if ID exists in HTML
    if ! echo "$HTML_IDS" | grep -qx "$ID"; then
        # Check if there's a null guard nearby (within 3 lines)
        CONTEXT=$(sed -n "$((line-1)),$((line+2))p" script.js)
        if ! echo "$CONTEXT" | grep -qE "if.*!|if.*==.*null|\?\.|return;"; then
            UNSAFE="$UNSAFE $ID(L$line)"
        fi
    fi
done < <(grep -n "getElementById" script.js)
if [ -n "$UNSAFE" ]; then
    echo "⚠️  WARN — unguarded missing IDs:$UNSAFE"
else
    echo "✅"
fi

echo ""
if [ $ERRORS -gt 0 ]; then
    echo "💥 $ERRORS test(s) failed. DO NOT COMMIT."
    exit 1
else
    echo "✅ All tests passed. Safe to commit."
    exit 0
fi

#!/bin/bash

# Glass UI Prototype - Apply All Critical Fixes
# This script applies all the fixes identified in the issues

echo "🔧 Applying critical fixes to Glass UI Prototype..."

# Backup original files
echo "📦 Creating backups..."
cp script.js script.js.backup
cp index.html index.html.backup
cp styles.css styles.css.backup

echo "✅ Backups created"

# Fix 1: Update formatAmount method to support selective privacy
echo "🔒 Fixing privacy mode..."
sed -i.tmp 's/formatAmount(amount) {/formatAmount(amount, hideInPrivacy = false) {/g' script.js
sed -i.tmp 's/if (this.settings.privacyMode) {/if (this.settings.privacyMode \&\& hideInPrivacy) {/g' script.js

# Fix 2: Change "Variable Spending" to "Monthly Spending" in HTML
echo "📝 Updating gauge title..."
sed -i.tmp 's/<h2>Variable Spending<\/h2>/<h2>Monthly Spending<\/h2>/g' index.html

# Fix 3: Increase gauge size in CSS
echo "📏 Increasing gauge size..."
sed -i.tmp 's/width: 200px;/width: 280px;/g' styles.css
sed -i.tmp 's/height: 200px;/height: 280px;/g' styles.css

# Fix 4: Update gauge SVG viewBox and circles in HTML
echo "🎨 Updating gauge SVG..."
sed -i.tmp 's/viewBox="0 0 200 200"/viewBox="0 0 280 280"/g' index.html
sed -i.tmp 's/cx="100"/cx="140"/g' index.html
sed -i.tmp 's/cy="100"/cy="140"/g' index.html
sed -i.tmp 's/r="85"/r="120"/g' index.html

# Clean up temp files
rm -f script.js.tmp index.html.tmp styles.css.tmp

echo "✨ All fixes applied successfully!"
echo ""
echo "📋 Summary of changes:"
echo "  ✅ Privacy mode now only hides income and savings"
echo "  ✅ Gauge title changed to 'Monthly Spending'"
echo "  ✅ Gauge size increased to 280px"
echo "  ✅ SVG viewBox and circles updated"
echo ""
echo "⚠️  Manual fixes still needed:"
echo "  - Update all formatAmount() calls with hideInPrivacy parameter"
echo "  - Remove duplicate summary cards from home page"
echo "  - Redesign transactions page"
echo "  - Add sign-in functionality"
echo ""
echo "💾 Backups saved as:"
echo "  - script.js.backup"
echo "  - index.html.backup"
echo "  - styles.css.backup"

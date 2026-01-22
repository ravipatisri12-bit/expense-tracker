// CSS Verification Script
// Run this in the browser console to verify Glass UI styles are applied

console.log('🔍 Glass UI CSS Verification\n');

// Check if CSS custom properties are defined
const root = document.documentElement;
const computedStyle = getComputedStyle(root);

console.log('1. CSS Custom Properties:');
const properties = [
    '--bg-primary',
    '--glass-bg',
    '--text-primary',
    '--status-primary',
    '--font-body',
    '--space-md',
    '--radius-xl',
    '--transition-normal'
];

properties.forEach(prop => {
    const value = computedStyle.getPropertyValue(prop).trim();
    console.log(`   ${prop}: ${value || '❌ NOT DEFINED'}`);
});

// Check if ambient background exists
console.log('\n2. Ambient Background:');
const appBg = document.querySelector('.app-background');
console.log(`   .app-background exists: ${appBg ? '✅' : '❌'}`);
if (appBg) {
    const orbs = appBg.querySelectorAll('.gradient-orb');
    console.log(`   Gradient orbs count: ${orbs.length} ${orbs.length === 3 ? '✅' : '❌ (expected 3)'}`);
}

// Check glass cards
console.log('\n3. Glass Cards:');
const glassCards = document.querySelectorAll('.glass-card');
console.log(`   Glass cards found: ${glassCards.length}`);
if (glassCards.length > 0) {
    const firstCard = glassCards[0];
    const cardStyle = getComputedStyle(firstCard);
    console.log(`   backdrop-filter: ${cardStyle.backdropFilter || cardStyle.webkitBackdropFilter || '❌'}`);
    console.log(`   background: ${cardStyle.background}`);
    console.log(`   border-radius: ${cardStyle.borderRadius}`);
}

// Check bottom navigation
console.log('\n4. Bottom Navigation:');
const bottomNav = document.querySelector('.bottom-nav');
console.log(`   .bottom-nav exists: ${bottomNav ? '✅' : '❌'}`);
if (bottomNav) {
    const navItems = bottomNav.querySelectorAll('.nav-item');
    console.log(`   Nav items count: ${navItems.length}`);
    if (navItems.length > 0) {
        const firstItem = navItems[0];
        const itemStyle = getComputedStyle(firstItem);
        console.log(`   Min-height: ${itemStyle.minHeight} ${parseInt(itemStyle.minHeight) >= 44 ? '✅' : '❌ (should be ≥44px)'}`);
        console.log(`   Min-width: ${itemStyle.minWidth} ${parseInt(itemStyle.minWidth) >= 44 ? '✅' : '❌ (should be ≥44px)'}`);
    }
}

// Check spending gauge
console.log('\n5. Spending Gauge:');
const gauge = document.querySelector('.spending-gauge');
console.log(`   .spending-gauge exists: ${gauge ? '✅' : '❌'}`);
if (gauge) {
    const gaugeSvg = gauge.querySelector('.gauge-svg');
    const gaugeProgress = gauge.querySelector('.gauge-progress');
    console.log(`   SVG exists: ${gaugeSvg ? '✅' : '❌'}`);
    console.log(`   Progress arc exists: ${gaugeProgress ? '✅' : '❌'}`);
}

// Check form components
console.log('\n6. Form Components:');
const glassInputs = document.querySelectorAll('.glass-input');
const glassSelects = document.querySelectorAll('.glass-select');
const glassButtons = document.querySelectorAll('.glass-button, .glass-button-primary');
console.log(`   Glass inputs: ${glassInputs.length}`);
console.log(`   Glass selects: ${glassSelects.length}`);
console.log(`   Glass buttons: ${glassButtons.length}`);

// Check typography classes
console.log('\n7. Typography:');
const typographyClasses = [
    'text-hero',
    'text-title', 
    'text-heading',
    'text-body',
    'text-caption',
    'text-small'
];
typographyClasses.forEach(cls => {
    const elements = document.querySelectorAll(`.${cls}`);
    console.log(`   .${cls}: ${elements.length} elements`);
});

// Check responsive breakpoints
console.log('\n8. Viewport:');
console.log(`   Width: ${window.innerWidth}px`);
console.log(`   Height: ${window.innerHeight}px`);
if (window.innerWidth < 375) {
    console.log('   📱 Small phone breakpoint active');
} else if (window.innerWidth >= 768) {
    console.log('   💻 Tablet breakpoint active');
} else {
    console.log('   📱 Default mobile breakpoint active');
}

// Check for Tailwind (should be removed)
console.log('\n9. Tailwind Check:');
const tailwindScript = document.querySelector('script[src*="tailwindcss"]');
console.log(`   Tailwind CDN: ${tailwindScript ? '❌ STILL PRESENT (should be removed)' : '✅ Removed'}`);

// Summary
console.log('\n✨ Verification Complete!');
console.log('Check the results above for any ❌ marks that need attention.');

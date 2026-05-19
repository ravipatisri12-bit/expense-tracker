/** Forecast helper. Spec §4.2. */
(function () {
    function projection(monthTotalRegular, day, daysInMonth) {
        const safeDay = Math.max(1, day);
        return Math.round((monthTotalRegular / safeDay) * daysInMonth);
    }
    function display(monthName, monthTotalRegular, day, daysInMonth) {
        const p = projection(monthTotalRegular, day, daysInMonth);
        return `· At this rate ${monthName} ends ~$${p.toLocaleString()}`;
    }
    window.Forecast = { projection, display };
})();

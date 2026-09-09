// Theme toggle: flips the data-theme attribute on <html> and remembers the choice.
// The initial theme is applied by a tiny inline script in the template <head>
// (before first paint) so there is no flash; this module only handles toggling.
document.addEventListener("DOMContentLoaded", function () {
    const btn = document.getElementById("themeToggleBtn");
    const icon = document.getElementById("themeIcon");
    const sunIconUrl = btn.getAttribute("data-sun-icon");
    const moonIconUrl = btn.getAttribute("data-moon-icon");

    function applyIcon() {
        const isLight = document.documentElement.dataset.theme === "light";
        icon.setAttribute("src", isLight ? moonIconUrl : sunIconUrl);
    }

    btn.addEventListener("click", function () {
        const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
        document.documentElement.dataset.theme = next;
        try { localStorage.setItem("theme", next); } catch (_) { /* storage unavailable */ }
        applyIcon();
    });

    applyIcon();
});

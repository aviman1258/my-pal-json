document.addEventListener("DOMContentLoaded", function() {
    const themeStylesheet = document.getElementById("themeStylesheet");
    const themeToggleBtn = document.getElementById("themeToggleBtn");
    const themeIcon = document.getElementById("themeIcon");

    // Fetch the URLs from data attributes
    const lightstyleUrl = themeToggleBtn.getAttribute('data-lightstyle-url');
    const darkstyleUrl = themeToggleBtn.getAttribute('data-darkstyle-url');
    const sunIconUrl = themeToggleBtn.getAttribute('data-sun-icon');
    const moonIconUrl = themeToggleBtn.getAttribute('data-moon-icon');

    // Track current theme (default is dark)
    let isDarkTheme = true;

    // Check the current stylesheet and switch
    themeToggleBtn.addEventListener("click", function() {
        if (isDarkTheme) {
            // Switch to light theme
            themeStylesheet.setAttribute("href", lightstyleUrl);
            // Change icon to moon
            themeIcon.setAttribute("src", moonIconUrl);
        } else {
            // Switch back to dark theme
            themeStylesheet.setAttribute("href", darkstyleUrl);
            // Change icon back to sun
            themeIcon.setAttribute("src", sunIconUrl);
        }

        // Toggle theme state
        isDarkTheme = !isDarkTheme;
    });
});

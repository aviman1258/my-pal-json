document.addEventListener("DOMContentLoaded", function () {
    const toggleHeadersBtn = document.getElementById('toggleHeadersBtn');
    const toggleIcon = document.getElementById('toggleIcon');
    const headersSection = document.getElementById('headersGrid');
    const isAuthLbl = document.getElementById('isAuthLbl')

    toggleHeadersBtn.addEventListener('click', function () {
        if (headersSection.style.display === 'none') {
            isAuthLbl.style.display = 'grid';
            headersSection.style.display = 'grid';
            toggleIcon.src = toggleIcon.getAttribute('data-eye-slash'); // Show eye-slash icon
        } else {
            headersSection.style.display = 'none';
            isAuthLbl.style.display = 'none';
            toggleIcon.src = toggleIcon.getAttribute('data-eye'); // Show eye icon
        }
    });

    // Set initial visibility
    headersSection.style.display = 'grid'; // Start with headers section visible
});

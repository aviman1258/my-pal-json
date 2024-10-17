document.getElementById('copyBtn').addEventListener('click', function() {
    const outputText = document.getElementById('outputBox').value;
    const copyButton = document.getElementById('copyBtn');

    if (outputText) {
        // Use the Clipboard API to copy text
        navigator.clipboard.writeText(outputText)
        .then(() => {
            // Flash the button green on success
            copyButton.classList.add('flash-success');

            // Remove the flash effect after a short delay
            setTimeout(() => {
                copyButton.classList.remove('flash-success');
            }, 500);  // Flash duration
        })
        .catch(() => {
            // Flash the button red on error
            copyButton.classList.add('flash-error');

            setTimeout(() => {
                copyButton.classList.remove('flash-error');
            }, 500);  // Flash duration
        });
    } else {
        // Flash the button red if there's nothing to copy
        copyButton.classList.add('flash-error');

        setTimeout(() => {
            copyButton.classList.remove('flash-error');
        }, 500);  // Flash duration
    }
});

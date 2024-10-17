document.getElementById('copyBtn').addEventListener('click', function() {
    const outputText = document.getElementById('outputBox').value;

    if (outputText) {
        // Create a temporary textarea element to hold the text
        const tempTextArea = document.createElement('textarea');
        tempTextArea.value = outputText;
        document.body.appendChild(tempTextArea);

        // Select the text and copy it to the clipboard
        tempTextArea.select();
        document.execCommand('copy');

        // Remove the temporary element
        document.body.removeChild(tempTextArea);

        // Optionally, notify the user
        alert('Text copied to clipboard!');
    } else {
        alert('No text to copy!');
    }
});

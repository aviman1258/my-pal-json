document.getElementById("prettyBtn").addEventListener("click", function() {
    const inputJson = document.getElementById("inputJson").value;
    const outputBox = document.getElementById("outputBox");

    let sanitizedInput = inputJson
        .replace(/\\r/g, '')  // Remove carriage returns
        .replace(/\\n/g, '')  // Remove newlines
        .replace(/\\/g, '')
        .replace(/"\[/g, '[')
        .replace(/"\{/g, '{')
        .replace(/\]"/g, ']')
        .replace(/\}"/g, '}')

    try {
        const parsedJson = JSON.parse(sanitizedInput); // Parse JSON to ensure it's valid
        const prettyJson = JSON.stringify(parsedJson, null, 4); // Format JSON with 4-space indentation
        outputBox.value = prettyJson; // Display formatted JSON in output box
    } catch (error) {
        outputBox.value = `Invalid JSON format. Attempted sanitization:\n\n${sanitizedInput}`;
    }
});

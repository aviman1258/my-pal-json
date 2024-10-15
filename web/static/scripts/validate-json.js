document.getElementById('analyzeBtn').addEventListener('click', function() {
    const inputJson = document.getElementById('inputJson').value;
    const outputBox = document.getElementById('outputBox');

    try {
        const parsedJson = JSON.parse(inputJson);

        fetch('http://127.0.0.1:5000/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(parsedJson),
        })
        .then(response => response.json())
        .then(data => {
            if (data.tree) {
                // Display the tree structure in the textarea
                outputBox.value = data.tree;
            } else if (data.error) {
                outputBox.value = `Error: ${data.error}`;
            } else {
                outputBox.value = 'Unexpected response format';
            }
        })
        .catch(error => {
            console.error('Error:', error);
            outputBox.value = 'An error occurred while processing the JSON.';
        });

    } catch (error) {
        outputBox.value = "Invalid JSON: " + error.message;
    }
});

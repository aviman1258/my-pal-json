document.getElementById('modelBtn').addEventListener('click', function() {
    const inputJson = document.getElementById('inputJson').value;
    const outputJson = document.getElementById('outputJson');

    try {
        outputJson.style.color = "black";
        // Try to parse the input as JSON
        const parsedJson = JSON.parse(inputJson);

        // Send JSON to the Python server to process and get the tree structure

        fetch('http://127.0.0.1:5000/model', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(parsedJson),
        })
        .then(response => response.json())
        .then(data => {
            // Display the tree structure in the output text box
            outputJson.value = data.tree;
        })
        .catch(error => {
            console.error('Error:', error);
            outputJson.style.color = "red";
            outputJson.value = 'An error occurred while modeling the JSON.';
        });

    } catch (error) {
        // Display error if JSON is invalid
        outputJson.value = "Invalid JSON: " + error.message;
        outputJson.style.color = "red";
    }
});
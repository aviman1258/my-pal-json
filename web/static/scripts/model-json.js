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
            if (data.files) {
                // Display the file names in the output box
                outputJson.value = data.files.map(file => file.name).join('\n');
            } else if (data.error) {
                // Display error message if there's an error in the response
                outputJson.value = `Error: ${data.error}`;
            } else {
                outputJson.value = 'Unexpected response format';
            }
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
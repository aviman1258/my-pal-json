document.getElementById('modelBtn').addEventListener('click', function() {
    const inputJson = document.getElementById('inputJson').value;
    const outputBox = document.getElementById('outputBox');

    try {
        const parsedJson = JSON.parse(inputJson);

        fetch('http://127.0.0.1:5000/model', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(parsedJson),
        })
        .then(response => {
            if (!response.ok) {
                throw new Error("Failed to fetch model");
            }
            return response.json();  // Ensure response is parsed as JSON
        })
        .then(data => {
            outputBox.value = '';
            if (data.class_content) {
                // Display the entire class content in the output box
                outputBox.value = data.class_content;
            } else if (data.error) {
                outputBox.value = `Error: ${data.error}`;
            } else {
                outputBox.value = 'Unexpected response format';
            }
        })
        .catch(error => {
            console.error('Error:', error);
            outputBox.value = 'An error occurred while generating the model.';
        });

    } catch (error) {
        outputBox.value = "Invalid JSON: " + error.message;
    }
});

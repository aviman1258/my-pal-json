document.getElementById('analyzeBtn').addEventListener('click', function() {
    const inputJson = document.getElementById('inputJson').value;
    const analyzeOutput = document.getElementById('analyzeOutput');
    const modelOutput = document.getElementById('modelOutput');

    // Hide the modelOutput and show the analyzeOutput
    modelOutput.classList.remove('active');
    analyzeOutput.classList.add('active');

    try {
        analyzeOutput.style.color = "black";
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
                analyzeOutput.value = data.tree;
            } else if (data.error) {
                analyzeOutput.value = `Error: ${data.error}`;
            } else {
                analyzeOutput.value = 'Unexpected response format';
            }
        })
        .catch(error => {
            console.error('Error:', error);
            analyzeOutput.style.color = "red";
            analyzeOutput.value = 'An error occurred while processing the JSON.';
        });

    } catch (error) {
        analyzeOutput.value = "Invalid JSON: " + error.message;
        analyzeOutput.style.color = "red";
    }
});

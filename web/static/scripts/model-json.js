document.getElementById('modelBtn').addEventListener('click', function() {
    const inputJson = document.getElementById('inputJson').value;
    const analyzeOutput = document.getElementById('analyzeOutput');
    const modelOutput = document.getElementById('modelOutput');

    // Hide the analyzeOutput and show the modelOutput
    analyzeOutput.classList.remove('active');
    modelOutput.classList.add('active');

    try {
        const parsedJson = JSON.parse(inputJson);

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
                // Clear the model output container and insert download links
                modelOutput.innerHTML = ''; // Clear previous content
                // Store the files in localStorage and create download links
                data.files.forEach(file => {
                    // Assuming server response has file content as well, save content to localStorage
                    fetch(`http://127.0.0.1:5000/download/${file.name}`)
                    .then(fileResponse => fileResponse.text())
                    .then(fileContent => {
                        // Store file content in localStorage
                        localStorage.setItem(file.name, fileContent);

                        // Create a download link
                        const link = document.createElement('a');
                        link.href = `data:text/plain;charset=utf-8,${encodeURIComponent(fileContent)}`;
                        link.download = file.name;  // Set file name for download
                        link.textContent = file.name;
                        link.style.display = 'block';  // Display links on separate lines
                        modelOutput.appendChild(link);  // Append the link to the container
                    });
                });
            } else if (data.error) {
                modelOutput.textContent = `Error: ${data.error}`;
            } else {
                modelOutput.textContent = 'Unexpected response format';
            }
        })
        .catch(error => {
            console.error('Error:', error);
            modelOutput.style.color = "red";
            modelOutput.textContent = 'An error occurred while generating the model.';
        });

    } catch (error) {
        modelOutput.textContent = "Invalid JSON: " + error.message;
        modelOutput.style.color = "red";
    }
});

let requestData = "";
let responseData = "";

document.getElementById("sendBtn").addEventListener("click", async () => {
    // Collect data from inputs
    const apiUrl = document.getElementById("apiUrl").value;
    const httpMethod = document.getElementById("httpMethod").value;
    const inputJsonElement = document.getElementById("inputJson");
    const outputBoxElement = document.getElementById("outputBox");
    const headersGrid = document.getElementById("headersGrid");

    // Gather headers from the headers grid
    const headers = {};
    headersGrid.querySelectorAll(".header-key-input").forEach((keyInput, index) => {
        const valueInput = headersGrid.querySelectorAll(".header-value")[index];
        const authCheckbox = headersGrid.querySelectorAll(".auth-checkbox")[index];
        if (keyInput.value && valueInput.value) {
            headers[keyInput.value] = authCheckbox.checked
                ? `Bearer ${valueInput.value}`
                : valueInput.value;
        }
    });

    document.getElementById("requestTab").classList.add("active");
    document.getElementById("responseTab").classList.remove("active");

    if (responseData != "") {
        inputJsonElement.value = requestData;
    }

    requestData = inputJsonElement.value;

    // Parse JSON body from inputJson
    let body = null;
    try {
        body = inputJsonElement.value ? JSON.parse(inputJsonElement.value) : null;
    } catch (error) {
        // Display error in outputBox
        outputBoxElement.value = "Error: Invalid JSON in input area. Please correct it and try again.";
        return;
    }

    // Clear inputJson and outputBox for a fresh request
    inputJsonElement.value = "";
    outputBoxElement.value = "";

    // Send data to Flask endpoint
    try {
        const response = await fetch("/proxy_request", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ apiUrl, httpMethod, headers, body })
        });        

        if (response.status >= 400) {
            inputJsonElement.value = "Status Code: " + response.status + ": " + response.statusText;
        } else {
            const result = await response.json();

            // Process the response content
            let responseContent = result.content;

            // Check if response content is wrapped in quotes (a JSON string)
            if (typeof responseContent === "string") {
                try {
                    // Attempt to parse as JSON if it's a string
                    responseContent = JSON.parse(responseContent);
                } catch (parseError) {
                    // If parsing fails, leave it as is (plain text)
                }
            }

            // Display formatted JSON in inputJson or show error message
            inputJsonElement.value = JSON.stringify(responseContent, null, 2); // Format JSON response
        }

        responseData = inputJsonElement.value;

        document.getElementById("requestTab").classList.remove("active");
        document.getElementById("responseTab").classList.add("active");
    } catch (error) {
        // Display network or other errors in outputBox
        outputBoxElement.value = `Error: Unable to make the API request. ${error.message}`;
    }
});

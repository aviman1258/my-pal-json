// Assuming your save button has an id of "saveBtn"
document.getElementById("saveBtn").addEventListener("click", () => {
    // Retrieve values from your input fields
    const apiUrl = document.getElementById("apiUrl").value;
    const method = document.getElementById("httpMethod").value;
    const body = document.getElementById("inputJson").value;

    // Assuming headers are in a structured format in an array
    const headers = getHeaders(); // Function to retrieve headers with isAuth information

    // Call the saveApiCall function with the necessary arguments
    saveApiCall(apiUrl, method, headers, body);
});

// Function to open/create the IndexedDB database
const openDatabase = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("MyPalJsonDB", 1);

        request.onupgradeneeded = function(event) {
            const db = event.target.result;
            if (!db.objectStoreNames.contains("apiCalls")) {
                const apiCallsStore = db.createObjectStore("apiCalls", { keyPath: "id", autoIncrement: true });
                apiCallsStore.createIndex("apiUrl", "apiUrl", { unique: false });
                apiCallsStore.createIndex("method", "method", { unique: false });
                apiCallsStore.createIndex("timestamp", "timestamp", { unique: false });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

// Function to filter out auth headers
const filterAuthHeaders = (headers) => {
    return headers.filter(header => !header.isAuth);
};

// Check for existing duplicate API call
const isDuplicateCall = async (db, apiUrl, method, headers, body) => {
    const filteredHeaders = filterAuthHeaders(headers);
    const transaction = db.transaction("apiCalls", "readonly");
    const store = transaction.objectStore("apiCalls");

    return new Promise((resolve) => {
        const request = store.openCursor();
        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                const record = cursor.value;
                if (
                    record.apiUrl === apiUrl &&
                    record.method === method &&
                    JSON.stringify(filterAuthHeaders(record.headers)) === JSON.stringify(filteredHeaders) &&
                    JSON.stringify(record.body) === JSON.stringify(body)
                ) {
                    resolve(true); // Duplicate found
                    return;
                }
                cursor.continue();
            } else {
                resolve(false); // No duplicate
            }
        };
        request.onerror = () => resolve(false);
    });
};

// Save the API call if not a duplicate
const saveApiCall = async (apiUrl, method, headers, body) => {    
    const outputBox = document.getElementById("outputBox");

     // Check if apiUrl is empty
     if (!apiUrl.trim()) {
        outputBox.value = "API URL is required. Please enter a valid API URL.";
        return;
    }

    const db = await openDatabase();

    if (await isDuplicateCall(db, apiUrl, method, headers, body)) {
        outputBox.value = "Duplicate API call found. This call was not saved.";
        return;
    }

    const transaction = db.transaction("apiCalls", "readwrite");
    const store = transaction.objectStore("apiCalls");

    const apiCall = { apiUrl, method, headers, body, timestamp: Date.now() };
    store.add(apiCall);

    transaction.oncomplete = () => {
        outputBox.value = "API call saved successfully.";
    };
    transaction.onerror = () => {
        outputBox.value = "Error saving API call.";
    };
};

// Function to retrieve headers with isAuth information from the headers grid
function getHeaders() {
    const headersGrid = document.getElementById("headersGrid");
    const headers = [];

    // Loop through each header row in the headers grid
    const rows = headersGrid.children;
    for (let i = 0; i < rows.length; i += 3) {
        // Each header row consists of three parts: auth checkbox, key input, and value input
        const authCheckbox = rows[i].querySelector(".auth-checkbox");
        const keyInput = rows[i + 1].querySelector(".header-key-input");
        const valueInput = rows[i + 2];

        // Get the values of the checkbox, key, and value
        const isAuth = authCheckbox.checked;
        const key = keyInput.value.trim();
        const value = valueInput.value.trim();

        // Only add headers that have a key (skip empty rows)
        if (key !== "") {
            headers.push({ name: key, value: value, isAuth: isAuth });
        }
    }

    return headers;
}

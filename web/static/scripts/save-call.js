import { dataStore } from './send-request.js';

// Open the save modal when the save button is clicked
document.getElementById("saveBtn").addEventListener("click", async () => {
    // Open the save modal
    openSaveModal();

    // Generate a default name for the API call (e.g., "MyRequest1", "MyRequest2", etc.)
    const defaultName = await getNextDefaultName();
    document.getElementById("apiCallName").value = defaultName;
});

// Get the next available default name based on existing saved API calls
const getNextDefaultName = async () => {
    const db = await openDatabase();
    const transaction = db.transaction("apiCalls", "readonly");
    const store = transaction.objectStore("apiCalls");

    return new Promise((resolve) => {
        const request = store.getAll();
        request.onsuccess = (event) => {
            const apiCalls = event.target.result;
            let maxIndex = 0;
            apiCalls.forEach(apiCall => {
                const match = apiCall.name && apiCall.name.match(/^MyRequest(\d+)$/);
                if (match) {
                    maxIndex = Math.max(maxIndex, parseInt(match[1]));
                }
            });
            resolve(`MyRequest${maxIndex + 1}`);
        };
        request.onerror = () => resolve("MyRequest1");
    });
};

// Function to filter out auth headers
const filterAuthHeaders = (headers) => {
    return headers.filter(header => !header.isAuth);
};

// Save the API call to IndexedDB
export const saveApiCall = async (name, apiUrl, method, headers, body) => {
    const outputBox = document.getElementById("outputBox");

    // Check if apiUrl is empty
    if (!apiUrl.trim()) {
        outputBox.value = "API URL is required. Please enter a valid API URL.";
        return;
    }

    const db = await openDatabase();

    const transaction = db.transaction("apiCalls", "readwrite");
    const store = transaction.objectStore("apiCalls");

    const getAllRequest = store.getAll();

    getAllRequest.onsuccess = (event) => {
        const apiCalls = event.target.result;
        
        // Find the highest order value or default to 0 if no items exist
        const maxOrder = apiCalls.length 
            ? Math.max(...apiCalls.map(call => call.order !== undefined ? call.order : 0)) : 0;

        // Create new API call with incremented order
        const apiCall = {
            name,
            apiUrl,
            method,
            headers,
            body: dataStore.requestData,
            timestamp: Date.now(),
            order: maxOrder + 1 // Increment the highest order value
        };
        store.add(apiCall);

        transaction.oncomplete = () => {
            outputBox.value = "API call saved successfully.";
            closeSaveModal();
        };
        transaction.onerror = () => {
            outputBox.value = "Error saving API call.";
        };
    };

    getAllRequest.onerror = () => {
        outputBox.value = "Error retrieving order information.";
    };
};

// Function to retrieve headers with isAuth information from the headers grid
export function getHeaders() {
    const headersGrid = document.getElementById("headersGrid");
    const headers = [];

    const rows = headersGrid.children;
    for (let i = 0; i < rows.length; i += 3) {
        const authCheckbox = rows[i].querySelector(".auth-checkbox");
        const keyInput = rows[i + 1].querySelector(".header-key-input");
        const valueInput = rows[i + 2];

        const isAuth = authCheckbox.checked;
        const key = keyInput.value.trim();
        const value = valueInput.value.trim();

        if (key !== "") {
            headers.push({ name: key, value: value, isAuth: isAuth });
        }
    }

    return headers;
}

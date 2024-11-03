// Get references to the modal and close button
const historyModal = document.getElementById("historyModal");
const closeModal = document.getElementById("closeModal");
const historyList = document.getElementById("historyList");

// Function to open the modal and load API call history
document.getElementById("historyBtn").addEventListener("click", async () => {
    const db = await openDatabase();
    loadApiCallHistory(db);
    historyModal.style.display = "block";
});

// Close the modal when the close button is clicked
closeModal.onclick = function() {
    historyModal.style.display = "none";
};

// Close the modal when clicking outside of the modal content
window.onclick = function(event) {
    if (event.target === historyModal) {
        historyModal.style.display = "none";
    }
};

// Function to load API call history from IndexedDB
const loadApiCallHistory = (db) => {
    historyList.innerHTML = ""; // Clear previous content

    const transaction = db.transaction("apiCalls", "readonly");
    const store = transaction.objectStore("apiCalls");

    // Fetch all records in the store
    const request = store.getAll();
    request.onsuccess = (event) => {
        const apiCalls = event.target.result;
        
        if (apiCalls.length === 0) {
            historyList.innerHTML = "<p>No API calls found in history.</p>";
            return;
        }

        // Display each API call as an item in the history list
        apiCalls.forEach(apiCall => {
            const item = document.createElement("div");
            item.classList.add("history-item");

            // Display headers as a list
            let headersHtml = `<ul class="header-list">`;
            apiCall.headers.forEach(header => {
                headersHtml += `<li>${header.name}: ${header.value}</li>`;
            });
            headersHtml += `</ul>`;

            // Add delete button to each item
            const deleteButton = document.createElement("button");
            deleteButton.classList.add("delete-button");
            deleteButton.innerHTML = `<img src="/static/images/delete.svg" alt="Delete" class="delete-icon">`;
            deleteButton.dataset.id = apiCall.id; // Store the record ID for deletion

            item.innerHTML = `
                <h3>${apiCall.method} ${apiCall.apiUrl}</h3>
                <p>Headers:</p>
                ${headersHtml}
                <p>Body: ${apiCall.body || "None"}</p>
            `;
            item.appendChild(deleteButton); // Add delete button to the item

            historyList.appendChild(item);
        });
    };

    request.onerror = () => {
        historyList.innerHTML = "<p>Error loading API call history.</p>";
    };
};


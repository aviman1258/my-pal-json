import { createHeaderRow } from './headers-management.js';
import { dataStore } from './send-request.js';

// Get references to the modal and close button
const historyModal = document.getElementById("historyModal");
const closeModal = document.getElementById("closeModal");
const historyList = document.getElementById("historyList");

let draggedItem = null;
let scrollInterval = null;

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

function handleDragStart(event) {
    draggedItem = this;
    event.dataTransfer.effectAllowed = "move";
    this.classList.add("dragging");
}

// Function to start auto-scrolling based on direction
function startAutoScroll(direction) {
    stopAutoScroll(); // Clear any previous interval
    scrollInterval = setInterval(() => {
        historyList.scrollTop += direction === 'up' ? -10 : 10; // Adjust scroll speed as needed
    }, 20); // Scroll interval for smoothness
}

// Function to stop auto-scrolling
function stopAutoScroll() {
    if (scrollInterval) {
        clearInterval(scrollInterval);
        scrollInterval = null;
    }
}

function handleDrop(event) {
    event.preventDefault();
    stopAutoScroll();

    // Clear drop indicators
    document.querySelectorAll('.drop-indicator-dark, .drop-indicator-light').forEach(item => {
        item.classList.remove('drop-indicator-dark', 'drop-indicator-light');
    });

    if (draggedItem !== this) {
        historyList.insertBefore(draggedItem, this.nextSibling);
        updateOrderInDatabase();
    }
}

function handleDragEnd() {
    this.classList.remove("dragging");
    stopAutoScroll();
}

function handleDragOver(event) {
    event.preventDefault();

    // Remove existing indicators
    document.querySelectorAll('.drop-indicator-dark, .drop-indicator-light').forEach(item => {
        item.classList.remove('drop-indicator-dark', 'drop-indicator-light');
    });

    // Determine theme
    const isLightTheme = document.getElementById("themeStylesheet").getAttribute("href").includes("lightstyle.css");

    // Apply appropriate indicator based on theme
    if (isLightTheme) {
        this.classList.remove("drop-indicator-dark")
        this.classList.add("drop-indicator-light");        
    } else {
        this.classList.remove("drop-indicator-light")
        this.classList.add("drop-indicator-dark");
    }

    event.dataTransfer.dropEffect = "move";

    // Auto-scroll logic
    const rect = historyList.getBoundingClientRect();
    const offset = 20; // Distance from the top/bottom edge to start scrolling

    if (event.clientY < rect.top + offset) {
        startAutoScroll('up'); // Near the top, scroll up
    } else if (event.clientY > rect.bottom - offset) {
        startAutoScroll('down'); // Near the bottom, scroll down
    } else {
        stopAutoScroll(); // Stop scrolling if not near the edges
    }
}

function loadApiCallIntoForm(apiCall) {
    // Set the API URL
    document.getElementById("apiUrl").value = apiCall.apiUrl;

    // Set the HTTP method
    document.getElementById("httpMethod").value = apiCall.method;

    document.getElementById("responseTab").classList.remove("active");
    document.getElementById("requestTab").classList.add("active");

     // Parse and set the request body (if any)
    try {
        const parsedBody = JSON.parse(apiCall.body);  // Parse if it's a JSON string
        document.getElementById("inputJson").value = JSON.stringify(parsedBody, null, 2); // Pretty format
    } catch (error) {
        // If parsing fails, fallback to raw body
        document.getElementById("inputJson").value = apiCall.body || "";
    }

    dataStore.requestData = document.getElementById("inputJson").value;
    dataStore.responseData = "";

    // Clear existing headers
    const headersGrid = document.getElementById("headersGrid");
    headersGrid.innerHTML = "";

    // Populate headers
    apiCall.headers.forEach(header => {
        createHeaderRow(header.name, header.value, header.isAuth);
    });

    createHeaderRow();
}

// Function to load API call history from IndexedDB
export const loadApiCallHistory = (db) => {
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

        apiCalls.sort((a, b) => a.order - b.order);

        // Display each API call as an item in the history list
        apiCalls.forEach(apiCall => {
            const item = document.createElement("div");
            item.classList.add("history-item");
            item.setAttribute("draggable", "true");
            item.dataset.id = apiCall.id;

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
            deleteButton.title = "Delete";

             // Create load button with load.svg image
            const loadButton = document.createElement("button");
            loadButton.classList.add("load-button");
            loadButton.innerHTML = `<img src="/static/images/load.svg" alt="Load" class="load-icon">`;
            loadButton.title = "Load";

             // Create chain button
             const chainButton = document.createElement("button");
             chainButton.classList.add("chain-button");
             chainButton.innerHTML = `<img src="/static/images/chain.svg" alt="Chain" class="chain-icon">`;
             chainButton.title = "Chain";
             
             chainButton.addEventListener("click", () => {
                item.classList.toggle("highlighted");
             });

            // Load the API call data into My Pal JSON on click
            loadButton.addEventListener("click", () => {
                loadApiCallIntoForm(apiCall);
                historyModal.style.display = "none"; // Close the history modal
            });

            item.innerHTML = `
                <h3 contenteditable="true" class="editable-name">${apiCall.name || "Unnamed API Call"}</h3>
                <p>${apiCall.method} ${apiCall.apiUrl}<p>
                <p>Headers:</p>
                ${headersHtml}
                <p>Body: ${apiCall.body || "None"}</p>
            `;

            item.querySelector(".editable-name").addEventListener("blur", function () {
                saveEditedName(apiCall.id, this.innerText);
            });
        
            item.querySelector(".editable-name").addEventListener("keypress", function (event) {
                if (event.key === "Enter") {
                    event.preventDefault(); // Prevent newline
                    this.blur(); // Trigger the blur event to save changes
                }
            });

            item.addEventListener("dragstart", handleDragStart);
            item.addEventListener("drop", handleDrop);
            item.addEventListener("dragend", handleDragEnd);
            item.addEventListener("dragover", handleDragOver)
            item.appendChild(deleteButton);
            item.appendChild(loadButton);
            item.appendChild(chainButton);
            historyList.appendChild(item);
        });
    };

    request.onerror = () => {
        historyList.innerHTML = "<p>Error loading API call history.</p>";
    };
};

function saveEditedName(id, newName) {
    const dbRequest = indexedDB.open("MyPalJsonDB", 1);

    dbRequest.onsuccess = function(event) {
        const db = event.target.result;
        const transaction = db.transaction("apiCalls", "readwrite");
        const store = transaction.objectStore("apiCalls");

        // Get the specific record and update its name
        const getRequest = store.get(id);
        getRequest.onsuccess = function() {
            const apiCall = getRequest.result;
            apiCall.name = newName;
            store.put(apiCall); // Save updated record back to IndexedDB
        };

        transaction.oncomplete = function() {
            console.log("Name updated successfully!");
        };

        transaction.onerror = function() {
            console.error("Error updating name.");
        };
    };

    dbRequest.onerror = function() {
        console.error("Could not open database.");
    };
}

function updateOrderInDatabase() {
    const items = Array.from(historyList.children); // Get all items in the new order
    console.log(items);

    const dbRequest = indexedDB.open("MyPalJsonDB", 1);

    dbRequest.onsuccess = function(event) {
        const db = event.target.result;
        const transaction = db.transaction("apiCalls", "readwrite");
        const store = transaction.objectStore("apiCalls");

        items.forEach((item, index) => {
            const id = item.dataset.id;
            console.log("id: " + id );
            console.log("index: " + index);
            const order = index; // New order based on position in the DOM
            console.log("order: " + order);

            // Retrieve the item and update its order
            const request = store.get(id);
            request.onsuccess = function(event) {
                const apiCall = event.target.result;
                apiCall.order = order; // Update the order property
                store.put(apiCall); // Save updated item
            };
        });
    };

    dbRequest.onerror = () => console.error("Could not open database.");
}



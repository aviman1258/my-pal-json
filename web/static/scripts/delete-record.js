document.addEventListener("DOMContentLoaded", () => {
    const historyList = document.getElementById("historyList");
    const deleteConfirmDialog = document.getElementById("deleteConfirmDialog");
    let recordIdToDelete = null;

    // Event delegation for delete buttons
    historyList.addEventListener("click", (event) => {
        if (event.target.classList.contains("delete-icon")) {
            recordIdToDelete = event.target.closest(".delete-button").dataset.id;

            // Show custom confirmation dialog
            deleteConfirmDialog.style.display = "block";
        }
    });

    // Handle confirm delete button
    document.getElementById("confirmDeleteBtn").addEventListener("click", async () => {
        if (recordIdToDelete !== null) {
            const db = await openDatabase();
            const transaction = db.transaction("apiCalls", "readwrite");
            const store = transaction.objectStore("apiCalls");
            const deleteRequest = store.delete(Number(recordIdToDelete));

            deleteRequest.onsuccess = () => {
                const itemToRemove = document.querySelector(`.history-item[data-id="${recordIdToDelete}"]`);
                loadApiCallHistory(db);
                recordIdToDelete = null;
            };
            deleteRequest.onerror = () => {
                recordIdToDelete = null;
            };
            
            // Hide dialog and reset recordId
            deleteConfirmDialog.style.display = "none";            
        }
    });

    // Handle cancel delete button
    document.getElementById("cancelDeleteBtn").addEventListener("click", () => {
        deleteConfirmDialog.style.display = "none";
        recordIdToDelete = null;
    });
});

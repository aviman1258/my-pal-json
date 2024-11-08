import { saveApiCall } from './save-call.js';
import { getHeaders } from './save-call.js';

document.addEventListener("DOMContentLoaded", () => {
    const saveModal = document.getElementById("saveNameModal");
    const confirmSaveBtn = document.getElementById("confirmSaveBtn");
    const cancelSaveBtn = document.getElementById("cancelSaveBtn");

    // Open save modal
    window.openSaveModal = () => {
        saveModal.style.display = "block";
    };

    // Close save modal
    window.closeSaveModal = () => {
        saveModal.style.display = "none";
    };

    // Handle confirm save
    confirmSaveBtn.addEventListener("click", () => {
        const name = document.getElementById("apiCallName").value.trim();
        const apiUrl = document.getElementById("apiUrl").value;
        const method = document.getElementById("httpMethod").value;
        const body = document.getElementById("inputJson").value;
        const headers = getHeaders();

        saveApiCall(name, apiUrl, method, headers, body);
    });

    // Handle cancel button
    cancelSaveBtn.addEventListener("click", closeSaveModal);
});

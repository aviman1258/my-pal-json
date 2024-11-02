// database.js
const openDatabase = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("MyPalJsonDB", 1);

        request.onupgradeneeded = function(event) {
            const db = event.target.result;
            if (!db.objectStoreNames.contains("apiCalls")) {
                db.createObjectStore("apiCalls", { keyPath: "id", autoIncrement: true });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

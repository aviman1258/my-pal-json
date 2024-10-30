document.addEventListener("DOMContentLoaded", function() {
    const inputJson = document.getElementById("inputJson");

    // Prevent default drag behaviors for the document and the textarea
    ["dragenter", "dragover", "dragleave", "drop"].forEach(eventName => {
        inputJson.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    // Add event listeners for drag-and-drop functionality
    inputJson.addEventListener("dragover", highlight, false);
    inputJson.addEventListener("dragleave", unhighlight, false);
    inputJson.addEventListener("drop", handleDrop, false);

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    function highlight() {
        inputJson.classList.add("highlight");
    }

    function unhighlight() {
        inputJson.classList.remove("highlight");
    }

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;

        if (files.length && (files[0].type === "application/json" || files[0].type === "text/plain")) {
            const file = files[0];
            const reader = new FileReader();
            reader.onload = function(event) {
                inputJson.value = event.target.result; // Insert file content into the textarea
                unhighlight(); // Remove the highlight styling
            };
            reader.readAsText(file);
        } else {
            alert("Please drop a valid text or JSON file.");
            unhighlight(); // Ensure highlight is removed if the file type is invalid
        }
    }
});

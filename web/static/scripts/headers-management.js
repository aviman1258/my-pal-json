document.addEventListener("DOMContentLoaded", function() {
    const headersGrid = document.getElementById('headersGrid');

    // Function to create a new header row
    function createHeaderRow(key = '', value = '') {
        console.log(key, value);

        // Create header key input
        const headerKeyDiv = document.createElement('div');
        const headerKeyInput = document.createElement('input');
        headerKeyInput.type = 'text';
        headerKeyInput.classList.add('header-key-input');
        headerKeyInput.placeholder = 'Key'; // Placeholder for new row
        headerKeyInput.value = key;

        // Create header value input
        const headerValueInput = document.createElement('input');
        headerValueInput.type = 'text';
        headerValueInput.classList.add('header-value');
        if (key === 'Authorization')
            headerValueInput.placeholder = 'Bearer Token'; // Placeholder for new row
        else
            headerValueInput.placeholder = 'Value'; // Placeholder for new row
        headerValueInput.value = value;

        // Append the inputs to the grid
        headersGrid.appendChild(headerKeyDiv);
        headerKeyDiv.appendChild(headerKeyInput);
        headersGrid.appendChild(headerValueInput);

        // Attach input listeners to handle dynamic row addition and deletion
        addInputListeners(headerKeyInput, headerValueInput);
    }

    // Function to handle adding/removing rows dynamically
    function addInputListeners(keyInput, valueInput) {
        function checkRowStatus() {
            const isLastRow = isLastRowInGrid(keyInput);

            if (isLastRow && (keyInput.value.trim() !== '' || valueInput.value.trim() !== '')) {
                // If the user starts typing in the last row, create a new empty row
                createHeaderRow();
            }

            // If both key and value are empty, remove the row (except the last row)
            if (isEmptyRow(keyInput, valueInput) && !isLastRowInGrid(keyInput)) {
                keyInput.parentElement.remove();
                valueInput.remove();
            }
        }

        keyInput.addEventListener('input', checkRowStatus);
        valueInput.addEventListener('input', checkRowStatus);
    }

    // Function to check if the current row is empty
    function isEmptyRow(keyInput, valueInput) {
        return keyInput.value.trim() === '' && valueInput.value.trim() === '';
    }

    // Function to check if the row is the last one in the grid
    function isLastRowInGrid(inputElement) {
        const rows = document.querySelectorAll('.header-key-input');
        const lastKeyInput = rows[rows.length - 1];
        return inputElement === lastKeyInput;
    }

    // Prepopulate default rows
    const defaultHeaders = [
        { key: 'Content-Type', value: 'application/json' },
        { key: 'Authorization', value: '' },
        { key: 'Accept', value: '*/*' }
    ];

    // Create default headers
    defaultHeaders.forEach(header => createHeaderRow(header.key, header.value));

    // Initialize with one empty row at the bottom
    createHeaderRow(); // This row will have placeholders "Key" and "Value"
});

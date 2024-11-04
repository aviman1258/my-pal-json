// Function to create a new header row with a checkbox, key, and value
export function createHeaderRow(key = '', value = '', isAuth = false) {
    const headersGrid = document.getElementById('headersGrid');

    // Create checkbox for Auth
    const headerAuthDiv = document.createElement('div');
    const headerAuthCheckbox = document.createElement('input');
    headerAuthCheckbox.type = 'checkbox';
    headerAuthCheckbox.classList.add('auth-checkbox');
    headerAuthCheckbox.checked = isAuth;

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
    headerValueInput.placeholder = key === 'Authorization' ? 'Bearer Token' : 'Value';
    headerValueInput.value = value;

    // Append the elements to the grid
    headerAuthDiv.appendChild(headerAuthCheckbox);
    headersGrid.appendChild(headerAuthDiv);
    headerKeyDiv.appendChild(headerKeyInput);
    headersGrid.appendChild(headerKeyDiv);
    headersGrid.appendChild(headerValueInput);

    // Attach input listeners to handle dynamic row addition and deletion
    addInputListeners(headerAuthCheckbox, headerKeyInput, headerValueInput);
}

// Function to handle adding/removing rows dynamically
export function addInputListeners(authCheckbox, keyInput, valueInput) {
    function checkRowStatus() {
        const isLastRow = isLastRowInGrid(keyInput);

        if (isLastRow && (keyInput.value.trim() !== '' || valueInput.value.trim() !== '')) {
            // If the user starts typing in the last row, create a new empty row
            createHeaderRow();
        }

        // If both key and value are empty, remove the row (except the last row)
        if (isEmptyRow(keyInput, valueInput) && !isLastRowInGrid(keyInput)) {
            authCheckbox.parentElement.remove();
            keyInput.parentElement.remove();
            valueInput.remove();
        }
    }

    keyInput.addEventListener('input', checkRowStatus);
    valueInput.addEventListener('input', checkRowStatus);
}

// Function to check if the current row is empty
export function isEmptyRow(keyInput, valueInput) {
    return keyInput.value.trim() === '' && valueInput.value.trim() === '';
}

// Function to check if the row is the last one in the grid
export function isLastRowInGrid(inputElement) {
    const rows = document.querySelectorAll('.header-key-input');
    const lastKeyInput = rows[rows.length - 1];
    return inputElement === lastKeyInput;
}

// Initialize header rows on DOMContentLoaded
document.addEventListener("DOMContentLoaded", function() {
    const defaultHeaders = [
        { key: 'Content-Type', value: 'application/json', isAuth: false },
        { key: 'Authorization', value: '', isAuth: true },
        { key: 'Accept', value: '*/*', isAuth: false }
    ];

    // Create default headers with checkboxes
    defaultHeaders.forEach(header => createHeaderRow(header.key, header.value, header.isAuth));

    // Initialize with one empty row at the bottom
    createHeaderRow(); // This row will have placeholders "Key" and "Value"
});

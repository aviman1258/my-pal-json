// Header grid: rows of [auth checkbox | key | value]. The grid auto-adds an empty
// trailing row while you type and removes rows that become empty.
// Every function takes the grid element so the same code serves the main form
// and each chain step card.

export function createHeaderRow(key = '', value = '', isAuth = false, gridEl = document.getElementById('headersGrid')) {
    const authDiv = document.createElement('div');
    const authCheckbox = document.createElement('input');
    authCheckbox.type = 'checkbox';
    authCheckbox.classList.add('auth-checkbox');
    authCheckbox.title = 'Auth header: sent as "Bearer <value>" and never written to the repo as a literal';
    authCheckbox.checked = isAuth;

    const keyDiv = document.createElement('div');
    const keyInput = document.createElement('input');
    keyInput.type = 'text';
    keyInput.classList.add('header-key-input');
    keyInput.placeholder = 'Key';
    keyInput.value = key;

    const valueInput = document.createElement('input');
    valueInput.type = 'text';
    valueInput.classList.add('header-value');
    valueInput.placeholder = key === 'Authorization' ? 'Bearer Token' : 'Value';
    valueInput.value = value;

    authDiv.appendChild(authCheckbox);
    keyDiv.appendChild(keyInput);
    gridEl.appendChild(authDiv);
    gridEl.appendChild(keyDiv);
    gridEl.appendChild(valueInput);

    addInputListeners(authCheckbox, keyInput, valueInput, gridEl);
    return { authCheckbox, keyInput, valueInput };
}

export function addInputListeners(authCheckbox, keyInput, valueInput, gridEl) {
    function checkRowStatus() {
        if (isLastRowInGrid(keyInput, gridEl) && (keyInput.value.trim() !== '' || valueInput.value.trim() !== '')) {
            createHeaderRow('', '', false, gridEl);
        }
        if (isEmptyRow(keyInput, valueInput) && !isLastRowInGrid(keyInput, gridEl)) {
            authCheckbox.parentElement.remove();
            keyInput.parentElement.remove();
            valueInput.remove();
            gridEl.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }
    keyInput.addEventListener('input', checkRowStatus);
    valueInput.addEventListener('input', checkRowStatus);
}

export function isEmptyRow(keyInput, valueInput) {
    return keyInput.value.trim() === '' && valueInput.value.trim() === '';
}

export function isLastRowInGrid(inputElement, gridEl = document.getElementById('headersGrid')) {
    const rows = gridEl.querySelectorAll('.header-key-input');
    return inputElement === rows[rows.length - 1];
}

// Read the grid as [{ name, value, isAuth }], skipping rows with an empty key.
export function readHeaders(gridEl = document.getElementById('headersGrid')) {
    const headers = [];
    const cells = gridEl.children;
    for (let i = 0; i + 2 < cells.length; i += 3) {
        const isAuth = cells[i].querySelector('.auth-checkbox').checked;
        const name = cells[i + 1].querySelector('.header-key-input').value.trim();
        const value = cells[i + 2].value.trim();
        if (name !== '') headers.push({ name, value, isAuth });
    }
    return headers;
}

// Replace the grid contents with the given headers plus one empty trailing row.
export function setHeaders(headers, gridEl = document.getElementById('headersGrid')) {
    gridEl.innerHTML = '';
    (headers || []).forEach(h => createHeaderRow(h.name, h.value, !!h.isAuth, gridEl));
    createHeaderRow('', '', false, gridEl);
}

export const DEFAULT_HEADERS = [
    { name: 'Content-Type', value: 'application/json', isAuth: false },
    { name: 'Authorization', value: '', isAuth: true },
    { name: 'Accept', value: '*/*', isAuth: false }
];

document.addEventListener("DOMContentLoaded", function () {
    setHeaders(DEFAULT_HEADERS);
});

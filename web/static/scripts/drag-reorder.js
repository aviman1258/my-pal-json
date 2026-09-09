// Reusable drag-to-reorder for a vertical list. Salvaged from the old history modal.
//
//   makeSortable(listEl, {
//       itemSelector: '.chain-step',          // direct children that can be dragged
//       handleSelector: '.chain-drag-handle', // optional: only start a drag from here
//       onReorder: (orderedIds) => {}         // called with data-id of items in new order
//   });
export function makeSortable(listEl, { itemSelector, handleSelector = null, onReorder }) {
    let dragged = null;
    let scrollTimer = null;
    let armed = !handleSelector; // without a handle every item is always draggable

    function items() {
        return Array.from(listEl.querySelectorAll(itemSelector));
    }

    function clearIndicators() {
        items().forEach(el => el.classList.remove("drop-indicator"));
    }

    function stopScroll() {
        if (scrollTimer) { clearInterval(scrollTimer); scrollTimer = null; }
    }

    function startScroll(direction) {
        stopScroll();
        scrollTimer = setInterval(() => { listEl.scrollTop += direction * 10; }, 20);
    }

    // Arm dragging only when the pointer went down on the handle.
    if (handleSelector) {
        listEl.addEventListener("pointerdown", e => { armed = !!e.target.closest(handleSelector); });
    }

    listEl.addEventListener("dragstart", e => {
        const item = e.target.closest(itemSelector);
        if (!item || !armed) { e.preventDefault(); return; }
        dragged = item;
        e.dataTransfer.effectAllowed = "move";
        item.classList.add("dragging");
    });

    listEl.addEventListener("dragover", e => {
        const item = e.target.closest(itemSelector);
        if (!dragged || !item) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        clearIndicators();
        if (item !== dragged) item.classList.add("drop-indicator");

        const rect = listEl.getBoundingClientRect();
        const edge = 24;
        if (e.clientY < rect.top + edge) startScroll(-1);
        else if (e.clientY > rect.bottom - edge) startScroll(1);
        else stopScroll();
    });

    listEl.addEventListener("drop", e => {
        const target = e.target.closest(itemSelector);
        if (!dragged || !target) return;
        e.preventDefault();
        stopScroll();
        clearIndicators();
        if (target !== dragged) {
            listEl.insertBefore(dragged, target.nextSibling);
            if (onReorder) onReorder(items().map(el => el.dataset.id));
        }
    });

    listEl.addEventListener("dragend", () => {
        if (dragged) dragged.classList.remove("dragging");
        dragged = null;
        if (handleSelector) armed = false;
        stopScroll();
        clearIndicators();
    });
}

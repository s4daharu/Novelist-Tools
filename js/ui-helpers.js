// js/ui-helpers.js

export function toggleMenu() {
    document.getElementById('sidebar').classList.toggle('open');
}

export function switchApp(app) {
    document.getElementById('splitterApp').style.display = app === 'splitter' ? 'block' : 'none';
    document.getElementById('backupApp').style.display = app === 'backup' ? 'block' : 'none';
    document.getElementById('zipToEpubApp').style.display = app === 'zipToEpub' ? 'block' : 'none'; // NEW

    let titleText = 'Novelist Tools';
    if (app === 'splitter') titleText = 'EPUB Chapter Splitter';
    else if (app === 'backup') titleText = 'Novel Backup File Utility';
    else if (app === 'zipToEpub') titleText = 'ZIP to EPUB Converter'; // NEW

    document.getElementById('appTitle').textContent = titleText;
    toggleMenu();
}

// Toast specific to the main page structure
const toastEl = document.getElementById('toast');
export function showToast(msg, isError = false) {
    if (!toastEl) {
        console.error("Toast element not found");
        return;
    }
    toastEl.textContent = msg;
    toastEl.className = 'status-toast ' + (isError ? 'toast-error' : 'toast-success');
    toastEl.style.opacity = '1';
    setTimeout(() => { toastEl.style.opacity = '0'; }, 3000);
}

// Spinner specific to backup - might move later or generalize
// For now, let's keep it here as a general UI helper if we make it more generic
// Or, it can be moved to backup-utility.js if it's only for backup.
// Let's assume it's a general spinner toggler for now and pass the element.
export function toggleSpinner(spinnerElement, show) {
    if (!spinnerElement) {
        console.error("Spinner element not provided");
        return;
    }
    spinnerElement.style.display = show ? 'block' : 'none';
}
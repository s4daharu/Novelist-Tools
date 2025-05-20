// js/ui-helpers.js

const toastEl = document.getElementById('toast'); // Define toastEl at the module level

export function toggleMenu() {
    document.getElementById('sidebar').classList.toggle('open');
}

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

export function toggleSpinner(spinnerElement, show) {
    if (!spinnerElement) {
        // console.warn("Spinner element not provided for toggleSpinner"); // Less intrusive warning
        return;
    }
    spinnerElement.style.display = show ? 'block' : 'none';
}


// Function to show the dashboard and hide all tools
export function showDashboard() {
    const dashboardAppEl = document.getElementById('dashboardApp');
    const splitterAppEl = document.getElementById('splitterApp');
    const backupAppEl = document.getElementById('backupApp');
    const zipToEpubAppEl = document.getElementById('zipToEpubApp');
    const epubToZipAppEl = document.getElementById('epubToZipApp');
    const appTitleEl = document.getElementById('appTitle');
    const sidebarEl = document.getElementById('sidebar');

    if (dashboardAppEl) dashboardAppEl.style.display = 'block';
    if (splitterAppEl) splitterAppEl.style.display = 'none';
    if (backupAppEl) backupAppEl.style.display = 'none';
    if (zipToEpubAppEl) zipToEpubAppEl.style.display = 'none';
    if (epubToZipAppEl) epubToZipAppEl.style.display = 'none';

    if (appTitleEl) appTitleEl.textContent = 'Novelist Tools';

    if (sidebarEl && sidebarEl.classList.contains('open')) {
        toggleMenu(); // Close sidebar if open
    }
}

// This function will now be the main way to activate a tool
export function launchAppFromCard(appId) {
    const dashboardAppEl = document.getElementById('dashboardApp');
    const appTitleEl = document.getElementById('appTitle');
    const sidebarEl = document.getElementById('sidebar');

    if (dashboardAppEl) dashboardAppEl.style.display = 'none'; // Hide dashboard

    const toolSectionsMap = {
        'splitter': { elementId: 'splitterApp', title: 'EPUB Chapter Splitter' },
        'backup': { elementId: 'backupApp', title: 'Novel Backup File Utility' },
        'zipToEpub': { elementId: 'zipToEpubApp', title: 'ZIP to EPUB Converter' },
        'epubToZip': { elementId: 'epubToZipApp', title: 'EPUB to ZIP (TXT)' }
    };

    let currentTitle = 'Novelist Tools'; // Fallback title

    for (const id in toolSectionsMap) {
        const toolInfo = toolSectionsMap[id];
        const appElement = document.getElementById(toolInfo.elementId);
        if (appElement) {
            if (id === appId) {
                appElement.style.display = 'block';
                currentTitle = toolInfo.title;
            } else {
                appElement.style.display = 'none';
            }
        }
    }

    if (appTitleEl) appTitleEl.textContent = currentTitle;

    if (sidebarEl && sidebarEl.classList.contains('open')) {
        toggleMenu(); // Close sidebar if open when launching an app
    }
}
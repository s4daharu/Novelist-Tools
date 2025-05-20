// js/ui-helpers.js

const toastEl = document.getElementById('toast');

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
        return;
    }
    spinnerElement.style.display = show ? 'block' : 'none';
}

const toolSectionsMap = {
    'splitter': { elementId: 'splitterApp', title: 'EPUB Chapter Splitter' },
    'backup': { elementId: 'backupApp', title: 'Novel Backup File Utility' },
    'zipToEpub': { elementId: 'zipToEpubApp', title: 'ZIP to EPUB Converter' },
    'epubToZip': { elementId: 'epubToZipApp', title: 'EPUB to ZIP (TXT)' }
};

// Function to show the dashboard and hide all tools
export function showDashboard(isInitialLoad = false) {
    const dashboardAppEl = document.getElementById('dashboardApp');
    const appTitleEl = document.getElementById('appTitle');
    const sidebarEl = document.getElementById('sidebar');

    if (dashboardAppEl) dashboardAppEl.style.display = 'block';

    for (const id in toolSectionsMap) {
        const toolInfo = toolSectionsMap[id];
        const appElement = document.getElementById(toolInfo.elementId);
        if (appElement) appElement.style.display = 'none';
    }

    if (appTitleEl) appTitleEl.textContent = 'Novelist Tools';

    if (sidebarEl && sidebarEl.classList.contains('open')) {
        toggleMenu();
    }

    // For history management:
    // If it's the initial load or navigating back to dashboard, replace state.
    // This prevents adding multiple dashboard entries to history if user clicks "Home Dashboard" repeatedly.
    history.replaceState({ view: 'dashboard' }, 'Novelist Tools Dashboard', window.location.pathname + window.location.search);
    sessionStorage.removeItem('activeToolId'); // Clear active tool on showing dashboard
    console.log("State replaced: dashboard");
}

export function launchAppFromCard(appId, fromHistory = false) {
    const dashboardAppEl = document.getElementById('dashboardApp');
    const appTitleEl = document.getElementById('appTitle');
    const sidebarEl = document.getElementById('sidebar');

    if (dashboardAppEl) dashboardAppEl.style.display = 'none';

    let currentTitle = 'Novelist Tools';
    let toolLaunched = false;

    for (const id in toolSectionsMap) {
        const toolInfo = toolSectionsMap[id];
        const appElement = document.getElementById(toolInfo.elementId);
        if (appElement) {
            if (id === appId) {
                appElement.style.display = 'block';
                currentTitle = toolInfo.title;
                toolLaunched = true;
            } else {
                appElement.style.display = 'none';
            }
        }
    }

    if (!toolLaunched) { // If appId is invalid, show dashboard
        showDashboard();
        return;
    }

    if (appTitleEl) appTitleEl.textContent = currentTitle;

    if (sidebarEl && sidebarEl.classList.contains('open')) {
        toggleMenu();
    }

    // For history management:
    // Only push state if not being called from a popstate event (to avoid loops)
    // and if a valid tool was actually launched.
    if (!fromHistory && toolLaunched) {
        history.pushState({ view: 'tool', toolId: appId }, currentTitle, window.location.pathname + window.location.search);
        sessionStorage.setItem('activeToolId', appId); // Store active tool for refresh
        console.log("State pushed: tool -", appId);
    } else if (fromHistory && toolLaunched) {
        // If called from history, ensure sessionStorage is updated if not already
        sessionStorage.setItem('activeToolId', appId);
    }
}
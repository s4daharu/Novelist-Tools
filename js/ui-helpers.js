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

export function showDashboard() {
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

    history.replaceState({ view: 'dashboard' }, 'Novelist Tools Dashboard', window.location.pathname + window.location.search);
    sessionStorage.removeItem('activeToolId');
    console.log("UI: Switched to Dashboard view, history state replaced.");
}

/**
 * Displays a specific tool UI.
 * @param {string} appId - The ID of the tool.
 * @param {boolean} [manageHistory=true] - Whether this call should manage history.pushState.
 *                                        Set to false for initial rendering on refresh before history is set up.
 * @param {boolean} [fromPopState=false] - True if called from popstate to avoid re-pushing.
 */
function displayTool(appId) {
    const dashboardAppEl = document.getElementById('dashboardApp');
    const appTitleEl = document.getElementById('appTitle');
    const sidebarEl = document.getElementById('sidebar');

    if (dashboardAppEl) dashboardAppEl.style.display = 'none';

    let currentTitle = 'Novelist Tools';
    let toolDisplayed = false;

    for (const id in toolSectionsMap) {
        const toolInfo = toolSectionsMap[id];
        const appElement = document.getElementById(toolInfo.elementId);
        if (appElement) {
            if (id === appId) {
                appElement.style.display = 'block';
                currentTitle = toolInfo.title;
                toolDisplayed = true;
            } else {
                appElement.style.display = 'none';
            }
        }
    }
    if (appTitleEl) appTitleEl.textContent = currentTitle;

    if (sidebarEl && sidebarEl.classList.contains('open')) {
        toggleMenu();
    }
    return toolDisplayed;
}


export function launchAppFromCard(appId, fromPopState = false) {
    const toolDisplayed = displayTool(appId);

    if (!toolDisplayed) {
        console.warn(`Tool with ID '${appId}' not found or failed to launch. Showing dashboard.`);
        showDashboard(); // This will also handle history.replaceState for dashboard
        return;
    }

    // Manage browser history and session storage
    if (!fromPopState) {
        // If launched by user action (not back/forward), push a new state for the tool.
        const toolInfo = toolSectionsMap[appId];
        history.pushState({ view: 'tool', toolId: appId }, toolInfo.title, window.location.pathname + window.location.search);
        console.log(`UI: Launched tool '${appId}', history state pushed.`);
    }
    // Always update sessionStorage for refresh persistence when a tool is active
    sessionStorage.setItem('activeToolId', appId);
}
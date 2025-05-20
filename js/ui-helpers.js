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

// EXPORT toolSectionsMap
export const toolSectionsMap = {
    'splitter': { elementId: 'splitterApp', title: 'EPUB Chapter Splitter' },
    'backup': { elementId: 'backupApp', title: 'Novel Backup File Utility' },
    'zipToEpub': { elementId: 'zipToEpubApp', title: 'ZIP to EPUB Converter' },
    'epubToZip': { elementId: 'epubToZipApp', title: 'EPUB to ZIP (TXT)' }
};

/**
 * Displays a specific tool UI. (Internal helper)
 * @param {string} appId - The ID of the tool.
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


export function launchAppFromCard(appId, fromPopState = false) {
    const toolDisplayed = displayTool(appId); // displayTool now internal

    if (!toolDisplayed) {
        console.warn(`Tool with ID '${appId}' not found or failed to launch. Showing dashboard.`);
        showDashboard();
        return;
    }

    if (!fromPopState) {
        const toolInfo = toolSectionsMap[appId]; // toolSectionsMap is accessible here
        if(toolInfo) { // Check if toolInfo is found
            history.pushState({ view: 'tool', toolId: appId }, toolInfo.title, window.location.pathname + window.location.search);
            console.log(`UI: Launched tool '${appId}', history state pushed.`);
        } else {
            console.error(`Tool info not found for ${appId} during pushState.`); // Should not happen if displayTool succeeded
        }
    }
    sessionStorage.setItem('activeToolId', appId);
}
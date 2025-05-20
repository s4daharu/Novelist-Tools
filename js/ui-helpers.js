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
        return; // Silently return if no spinner element is provided
    }
    spinnerElement.style.display = show ? 'block' : 'none';
}

// Moved to module scope so both showDashboard and launchAppFromCard can use it
const toolSectionsMap = {
    'splitter': { elementId: 'splitterApp', title: 'EPUB Chapter Splitter' },
    'backup': { elementId: 'backupApp', title: 'Novel Backup File Utility' },
    'zipToEpub': { elementId: 'zipToEpubApp', title: 'ZIP to EPUB Converter' },
    'epubToZip': { elementId: 'epubToZipApp', title: 'EPUB to ZIP (TXT)' }
};

/**
 * Displays the main dashboard.
 * Always replaces the current history state to represent the dashboard.
 */
export function showDashboard() {
    const dashboardAppEl = document.getElementById('dashboardApp');
    const appTitleEl = document.getElementById('appTitle');
    const sidebarEl = document.getElementById('sidebar');

    if (dashboardAppEl) dashboardAppEl.style.display = 'block';

    // Hide all tool sections
    for (const id in toolSectionsMap) {
        const toolInfo = toolSectionsMap[id];
        const appElement = document.getElementById(toolInfo.elementId);
        if (appElement) appElement.style.display = 'none';
    }

    if (appTitleEl) appTitleEl.textContent = 'Novelist Tools';

    if (sidebarEl && sidebarEl.classList.contains('open')) {
        toggleMenu(); // Close sidebar if open
    }

    // Always replace the current history state to reflect that the dashboard is active.
    // This prevents building up a history of dashboard views and cleans the state.
    history.replaceState({ view: 'dashboard' }, 'Novelist Tools Dashboard', window.location.pathname + window.location.search);
    sessionStorage.removeItem('activeToolId'); // Clear any persisted active tool
    console.log("UI: Switched to Dashboard view, history state replaced.");
}

/**
 * Launches a specific tool.
 * @param {string} appId - The ID of the tool to launch (e.g., 'splitter').
 * @param {boolean} fromHistory - True if this function is called due to a popstate event (back/forward).
 */
export function launchAppFromCard(appId, fromHistory = false) {
    const dashboardAppEl = document.getElementById('dashboardApp');
    const appTitleEl = document.getElementById('appTitle');
    const sidebarEl = document.getElementById('sidebar');

    if (dashboardAppEl) dashboardAppEl.style.display = 'none'; // Hide dashboard

    let currentTitle = 'Novelist Tools'; // Default title
    let toolLaunchedSuccessfully = false;

    // Show the selected tool and hide others
    for (const id in toolSectionsMap) {
        const toolInfo = toolSectionsMap[id];
        const appElement = document.getElementById(toolInfo.elementId);
        if (appElement) {
            if (id === appId) {
                appElement.style.display = 'block';
                currentTitle = toolInfo.title;
                toolLaunchedSuccessfully = true;
            } else {
                appElement.style.display = 'none';
            }
        }
    }

    // If the appId was invalid or the element wasn't found, default to dashboard
    if (!toolLaunchedSuccessfully) {
        console.warn(`Tool with ID '${appId}' not found or failed to launch. Showing dashboard.`);
        showDashboard(); // This will also handle history.replaceState for dashboard
        return;
    }

    if (appTitleEl) appTitleEl.textContent = currentTitle;

    if (sidebarEl && sidebarEl.classList.contains('open')) {
        toggleMenu(); // Close sidebar if open
    }

    // Manage browser history
    if (toolLaunchedSuccessfully) {
        if (!fromHistory) {
            // If launched by user action (not back/forward), push a new state for the tool.
            history.pushState({ view: 'tool', toolId: appId }, currentTitle, window.location.pathname + window.location.search);
            console.log(`UI: Launched tool '${appId}', history state pushed.`);
        }
        // Always update sessionStorage for refresh persistence when a tool is active
        sessionStorage.setItem('activeToolId', appId);
    }
}
// js/main.js
import {
    toggleMenu,
    launchAppFromCard,
    showDashboard,
    showToast,
    toggleSpinner as displaySpinnerElement
} from './ui-helpers.js';
import { initializePWA } from './pwa-handler.js';
import { initializeEpubSplitter } from './epub-splitter.js';
import { initializeBackupUtility } from './backup-utility.js';
import { initializeZipToEpub } from './zip-to-epub.js';
import { initializeEpubToZip } from './epub-to-zip.js';

// Make functions globally available for HTML onclick attributes
window.toggleMenu = toggleMenu;
window.launchAppFromCard = launchAppFromCard; // User clicks directly call this
window.showDashboard = showDashboard;       // User clicks "Home Dashboard" call this

// Initialize PWA features
initializePWA();

// DOM Ready: Initialize tools and set up initial view
document.addEventListener('DOMContentLoaded', () => {
    // Get spinner elements for each tool
    const spinnerSplEl = document.getElementById('spinnerSplitter');
    const spinnerBackupEl = document.getElementById('spinnerBackup');
    const spinnerZipToEpubEl = document.getElementById('spinnerZipToEpub');
    const spinnerEpubToZipEl = document.getElementById('spinnerEpubToZip');

    // Initialize each tool module, passing helper functions
    initializeEpubSplitter(showToast, (show) => displaySpinnerElement(spinnerSplEl, show));
    initializeBackupUtility(showToast, (show) => displaySpinnerElement(spinnerBackupEl, show));
    initializeZipToEpub(showToast, (show) => displaySpinnerElement(spinnerZipToEpubEl, show));
    initializeEpubToZip(showToast, (show) => displaySpinnerElement(spinnerEpubToZipEl, show));

    // --- Browser History (Back/Forward Button) Handling ---
    window.addEventListener('popstate', (event) => {
        console.log("MAIN: Popstate event triggered. Current history state:", event.state);
        if (event.state) {
            // A state object exists, determine which view to show
            if (event.state.view === 'tool' && event.state.toolId) {
                // Navigate to the specific tool view
                console.log(`MAIN: Popstate - restoring tool view: ${event.state.toolId}`);
                launchAppFromCard(event.state.toolId, true); // true indicates it's from history navigation
            } else if (event.state.view === 'dashboard') {
                // Navigate to the dashboard view
                console.log("MAIN: Popstate - restoring dashboard view.");
                showDashboard();
            } else {
                // Unknown state, default to dashboard
                console.warn("MAIN: Popstate - unknown state, defaulting to dashboard.");
                showDashboard();
            }
        } else {
            // event.state is null. This can happen if:
            // 1. It's the initial page load (before any pushState/replaceState by our app).
            // 2. The user has navigated back past the states managed by our application.
            // In general, defaulting to the dashboard is a safe bet.
            console.log("MAIN: Popstate - event.state is null, showing dashboard.");
            showDashboard();
        }
    });

    // --- Initial Page Load / Refresh Logic ---
    const persistedToolId = sessionStorage.getItem('activeToolId');
    if (persistedToolId) {
        // User refreshed while a tool was active
        console.log(`MAIN: Page load/refresh - persisted tool ID found: '${persistedToolId}'. Restoring tool.`);

        // 1. CRITICAL: Establish the "dashboard" as the state *before* the tool in history.
        // This ensures that if the user presses "back" after this refresh, they go to the dashboard.
        // We use replaceState so it doesn't add a new entry if the current one is already dashboard (e.g. from a previous popstate to dashboard)
        history.replaceState({ view: 'dashboard' }, 'Novelist Tools Dashboard', window.location.pathname + window.location.search);
        console.log("MAIN: Page load/refresh - dashboard state REPLACED (to be behind the tool).");

        // 2. Now, launch the persisted tool. launchAppFromCard will PUSH the tool's state.
        // The history stack will now be [Dashboard State, Persisted Tool State]
        launchAppFromCard(persistedToolId, false); // false: it's not from a popstate, it's an initial setup
    } else {
        // No persisted tool (fresh load or user was on dashboard before refresh)
        console.log("MAIN: Page load/refresh - no persisted tool. Showing dashboard.");
        showDashboard(); // This will use replaceState to set the initial dashboard state.
    }
});
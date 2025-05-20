// js/main.js
import {
    toggleMenu,
    launchAppFromCard, // This is the primary function for user clicks
    showDashboard,
    showToast,
    toggleSpinner as displaySpinnerElement,
    // We need displayTool if we're calling it directly, but launchAppFromCard now uses it internally
} from './ui-helpers.js';
// Import displayTool if you intend to call it directly from main.js outside of launchAppFromCard
// For this specific refresh logic, we will call launchAppFromCard which handles display.

import { initializePWA } from './pwa-handler.js';
import { initializeEpubSplitter } from './epub-splitter.js';
import { initializeBackupUtility } from './backup-utility.js';
import { initializeZipToEpub } from './zip-to-epub.js';
import { initializeEpubToZip } from './epub-to-zip.js';

window.toggleMenu = toggleMenu;
window.launchAppFromCard = launchAppFromCard;
window.showDashboard = showDashboard;

initializePWA();

document.addEventListener('DOMContentLoaded', () => {
    const spinnerSplEl = document.getElementById('spinnerSplitter');
    const spinnerBackupEl = document.getElementById('spinnerBackup');
    const spinnerZipToEpubEl = document.getElementById('spinnerZipToEpub');
    const spinnerEpubToZipEl = document.getElementById('spinnerEpubToZip');

    initializeEpubSplitter(showToast, (show) => displaySpinnerElement(spinnerSplEl, show));
    initializeBackupUtility(showToast, (show) => displaySpinnerElement(spinnerBackupEl, show));
    initializeZipToEpub(showToast, (show) => displaySpinnerElement(spinnerZipToEpubEl, show));
    initializeEpubToZip(showToast, (show) => displaySpinnerElement(spinnerEpubToZipEl, show));

    window.addEventListener('popstate', (event) => {
        console.log("MAIN: Popstate event. State:", event.state);
        if (event.state) {
            if (event.state.view === 'tool' && event.state.toolId) {
                console.log(`MAIN: Popstate - restoring tool: ${event.state.toolId}`);
                launchAppFromCard(event.state.toolId, true); // true for fromPopState
            } else if (event.state.view === 'dashboard') {
                console.log("MAIN: Popstate - restoring dashboard.");
                showDashboard();
            } else {
                console.warn("MAIN: Popstate - unknown state, defaulting to dashboard.");
                showDashboard();
            }
        } else {
            // This case implies the user has gone "back" beyond the app's managed history.
            // Or it's the very initial state of a new tab before any replaceState.
            // If the app is meant to "take over" the history, this might lead to dashboard.
            // If the user *can* go back further (e.g. to google.com), then this means they've left our SPA's control.
            // For SPA back button, showing dashboard is safest if state is null.
            console.log("MAIN: Popstate - event.state is null. Showing dashboard (or app exit if browser allows).");
            // Check if we are at the very first entry in history. If so, "back" might exit.
            // This is hard to reliably detect across browsers just from popstate.
            // For now, consistently show dashboard.
            showDashboard();
        }
    });

    // --- Initial Page Load / Refresh Logic ---
    const persistedToolId = sessionStorage.getItem('activeToolId');
    if (persistedToolId) {
        console.log(`MAIN: Page load/refresh - Persisted tool ID: '${persistedToolId}'.`);

        // 1. Display the tool UI first without altering history yet.
        // We need a way to just show the tool. We'll use launchAppFromCard but tell it not to push history yet.
        // The internal displayTool function in ui-helpers helps here.
        // For simplicity, let launchAppFromCard handle the display logic, and we'll fix history after.

        // Call launchAppFromCard but indicate it's an initial setup *for display purposes*
        // and that history will be managed immediately after.
        // The `fromPopState = true` will prevent `launchAppFromCard` from pushing state.
        launchAppFromCard(persistedToolId, true); // Display tool, update sessionStorage, DO NOT PUSH HISTORY
        console.log(`MAIN: Page load/refresh - Tool '${persistedToolId}' UI displayed.`);

        // 2. Now, MANUALLY construct the history stack for this refreshed state.
        // The current page (showing the tool) should have the "dashboard" state as its predecessor.
        history.replaceState({ view: 'dashboard' }, 'Novelist Tools Dashboard', window.location.pathname + window.location.search);
        console.log("MAIN: Page load/refresh - History REPLACED with DUMMY dashboard state.");

        // 3. Push the actual tool state on top of the dummy dashboard state.
        // This makes the history: [..., dashboard, currentTool]
        const toolInfo = toolSectionsMap[persistedToolId] || { title: 'Loaded Tool' }; // Get title from map
        history.pushState({ view: 'tool', toolId: persistedToolId }, toolInfo.title, window.location.pathname + window.location.search);
        console.log(`MAIN: Page load/refresh - History PUSHED for tool '${persistedToolId}' on top of dashboard.`);

    } else {
        console.log("MAIN: Page load/refresh - No persisted tool. Showing dashboard.");
        showDashboard(); // This uses replaceState for the initial dashboard state.
    }
});
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

window.toggleMenu = toggleMenu;
window.launchAppFromCard = launchAppFromCard; // Direct call from HTML, will push state
window.showDashboard = () => showDashboard(); // Ensure it calls our version that manages state

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

    // Back button / Popstate handling
    window.addEventListener('popstate', (event) => {
        console.log("Popstate event:", event.state);
        if (event.state) {
            if (event.state.view === 'tool' && event.state.toolId) {
                // We are going "forward" or "back" to a tool view
                launchAppFromCard(event.state.toolId, true); // Pass fromHistory = true
            } else if (event.state.view === 'dashboard') {
                // We are going "back" to the dashboard view
                showDashboard();
            } else {
                // Fallback or unknown state, show dashboard
                showDashboard();
            }
        } else {
            // If event.state is null, it often means we've gone back past our initial replaceState
            // or to a state not managed by this session's PWA logic. Default to dashboard.
            showDashboard();
        }
    });

    // Initial view logic (handles refresh)
    const persistedToolId = sessionStorage.getItem('activeToolId');
    if (persistedToolId) {
        console.log("Persisted tool found on load:", persistedToolId);
        // When refreshing into a tool, we should also ensure its state is in history
        // So, we call launchAppFromCard normally, it will push state.
        // However, to avoid duplicate history on initial load if it's from a persisted state,
        // we might want to replaceState here instead of pushState inside launchAppFromCard
        // for this specific scenario. For simplicity now, launchAppFromCard will push state.
        // A more refined approach might involve `launchAppFromCard(persistedToolId, true)`
        // and then `history.replaceState({ view: 'tool', toolId: persistedToolId }, ...)`.
        launchAppFromCard(persistedToolId); // This will pushState and set sessionStorage again.
    } else {
        console.log("No persisted tool, showing dashboard.");
        showDashboard(true); // Pass true for initial load state replacement
    }
});
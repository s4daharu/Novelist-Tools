// js/main.js
import {
    toggleMenu,
    launchAppFromCard,
    showDashboard,
    showToast,
    toggleSpinner as displaySpinnerElement,
    toolSectionsMap // IMPORT toolSectionsMap
} from './ui-helpers.js';
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
    const spinnerZipToEpubEl = document.getElementById('zipToEpub');
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
            console.log("MAIN: Popstate - event.state is null. Showing dashboard (or app exit if browser allows).");
            showDashboard();
        }
    });

    // --- Initial Page Load / Refresh Logic ---
    const persistedToolId = sessionStorage.getItem('activeToolId');
    if (persistedToolId) {
        console.log(`MAIN: Page load/refresh - Persisted tool ID: '${persistedToolId}'.`);

        // Display tool UI first, without it pushing to history.
        // launchAppFromCard with fromPopState=true will achieve this and set sessionStorage.
        launchAppFromCard(persistedToolId, true);
        console.log(`MAIN: Page load/refresh - Tool '${persistedToolId}' UI displayed.`);

        // Manually construct the history: [Dashboard, CurrentTool]
        history.replaceState({ view: 'dashboard' }, 'Novelist Tools Dashboard', window.location.pathname + window.location.search);
        console.log("MAIN: Page load/refresh - History REPLACED with DUMMY dashboard state.");

        // Get title from the imported toolSectionsMap
        const toolInfo = toolSectionsMap[persistedToolId] || { title: persistedToolId }; // Fallback if ID not in map
        history.pushState({ view: 'tool', toolId: persistedToolId }, toolInfo.title, window.location.pathname + window.location.search);
        console.log(`MAIN: Page load/refresh - History PUSHED for tool '${persistedToolId}' on top of dashboard.`);

    } else {
        console.log("MAIN: Page load/refresh - No persisted tool. Showing dashboard.");
        showDashboard(); // This uses replaceState for the initial dashboard state.
    }
});
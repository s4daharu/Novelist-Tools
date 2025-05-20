// js/main.js
import {
    toggleMenu,
    launchAppFromCard,
    showDashboard,
    showToast, // Import showToast
    toggleSpinner as displaySpinnerElement // Import and alias toggleSpinner
} from './ui-helpers.js';
import { initializePWA } from './pwa-handler.js';
import { initializeEpubSplitter } from './epub-splitter.js';
import { initializeBackupUtility } from './backup-utility.js';
import { initializeZipToEpub } from './zip-to-epub.js';
import { initializeEpubToZip } from './epub-to-zip.js';

// Make functions available globally for onclick attributes in HTML
window.toggleMenu = toggleMenu;
window.launchAppFromCard = launchAppFromCard;
window.showDashboard = showDashboard;

// Initialize PWA handling
initializePWA();

// Initialize all tools after the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // Get spinner elements
    const spinnerSplEl = document.getElementById('spinnerSplitter');
    const spinnerBackupEl = document.getElementById('spinnerBackup');
    const spinnerZipToEpubEl = document.getElementById('spinnerZipToEpub');
    const spinnerEpubToZipEl = document.getElementById('spinnerEpubToZip');

    // Pass the imported showToast and displaySpinnerElement to each utility initializer
    initializeEpubSplitter(showToast, (show) => displaySpinnerElement(spinnerSplEl, show));
    initializeBackupUtility(showToast, (show) => displaySpinnerElement(spinnerBackupEl, show));
    initializeZipToEpub(showToast, (show) => displaySpinnerElement(spinnerZipToEpubEl, show));
    initializeEpubToZip(showToast, (show) => displaySpinnerElement(spinnerEpubToZipEl, show));

    // Show the dashboard by default when the page loads
    showDashboard();
});
// js/main.js
import { toggleMenu, switchApp, showToast as displayToast, toggleSpinner as displaySpinnerElement } from './ui-helpers.js';
import { initializePWA } from './pwa-handler.js';
import { initializeEpubSplitter } from './epub-splitter.js';
import { initializeBackupUtility } from './backup-utility.js';
import { initializeZipToEpub } from './zip-to-epub.js'; // NEW IMPORT

window.toggleMenu = toggleMenu;
window.switchApp = switchApp;

initializePWA();

document.addEventListener('DOMContentLoaded', () => {
    const spinnerSplEl = document.getElementById('spinnerSplitter');
    const spinnerBackupEl = document.getElementById('spinnerBackup');
    const spinnerZipToEpubEl = document.getElementById('spinnerZipToEpub'); // NEW

    initializeEpubSplitter(displayToast, (show) => displaySpinnerElement(spinnerSplEl, show));
    initializeBackupUtility(displayToast, (show) => displaySpinnerElement(spinnerBackupEl, show));
    initializeZipToEpub(displayToast, (show) => displaySpinnerElement(spinnerZipToEpubEl, show)); // NEW
});
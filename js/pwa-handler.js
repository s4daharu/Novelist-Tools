// js/pwa-handler.js

export function initializePWA() {
    let deferredPrompt;
    const installBtn = document.getElementById('installBtn');

    if (!installBtn) {
        console.warn("Install button not found for PWA prompt.");
        // return; // Or let it continue for service worker registration
    } else {
        window.addEventListener('beforeinstallprompt', e => {
            e.preventDefault();
            deferredPrompt = e;
            installBtn.style.display = 'block';
        });

        installBtn.addEventListener('click', async () => {
            installBtn.style.display = 'none';
            if (deferredPrompt) {
                deferredPrompt.prompt();
                // Wait for the user to respond to the prompt
                const { outcome } = await deferredPrompt.userChoice;
                console.log(`User response to the install prompt: ${outcome}`);
                deferredPrompt = null;
            }
        });
    }


    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./service-worker.js') // Ensure path is correct from root
                .then(reg => console.log('SW registered, scope:', reg.scope))
                .catch(err => console.error('SW registration failed:', err));
        });
    } else {
        console.log('Service Worker not supported in this browser.');
    }
}
/**
 * EEPROM Humas Management System - PWA Setup
 */

let deferredPrompt;

export function initPWA() {
  // 1. Register Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js')
        .then((registration) => {
          console.log('[PWA] Service Worker registered with scope:', registration.scope);
          
          // Check for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                showUpdatePopup(newWorker);
              }
            });
          });
        })
        .catch((error) => {
          console.error('[PWA] Service Worker registration failed:', error);
        });
    });
  }

  // 2. Handle Install Prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent Chrome 67 and earlier from automatically showing the prompt
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;
    // Show the install button
    showInstallButton();
  });

  window.addEventListener('appinstalled', (evt) => {
    console.log('[PWA] App installed successfully');
    hideInstallButton();
  });
}

function showInstallButton() {
  // Check if button already exists
  if (document.getElementById('pwa-install-btn')) return;

  const btn = document.createElement('button');
  btn.id = 'pwa-install-btn';
  btn.className = 'btn btn-primary';
  btn.innerHTML = '<i data-lucide="download"></i> Install App';
  
  // Style the button to float nicely
  Object.assign(btn.style, {
    position: 'fixed',
    bottom: '20px',
    left: '20px',
    zIndex: '1000',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
  });

  btn.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`[PWA] User response to the install prompt: ${outcome}`);
      deferredPrompt = null;
      hideInstallButton();
    }
  });

  document.body.appendChild(btn);
  if (window.lucide) lucide.createIcons({ nodes: [btn] });
}

function hideInstallButton() {
  const btn = document.getElementById('pwa-install-btn');
  if (btn) btn.remove();
}

function showUpdatePopup(worker) {
  // Check if popup exists
  if (document.getElementById('pwa-update-popup')) return;

  const popup = document.createElement('div');
  popup.id = 'pwa-update-popup';
  
  Object.assign(popup.style, {
    position: 'fixed',
    bottom: '80px',
    left: '20px',
    backgroundColor: 'var(--card)',
    color: 'var(--text)',
    padding: '16px',
    borderRadius: '8px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    zIndex: '1000',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    border: '1px solid var(--border-light)'
  });

  popup.innerHTML = `
    <div style="font-weight: 600; display: flex; align-items: center; gap: 8px;">
      <i data-lucide="refresh-cw" style="color: var(--primary)"></i> Versi baru tersedia
    </div>
    <div style="display: flex; gap: 8px;">
      <button id="pwa-update-now" class="btn btn-primary btn-sm">Update Sekarang</button>
      <button id="pwa-update-later" class="btn btn-ghost btn-sm">Nanti</button>
    </div>
  `;

  document.body.appendChild(popup);
  if (window.lucide) lucide.createIcons({ nodes: [popup] });

  document.getElementById('pwa-update-now').addEventListener('click', () => {
    worker.postMessage({ action: 'skipWaiting' });
    window.location.reload();
  });

  document.getElementById('pwa-update-later').addEventListener('click', () => {
    popup.remove();
  });
}

// Request notification permission structure
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.log('[PWA] This browser does not support notifications.');
    return;
  }
  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    console.log('[PWA] Notification permission granted.');
    // Future integration with Firebase/OneSignal goes here
  }
}

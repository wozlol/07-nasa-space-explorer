// PWA features: service worker, offline banner, install prompt and notifications.
// This file only adds the app features. The gallery itself lives in script.js.

const offlineBanner = document.getElementById('offlineBanner');
const installBanner = document.getElementById('installBanner');
const installText = document.getElementById('installText');
const installButton = document.getElementById('installBtn');
const installDismiss = document.getElementById('installDismiss');
const footerInstall = document.getElementById('footerInstall');
const footerInstallText = document.getElementById('footerInstallText');
const footerInstallButton = document.getElementById('footerInstallBtn');
const notifyButton = document.getElementById('notifyBtn');
const notifyStatus = document.getElementById('notifyStatus');

// ----- 1. Register the service worker -----
// The service worker (sw.js) saves the app files and NASA's answers so the app works offline.
if ('serviceWorker' in navigator) {
  // Wait for the page to finish loading so the first visit is not slowed down
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .catch((error) => console.error('Service worker could not start:', error));
  });
}

// ----- 2. Offline indicator -----
// Show a bar at the top of the screen while the device has no internet
function updateOnlineStatus() {
  offlineBanner.hidden = navigator.onLine;
}

window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus(); // check once right away, in case the page opened offline

// ----- 3. Custom install prompt -----
// Browsers can show their own install button. We hold that back and show our own banner instead.
let installEvent = null;

// True when the app is already running from the home screen (no browser around it)
function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

// iPhones and iPads never send the install event, so we show steps for them instead
function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// Remember that the person said "Not Now", so we do not nag them on every visit.
// Saving can fail in private tabs, so every use is wrapped in try and catch.
const DISMISS_KEY = 'installPromptDismissed';

function wasDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === 'yes';
  } catch (error) {
    return false;
  }
}

function rememberDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, 'yes');
  } catch (error) {
    // Nothing to do. The banner just shows again next visit.
  }
}

function hideInstallBanner() {
  installBanner.hidden = true;
}

// The footer note is the quiet version of the banner. It sits at the bottom of the page and
// does not float, so it stays there even after the floating banner is dismissed.
function showFooterInstall(text, canInstallNow) {
  if (isStandalone()) {
    return; // already installed, nothing to offer
  }
  footerInstallText.textContent = text;
  footerInstallButton.hidden = !canInstallNow;
  footerInstall.hidden = false;
}

// Chrome and Edge on Android and computers send this when the app can be installed
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault(); // stops the browser's own prompt
  installEvent = event; // keep it so our buttons can open the prompt later

  if (isStandalone()) {
    return;
  }

  showFooterInstall('Install Space Explorer on your device for quick access, even offline.', true);

  if (!wasDismissed()) {
    installText.textContent = 'Install Space Explorer on your device for quick access, even offline.';
    installButton.hidden = false;
    installBanner.hidden = false;
  }
});

// Both Install buttons (the banner and the footer) do the same thing
async function startInstall() {
  if (!installEvent) {
    return;
  }

  installEvent.prompt(); // opens the real install window
  const choice = await installEvent.userChoice;
  console.log(`Install choice: ${choice.outcome}`);

  installEvent = null; // each event can only be used once
  hideInstallBanner();

  if (choice.outcome !== 'accepted') {
    // The browser will not open the window again right away, so point to its own menu
    showFooterInstall('You can still install it later from your browser menu, using Install app.', false);
  }
}

installButton.addEventListener('click', startInstall);
footerInstallButton.addEventListener('click', startInstall);

installDismiss.addEventListener('click', () => {
  rememberDismissed();
  hideInstallBanner();
});

// Once the app is installed, neither note is needed
window.addEventListener('appinstalled', () => {
  installEvent = null;
  hideInstallBanner();
  footerInstall.hidden = true;
});

// iPhone and iPad: show the steps, since Safari has no install button we can open
if (isIos() && !isStandalone()) {
  const iosSteps = 'To install: tap the Share button in Safari, then choose Add to Home Screen.';
  showFooterInstall(iosSteps, false);

  if (!wasDismissed()) {
    installText.textContent = iosSteps;
    installButton.hidden = true;
    installBanner.hidden = false;
  }
}

// ----- 4. Notification permission -----
// Ask only when the person taps the button, never on page load.
// Asking at a moment the person chose is far more likely to get a yes.
function showNotifyState() {
  // Some browsers (like Safari on iPhone, until the app is on the home screen) have no notifications
  if (!('Notification' in window)) {
    notifyButton.hidden = true;
    notifyStatus.textContent = isIos() && !isStandalone()
      ? 'Add this app to your Home Screen to turn on notifications.'
      : 'This browser does not support notifications.';
    return;
  }

  notifyButton.hidden = false;

  if (Notification.permission === 'granted') {
    notifyButton.textContent = 'Notifications On ✓';
    notifyButton.disabled = true;
    notifyStatus.textContent = '';
  } else if (Notification.permission === 'denied') {
    notifyButton.textContent = 'Notifications Blocked';
    notifyButton.disabled = true;
    notifyStatus.textContent = 'To change this, allow notifications for this app in your device or browser settings.';
  } else {
    notifyButton.textContent = '🔔 Turn On Notifications';
    notifyButton.disabled = false;
    notifyStatus.textContent = '';
  }
}

// Show a first notification, so the person sees that it worked.
// The service worker shows it, because that is the way that also works on phones.
async function sendWelcomeNotification() {
  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification('Space Explorer', {
      body: 'Notifications are on. Tap to keep exploring the cosmos.',
      icon: 'img/icon-192.png',
      badge: 'img/icon-192.png'
    });
  } catch (error) {
    console.error('Could not show the notification:', error);
  }
}

notifyButton.addEventListener('click', async () => {
  const permission = await Notification.requestPermission();
  showNotifyState();

  if (permission === 'granted') {
    sendWelcomeNotification();
  }
});

showNotifyState();

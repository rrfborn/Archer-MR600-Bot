// background.js - MR600-Bot minimal service worker stub
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
self.addEventListener('message', (ev) => {
    console.log('MR600-Bot background received:', ev.data);
});

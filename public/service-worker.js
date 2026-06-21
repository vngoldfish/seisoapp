// Backward compatibility for older deployments that registered /service-worker.js.
// The application now registers /sw.js as the single service worker entry point.
importScripts('/sw.js');

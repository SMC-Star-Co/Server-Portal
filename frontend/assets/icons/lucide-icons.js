/* Offline SVG icon pack for Server Portal.
   Scope: only elements marked with data-portal-icon are rendered.
   No CDN, no internet dependency, no app logic changes. */
(function () {
    'use strict';

    const ICONS = {
        'receipt': '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2H4z"></path><path d="M8 7h8"></path><path d="M8 11h8"></path><path d="M8 15h5"></path>',
        'settings': '<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"></path><path d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.05.05a2.1 2.1 0 1 1-2.97 2.97l-.05-.05A1.8 1.8 0 0 0 14.8 19.6a1.8 1.8 0 0 0-1.08 1.65V21a2.1 2.1 0 1 1-4.2 0v-.08A1.8 1.8 0 0 0 8.45 19.3a1.8 1.8 0 0 0-1.98.36l-.05.05a2.1 2.1 0 1 1-2.97-2.97l.05-.05A1.8 1.8 0 0 0 3.85 14.7a1.8 1.8 0 0 0-1.65-1.08H2a2.1 2.1 0 1 1 0-4.2h.08A1.8 1.8 0 0 0 3.7 8.35a1.8 1.8 0 0 0-.36-1.98l-.05-.05a2.1 2.1 0 1 1 2.97-2.97l.05.05A1.8 1.8 0 0 0 8.3 3.75a1.8 1.8 0 0 0 1.08-1.65V2a2.1 2.1 0 1 1 4.2 0v.08A1.8 1.8 0 0 0 14.65 3.7a1.8 1.8 0 0 0 1.98-.36l.05-.05a2.1 2.1 0 1 1 2.97 2.97l-.05.05a1.8 1.8 0 0 0-.36 1.98c.18.5.6.9 1.1 1.08H22a2.1 2.1 0 1 1 0 4.2h-.08A1.8 1.8 0 0 0 19.4 15z"></path>',
        'lock-keyhole': '<rect x="4" y="10" width="16" height="11" rx="2"></rect><path d="M8 10V7a4 4 0 0 1 8 0v3"></path><path d="M12 15v2"></path>',
        'search':'<circle cx="10.5" cy="10.5" r="6.5"></circle><path d="m15.5 15.5 5.5 5.5"></path>',
        'log-out':'<path d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5"></path><path d="M15 17l5-5-5-5M20 12H9"></path>',
        'layout-dashboard': '<rect x="3" y="3" width="7" height="8" rx="1.5"></rect><rect x="14" y="3" width="7" height="5" rx="1.5"></rect><rect x="14" y="12" width="7" height="9" rx="1.5"></rect><rect x="3" y="15" width="7" height="6" rx="1.5"></rect>',

        'chart-no-axes-combined':'<path d="M3 3v18h18"></path><path d="m6 16 5-5 3 3 5-7"></path><path d="M19 7h-4"></path>',
        'database':'<ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5"></path><path d="M3 12c0 1.7 4 3 9 3s9-1.3 9-3"></path>',
        'user-round-cog':'<circle cx="9" cy="8" r="4"></circle><path d="M2 21a7 7 0 0 1 12-5"></path><circle cx="18" cy="18" r="3"></circle><path d="M18 13v2m0 6v2m-5-5h2m6 0h2"></path>',
        'files':'<path d="M16 3h3a2 2 0 0 1 2 2v15a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-1"></path><path d="M5 2h9a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"></path>',
        'calendar-check':'<rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M7 3v4m10-4v4M3 10h18m4 5 2 2 4-4"></path>',
        'timer':'<circle cx="12" cy="14" r="8"></circle><path d="M12 10v5l3 2M9 2h6m-3 0v4"></path>',
        'check-circle-2':'<circle cx="12" cy="12" r="9"></circle><path d="m8 12 3 3 5-6"></path>',
        'calendar-days':'<rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M7 3v4m10-4v4M3 10h18M7 14h2m3 0h2m3 0h1m-11 4h2m3 0h2"></path>',
        'home': '<path d="M3 11.5 12 4l9 7.5"></path><path d="M5 10.5V20h14v-9.5"></path><path d="M9 20v-6h6v6"></path>',
        'users': '<path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"></path><circle cx="9.5" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>',
        'archive': '<rect x="3" y="4" width="18" height="4" rx="1"></rect><path d="M5 8v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8"></path><path d="M10 12h4"></path>',
        'activity': '<path d="M8 6h13"></path><path d="M8 12h13"></path><path d="M8 18h13"></path><path d="M3 6h.01"></path><path d="M3 12h.01"></path><path d="M3 18h.01"></path>',
        'key-round': '<circle cx="7.5" cy="14.5" r="4.5"></circle><path d="M11 11 21 1"></path><path d="M16 6h3v3"></path><path d="M14 8h3v3"></path>',
        'user': '<path d="M20 21a8 8 0 0 0-16 0"></path><circle cx="12" cy="7" r="4"></circle>',
        'triangle-alert': '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path>',
        'calendar': '<rect x="3" y="4" width="18" height="18" rx="2"></rect><path d="M16 2v4"></path><path d="M8 2v4"></path><path d="M3 10h18"></path>',
        'pin': '<path d="M12 17v5"></path><path d="M5 17h14"></path><path d="M7 3h10l-1 8 3 6H5l3-6-1-8z"></path>',
        'refresh-cw': '<path d="M21 12a9 9 0 0 1-15.5 6.2"></path><path d="M3 12a9 9 0 0 1 15.5-6.2"></path><path d="M18 3v4h-4"></path><path d="M6 21v-4h4"></path>'
    };

    function renderPortalIcons(root) {
        const scope = root && root.querySelectorAll ? root : document;
        const items = scope.querySelectorAll('[data-portal-icon]');
        items.forEach(function (el) {
            const name = el.getAttribute('data-portal-icon');
            const body = ICONS[name];
            if (!body || el.getAttribute('data-portal-icon-ready') === '1') return;
            el.innerHTML = '<svg class="portal-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" style="width:1em;height:1em;display:inline-block;vertical-align:-0.125em;">' + body + '</svg>';
            el.setAttribute('data-portal-icon-ready', '1');
        });
    }

    window.renderPortalIcons = renderPortalIcons;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { renderPortalIcons(document); });
    } else {
        renderPortalIcons(document);
    }

    const observer = new MutationObserver(function (mutations) {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node && node.nodeType === 1) {
                    if (node.hasAttribute && node.hasAttribute('data-portal-icon')) renderPortalIcons(node.parentNode || document);
                    else renderPortalIcons(node);
                }
            }
        }
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });
})();
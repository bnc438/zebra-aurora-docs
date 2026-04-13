/**
 * Client-side event tracking script
 * 
 * Tracks user engagement metrics:
 * - Monaco editor opens
 * - Code copy clicks
 * - PDF generation requests
 * - Page navigation patterns
 * - Scroll depth
 * - Time on page
 * 
 * Events stored in localStorage and can be aggregated by backend script.
 */

(function initAuroraTracking() {
  const STORAGE_KEY = 'aurora_user_events';
  const MAX_STORED_EVENTS = 500;
  const SESSION_ID = Math.random().toString(36).substring(7);

  // Initialize tracking only on doc pages
  if (!document.body.classList.contains('aurora-doc-page')) {
    return;
  }

  // Helper to store events
  function logEvent(type, metadata = {}) {
    try {
      const event = {
        type,
        sessionId: SESSION_ID,
        docPath: window.location.pathname,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        ...metadata,
      };

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      stored.push(event);

      // Keep only last N events to prevent storage bloat
      if (stored.length > MAX_STORED_EVENTS) {
        stored.shift();
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
      console.debug('[Aurora Tracking]', type, metadata);
    } catch (error) {
      console.warn('[Aurora Tracking] Storage error:', error);
    }
  }

  // Track initial page load
  logEvent('page_view', {
    title: document.title,
    referrer: document.referrer,
  });

  // Track Monaco editor opens (Look for .codeBlock class or similar)
  function trackMonacoEvents() {
    document.addEventListener('click', (e) => {
      const codeBlock = e.target.closest('[class*="codeBlock"]');
      if (codeBlock) {
        const editorButton = e.target.closest('button[title*="Edit"]') || e.target.closest('button[aria-label*="edit"]');
        if (editorButton) {
          logEvent('monaco_editor_open', {
            codeLanguage: codeBlock.className.match(/language-(\w+)/)?.[1] || 'unknown',
          });
        }
      }
    });
  }

  // Track code copies
  function trackCodeCopies() {
    document.addEventListener('click', (e) => {
      if (
        e.target.closest('button[title*="Copy"]') ||
        e.target.closest('button[aria-label*="copy"]') ||
        e.target.closest('[class*="copyButton"]')
      ) {
        const codeBlock = e.target.closest('[class*="codeBlock"]');
        const codeLanguage = codeBlock?.className.match(/language-(\w+)/)?.[1] || 'unknown';

        logEvent('code_copy', {
          codeLanguage,
        });
      }
    });
  }

  // Track PDF requests
  function trackPdfGeneration() {
    // Intercept fetch/XHR for PDF generation
    const originalFetch = window.fetch;
    window.fetch = function (...args) {
      const url = args[0];
      if (typeof url === 'string' && (url.includes('pdf') || url.includes('generate'))) {
        logEvent('pdf_request', {
          endpoint: url,
        });
      }
      return originalFetch.apply(this, args);
    };

    // Also listen for button clicks that might generate PDFs
    document.addEventListener('click', (e) => {
      if (
        e.target.textContent?.toLowerCase().includes('pdf') ||
        e.target.title?.toLowerCase().includes('pdf') ||
        e.target.closest('[class*="pdf"]')
      ) {
        logEvent('pdf_button_click', {
          buttonText: e.target.textContent?.substring(0, 50),
        });
      }
    });
  }

  // Track scroll depth
  function trackScrollDepth() {
    let maxScroll = 0;
    window.addEventListener(
      'scroll',
      () => {
        const scrollPercent = Math.round(
          (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
        );
        if (scrollPercent > maxScroll) {
          maxScroll = scrollPercent;
          if (maxScroll % 25 === 0 && maxScroll > 0) {
            logEvent('scroll_depth', { percentScroll: maxScroll });
          }
        }
      },
      { passive: true }
    );
  }

  // Track time on page (log when user leaves)
  function trackTimeOnPage() {
    const startTime = Date.now();
    window.addEventListener('beforeunload', () => {
      const timeSpent = Math.round((Date.now() - startTime) / 1000); // seconds
      logEvent('session_end', {
        timeSpentSeconds: timeSpent,
      });
    });
  }

  // Track navigation (next/previous page)
  function trackNavigation() {
    document.addEventListener('click', (e) => {
      const navLink = e.target.closest('[class*="nav"]') || e.target.closest('[rel*="prev"], [rel*="next"]');
      if (navLink && navLink.href) {
        logEvent('navigation_click', {
          targetUrl: navLink.href,
          navType: navLink.rel || 'unknown',
        });
      }
    });
  }

  // Track internal link clicks
  function trackInternalLinks() {
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a');
      if (link && link.href && !link.href.includes('external')) {
        const isInternal = new URL(link.href).hostname === window.location.hostname;
        if (isInternal) {
          logEvent('internal_link_click', {
            targetUrl: link.href,
            linkText: link.textContent?.substring(0, 100),
          });
        }
      }
    });
  }

  // Track rage clicks (3+ clicks within 1 second on same element)
  function trackRageClicks() {
    const clickLog = [];
    document.addEventListener('click', (e) => {
      const now = Date.now();
      const target = e.target;
      clickLog.push({ target, time: now });
      // Keep only clicks in the last 1 second
      while (clickLog.length > 0 && now - clickLog[0].time > 1000) {
        clickLog.shift();
      }
      const sameTarget = clickLog.filter((c) => c.target === target);
      if (sameTarget.length >= 3) {
        logEvent('rage_click', {
          selector: target.tagName + (target.className ? '.' + String(target.className).split(' ')[0] : ''),
          clickCount: sameTarget.length,
        });
        clickLog.length = 0; // Reset after detection
      }
    });
  }

  // Track dead clicks (click on non-interactive element that produces no navigation)
  function trackDeadClicks() {
    document.addEventListener('click', (e) => {
      const target = e.target;
      const isInteractive = target.closest('a, button, input, select, textarea, [role="button"], [tabindex]');
      if (!isInteractive && !target.closest('[class*="codeBlock"]')) {
        logEvent('dead_click', {
          selector: target.tagName + (target.className ? '.' + String(target.className).split(' ')[0] : ''),
        });
      }
    });
  }

  // Initialize all trackers
  try {
    trackMonacoEvents();
    trackCodeCopies();
    trackPdfGeneration();
    trackScrollDepth();
    trackTimeOnPage();
    trackNavigation();
    trackInternalLinks();
    trackRageClicks();
    trackDeadClicks();
    console.log('[Aurora Tracking] Initialized');
  } catch (error) {
    console.warn('[Aurora Tracking] Initialization error:', error);
  }
})();

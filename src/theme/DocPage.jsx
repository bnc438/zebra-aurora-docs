/**
 * Custom DocPage wrapper that injects feedback widget and tracking
 * 
 * This wraps the default DocPage component to add:
 * - DocFeedbackWidget (floating CES button)
 * - Client-side event tracking injected via script tag
 */

import React, { useEffect } from 'react';
import DocPage from '@theme-original/DocPage';
import DocFeedbackWidget from '@site/src/components/DocFeedbackWidget';

export default function DocPageWrapper(props) {
  useEffect(() => {
    // Mark page as doc page for tracking
    document.body.classList.add('aurora-doc-page');

    // Inject tracking script
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = '/aurora-tracking.js';
    script.async = true;
    document.head.appendChild(script);

    return () => {
      document.body.classList.remove('aurora-doc-page');
    };
  }, []);

  return (
    <>
      <DocPage {...props} />
      <DocFeedbackWidget docPath={props.location?.pathname} />
    </>
  );
}

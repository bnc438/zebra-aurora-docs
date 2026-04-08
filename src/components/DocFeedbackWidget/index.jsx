/**
 * DocFeedbackWidget
 * 
 * Floating CES (Customer Effort Score) widget that appears on doc pages.
 * Allows users to report missing content and opens GitHub issues.
 * 
 * Usage:
 *   import DocFeedbackWidget from '@site/src/components/DocFeedbackWidget';
 *   <DocFeedbackWidget docPath="/docs/guide" />
 */

import React, { useState } from 'react';
import styles from './styles.module.css';

export default function DocFeedbackWidget({ docPath = window.location.pathname }) {
  const [isOpen, setIsOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!feedbackText.trim()) {
      alert('Please describe what you were looking for.');
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      // Track event locally
      const event = {
        type: 'content_request',
        docPath,
        text: feedbackText,
        email: email || 'anonymous',
        timestamp: new Date().toISOString(),
      };

      // Store in localStorage for aggregation
      const stored = JSON.parse(localStorage.getItem('aurora_user_events') || '[]');
      stored.push(event);
      localStorage.setItem('aurora_user_events', JSON.stringify(stored.slice(-100))); // Keep last 100 events

      // Attempt to create GitHub issue
      const gitHubToken = localStorage.getItem('GITHUB_TOKEN'); // User can set this in dev console
      if (gitHubToken) {
        const issueBody = `
**User Request:** ${feedbackText}

**Doc Path:** ${docPath}
**Email:** ${email || 'anonymous'}
**Timestamp:** ${new Date().toISOString()}

---
*Auto-generated from doc feedback widget*
`;

        const response = await fetch('https://api.github.com/repos/ZebraDeviceOS/zebra-aurora-docs/issues', {
          method: 'POST',
          headers: {
            Authorization: `token ${gitHubToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/vnd.github.v3+json',
          },
          body: JSON.stringify({
            title: `[Content Request] ${feedbackText.substring(0, 60)}...`,
            body: issueBody,
            labels: ['content-request', 'user-feedback'],
          }),
        });

        if (response.ok) {
          setSubmitStatus('success');
          setFeedbackText('');
          setEmail('');
          setTimeout(() => {
            setIsOpen(false);
            setSubmitStatus(null);
          }, 2000);
        } else {
          setSubmitStatus('error');
          console.error('GitHub issue creation failed:', response.statusText);
        }
      } else {
        // Feedback stored locally only
        setSubmitStatus('success');
        setFeedbackText('');
        setEmail('');
        setTimeout(() => {
          setIsOpen(false);
          setSubmitStatus(null);
        }, 2000);
      }
    } catch (error) {
      console.error('Feedback submission error:', error);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        className={styles.floatingButton}
        onClick={() => setIsOpen(!isOpen)}
        title="Send feedback or request content"
        aria-label="Feedback widget"
      >
        💬
      </button>

      {/* Feedback modal */}
      {isOpen && (
        <div className={styles.overlay} onClick={() => setIsOpen(false)}>
          <div
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.header}>
              <h3>Didn't find what you're looking for?</h3>
              <button
                className={styles.closeButton}
                onClick={() => setIsOpen(false)}
                aria-label="Close feedback"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className={styles.form}>
              <textarea
                className={styles.textarea}
                placeholder="Tell us what you were looking for or what would be helpful..."
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                disabled={isSubmitting}
                rows={4}
              />

              <input
                type="email"
                className={styles.input}
                placeholder="Your email (optional)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
              />

              <div className={styles.footer}>
                {submitStatus === 'success' && (
                  <p className={styles.successMessage}>
                    ✓ Thank you! Your feedback has been recorded.
                  </p>
                )}
                {submitStatus === 'error' && (
                  <p className={styles.errorMessage}>
                    ✗ Error submitting feedback. Please try again.
                  </p>
                )}
                {!submitStatus && (
                  <button
                    type="submit"
                    className={styles.submitButton}
                    disabled={isSubmitting || !feedbackText.trim()}
                  >
                    {isSubmitting ? 'Sending...' : 'Send Feedback'}
                  </button>
                )}
              </div>
            </form>

            <p className={styles.disclaimer}>
              Your feedback helps us improve. Data is tracked locally and may be used to shape future content.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import useBaseUrl from '@docusaurus/useBaseUrl';
import Layout from '@theme/Layout';
import { useRef } from 'react';

import Heading from '@theme/Heading';
import styles from './index.module.css';

const SUGGESTED_PROMPTS = [
  'How do I configure GPIO in Aurora Focus?',
  'What changed in Aurora Focus 9.4?',
  'How do I install and launch Aurora Focus?',
];

const homepageCards = [
  {
    title: 'User Guide',
    description: 'Learn core workflows, setup, and operation details for Aurora Focus.',
    to: '/docs/',
    cta: 'Open User Guide',
  },
  {
    title: 'JavaScript Developers Guide',
    description: 'Build and debug JavaScript scripts for device automation and integrations.',
    to: '/docs/javascript-developers-guide',
    cta: 'Start Developing',
  },
  {
    title: 'Licensing',
    description: 'Review license activation, usage rules, and compliance information.',
    to: '/docs/licensing/',
    cta: 'View Licensing Info',
  },
  {
    title: 'Release Notes',
    description: 'Track updates, fixes, and version-specific changes across releases.',
    to: '/docs/release-notes/',
    cta: 'Read Release Notes',
  },
];

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  const askAiUrl = useBaseUrl('/ask-ai');
  const searchInputRef = useRef(null);
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className={clsx('hero__title', styles.homeHeroTitle)}>
          Zebra Aurora Focus™ Help Portal
        </Heading>
        <p className="hero__subtitle">
          Zebra Aurora Focus™ is a single, unified platform that makes it easy to set up, deploy and run all of Zebra’s Fixed Industrial Scanners and Machine Vision Smart Cameras – eliminating the need for different applications.
        </p>
        <form className={styles.askAiSearchForm} action={askAiUrl} method="get">
          <input
            ref={searchInputRef}
            className={styles.askAiSearchInput}
            type="search"
            name="q"
            placeholder="What do you want to do?"
            aria-label="Ask AI search"
          />
          <button className="button button--secondary" type="submit">
            Ask AI
          </button>
        </form>
        <div className={styles.suggestedPromptsContainer}>
          <div className={styles.suggestedPromptsLabel}>Try asking:</div>
          <div className={styles.suggestedPromptsGrid}>
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className={styles.suggestedPromptButton}
                onClick={() => {
                  if (searchInputRef.current) {
                    searchInputRef.current.value = prompt;
                    searchInputRef.current.focus();
                  }
                }}
                title="Click to populate the search box"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}

export default function Home() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={`Hello from ${siteConfig.title}`}
      description="Description will go into a meta tag in <head />">
      <HomepageHeader />
      <main>
        <section className={styles.homeCardsSection}>
          <div className="container">
            <div className={styles.homeCardsGrid}>
              {homepageCards.map((card) => (
                <article key={card.title} className={styles.homeCard}>
                  <Heading as="h2" className={styles.homeCardTitle}>
                    {card.title}
                  </Heading>
                  <p className={styles.homeCardDescription}>{card.description}</p>
                  <Link className="button button--primary" to={card.to}>
                    {card.cta}
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}

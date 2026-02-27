import React, { useEffect, useMemo, useState } from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import MiniSearch from 'minisearch';

const SUGGESTED_PROMPTS = [
  'How many release notes are there?',
  'How do I configure GPIO in Aurora Focus?',
  'What changed in Aurora Focus 9.4?',
  'Show known issues for 2.0.8000',
  'How do I install and launch Aurora Focus?',
];

const SYNONYM_GROUPS = [
  ['gpio', 'digital', 'io', 'input', 'output'],
  ['firmware', 'fw', 'bsp'],
  ['install', 'installation', 'setup'],
  ['release', 'releases', 'release-notes', 'version'],
  ['bug', 'bugs', 'issue', 'issues', 'fix', 'fixes'],
  ['hmi', 'webhmi', 'web', 'ui'],
  ['ethernet', 'tcpip', 'tcp/ip', 'network'],
];

const SYNONYM_MAP = SYNONYM_GROUPS.reduce((map, group) => {
  group.forEach((term) => {
    map[term] = group.filter((item) => item !== term);
  });
  return map;
}, {});

function normalizeQuery(value) {
  return (value || '').toLowerCase().replace(/[^a-z0-9\s/\-#]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokenize(value) {
  return normalizeQuery(value).split(/\s+/).filter((part) => part.length > 2);
}

function expandTerms(baseTerms) {
  const expanded = new Set(baseTerms);
  baseTerms.forEach((term) => {
    const related = SYNONYM_MAP[term] || [];
    related.forEach((item) => expanded.add(item));
  });
  return Array.from(expanded);
}

function createSearchIndex(records) {
  const miniSearch = new MiniSearch({
    fields: ['title', 'heading', 'text', 'url'],
    storeFields: ['title', 'heading', 'text', 'url'],
    searchOptions: {
      boost: { title: 3, heading: 4, text: 1 },
      prefix: true,
      fuzzy: 0.2,
    },
  });

  const docs = records.map((record, index) => ({ id: index, ...record }));
  miniSearch.addAll(docs);
  return miniSearch;
}

function rankRecords(searchIndex, query, max = 5) {
  if (!searchIndex) return [];
  const rawTerms = tokenize(query);
  const terms = expandTerms(rawTerms);
  if (!terms.length) return [];

  const searchQuery = terms.join(' ');
  const rawResults = searchIndex.search(searchQuery, {
    boost: { title: 3, heading: 4, text: 1 },
    prefix: true,
    fuzzy: 0.2,
  });

  const deduped = [];
  const seen = new Set();
  for (const result of rawResults) {
    const key = `${result.url}::${result.heading}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push({
      title: result.title,
      heading: result.heading,
      text: result.text,
      url: result.url,
      score: result.score,
    });
    if (deduped.length >= max) break;
  }

  const maxScore = deduped[0]?.score || 1;
  return deduped.map((item) => ({
    ...item,
    coverage: Math.min(1, item.score / maxScore),
  }));
}

function getConfidence(results) {
  if (!results.length) {
    return { label: 'Low', value: 0.1, reason: 'No relevant sections found.' };
  }

  const top = results[0];
  const second = results[1];
  const scoreGap = second ? top.score - second.score : top.score;
  const confidenceValue = Math.min(0.98, (top.coverage * 0.7) + (Math.min(scoreGap, 6) / 20) + 0.2);

  if (confidenceValue >= 0.72) {
    return { label: 'High', value: confidenceValue, reason: 'Strong term and section match in top results.' };
  }
  if (confidenceValue >= 0.5) {
    return { label: 'Medium', value: confidenceValue, reason: 'Some relevant overlap, but query may be broad.' };
  }
  return { label: 'Low', value: confidenceValue, reason: 'Limited overlap with indexed docs.' };
}

function buildAnswer(results, confidence) {
  if (!results.length) {
    return 'I could not find a direct answer in the local docs index. Try adding product, version, or feature names.';
  }

  const lines = results.map((item) => {
    const snippet = item.text.slice(0, 220).trim();
    return `• ${item.heading}: ${snippet}${item.text.length > 220 ? '…' : ''}`;
  });

  return `Confidence: ${confidence.label}\n\nBased on the docs, here are the most relevant sections:\n\n${lines.join('\n')}`;
}

function isCountQuestion(query) {
  const normalized = normalizeQuery(query);
  return (
    /\bhow many\b/.test(normalized)
    || /\bnumber of\b/.test(normalized)
    || /\bcount\b/.test(normalized)
    || /\btotal\b/.test(normalized)
    || /#\s*of/.test(normalized)
  );
}

function isReleaseNotesQuestion(query) {
  const normalized = normalizeQuery(query);
  return (
    /release[\s\-_/]*notes?/.test(normalized)
    || /notes?[\s\-_/]*release/.test(normalized)
    || /\breleases?\b/.test(normalized)
    || (normalized.includes('release') && normalized.includes('notes'))
  );
}

function hasReleaseContext(messages) {
  return messages.some((message) => {
    if (message.role !== 'user') return false;
    return isReleaseNotesQuestion(message.text || '');
  });
}

function getReleaseNotesCount(records) {
  const urls = new Set();
  records.forEach((record) => {
    if (
      record.url
      && record.url.startsWith('/docs/releases/')
      && !record.url.includes('[')
      && !record.url.includes(']')
    ) {
      urls.add(record.url);
    }
  });
  return urls.size;
}

export default function AskAIPage() {
  const [question, setQuestion] = useState('');
  const [records, setRecords] = useState([]);
  const [searchIndex, setSearchIndex] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: 'Ask me anything about these docs. I will answer from local indexed content and provide source links.',
      sources: [],
    },
  ]);

  const indexUrl = useBaseUrl('/askai-index.json');

  useEffect(() => {
    let mounted = true;
    async function loadIndex() {
      try {
        const response = await fetch(indexUrl);
        const payload = await response.json();
        if (mounted) {
          const loadedRecords = Array.isArray(payload.records) ? payload.records : [];
          setRecords(loadedRecords);
          setSearchIndex(createSearchIndex(loadedRecords));
        }
      } catch {
        if (mounted) {
          setRecords([]);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }
    loadIndex();
    return () => {
      mounted = false;
    };
  }, [indexUrl]);

  const searchPath = useMemo(() => {
    const query = encodeURIComponent(question.trim());
    return query ? `/search?q=${query}` : '/search';
  }, [question]);

  function askQuestion(rawQuestion) {
    const trimmed = rawQuestion.trim();
    if (!trimmed) return;

    const previousUserQuestions = messages
      .filter((message) => message.role === 'user')
      .slice(-2)
      .map((message) => message.text)
      .join(' ');
    const contextualQuery = `${trimmed} ${previousUserQuestions}`.trim();

    const isReleaseCountQuery = isCountQuestion(trimmed)
      && (isReleaseNotesQuestion(trimmed) || hasReleaseContext(messages));

    if (isReleaseCountQuery) {
      const releaseNotesCount = getReleaseNotesCount(records);
      const assistantMessage = {
        role: 'assistant',
        text: `There are ${releaseNotesCount} release notes pages in the docs.`,
        confidence: {
          label: 'High',
          value: 0.98,
          reason: 'Direct count from the local docs index.',
        },
        sources: [
          {
            label: 'Release Notes Overview',
            url: '/docs/release-notes/',
          },
        ],
      };

      setMessages((current) => [
        ...current,
        { role: 'user', text: trimmed, sources: [] },
        assistantMessage,
      ]);
      return;
    }

    const results = rankRecords(searchIndex, contextualQuery);
    const confidence = getConfidence(results);

    const assistantMessage = {
      role: 'assistant',
      text: buildAnswer(results, confidence),
      confidence,
      sources: results.map((item) => ({
        label: `${item.title} — ${item.heading}`,
        url: item.url,
      })),
    };

    setMessages((current) => [
      ...current,
      { role: 'user', text: trimmed, sources: [] },
      assistantMessage,
    ]);
  }

  function handleAsk(event) {
    event.preventDefault();
    askQuestion(question);
    setQuestion('');
  }

  return (
    <Layout title="Ask AI" description="Free conversational Ask AI for this docs site">
      <main className="container margin-vert--lg">
        <h1>Ask AI</h1>
        <p>
          Free conversational mode is enabled using a local docs index. No external AI API is required.
        </p>

        <div className="margin-bottom--md">
          <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Try a suggested question</div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="button button--secondary button--sm"
                onClick={() => {
                  setQuestion(prompt);
                  askQuestion(prompt);
                }}
                disabled={isLoading}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        <div className="margin-bottom--md askai-chat-panel" style={{ borderRadius: '10px', padding: '1rem', minHeight: '320px' }}>
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className="margin-bottom--md">
              <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{message.role === 'assistant' ? 'AskAI' : 'You'}</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{message.text}</div>
              {message.confidence ? (
                <div className="margin-top--sm" style={{ fontSize: '0.9rem', color: 'var(--ifm-color-emphasis-700)' }}>
                  Confidence: <strong>{message.confidence.label}</strong> ({Math.round(message.confidence.value * 100)}%) — {message.confidence.reason}
                </div>
              ) : null}
              {message.sources?.length ? (
                <div className="margin-top--sm">
                  <div style={{ fontWeight: 600 }}>Sources</div>
                  <ul>
                    {message.sources.slice(0, 4).map((source) => (
                      <li key={`${source.url}-${source.label}`}>
                        <Link to={source.url}>{source.label}</Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ))}

          {isLoading ? <p>Loading local docs index…</p> : null}
        </div>

        <form onSubmit={handleAsk} className="margin-bottom--lg">
          <label htmlFor="askai-question" className="margin-bottom--sm" style={{ display: 'block' }}>
            Your question
          </label>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <input
              className="askai-input"
              id="askai-question"
              type="text"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Example: How do I configure GPIO in Aurora Focus?"
              style={{ flex: '1 1 420px', padding: '0.6rem 0.75rem', borderRadius: '8px' }}
            />
            <button type="submit" className="button button--primary" disabled={isLoading}>
              Ask
            </button>
            <Link className="button button--secondary" to={searchPath}>
              Open Search
            </Link>
          </div>
        </form>

        <h2>How this free mode works</h2>
        <ul>
          <li>Indexes your docs during build into a local JSON file.</li>
          <li>Finds top relevant sections from your question and conversation context.</li>
          <li>Returns a conversational answer with clickable sources.</li>
        </ul>
      </main>
    </Layout>
  );
}

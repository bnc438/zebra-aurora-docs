import React, { useEffect, useMemo, useRef, useState } from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import useBaseUrl from '@docusaurus/useBaseUrl';
import MiniSearch from 'minisearch';

const SUGGESTED_PROMPTS = [
  'How many release notes are there?',
  'How do I configure GPIO in Aurora Focus?',
  'What changed in Aurora Focus 9.4?',
  'Show known issues for 2.0.8000',
  'How do I install and launch Aurora Focus?',
];

const FAILED_SEARCH_STORAGE_KEY = 'askai.failed-searches';
const MAX_STORED_FAILED_SEARCHES = 200;
const SEARCH_EVENT_STORAGE_KEY = 'askai.search-events';
const SOURCE_CLICK_STORAGE_KEY = 'askai.source-clicks';
const ASKAI_SESSION_ID_STORAGE_KEY = 'askai.session-id';
const MAX_STORED_SEARCH_EVENTS = 400;
const MAX_STORED_SOURCE_CLICKS = 400;
const WEBHOOK_STORAGE_KEY = 'askai.failed-search-webhook-url';

const SYNONYM_GROUPS = [
  ['gpio', 'digital', 'io', 'input', 'output'],
  ['firmware', 'fw', 'bsp'],
  ['install', 'installation', 'setup'],
  ['release', 'releases', 'release-notes', 'version'],
  ['bug', 'bugs', 'issue', 'issues', 'fix', 'fixes'],
  ['hmi', 'webhmi', 'web', 'ui'],
  ['ethernet', 'tcpip', 'tcp/ip', 'network'],
  ['configure', 'configuration', 'setup', 'set-up'],
  ['launch', 'run', 'start', 'open'],
  ['license', 'licensing', 'activation', 'activate', 'deactivate'],
];

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'be', 'can', 'do', 'for', 'from', 'how', 'i', 'in', 'is', 'it', 'me',
  'of', 'on', 'or', 'show', 'the', 'there', 'to', 'what', 'with', 'you', 'your', 'using', 'use',
]);

const LOW_SIGNAL_HEADINGS = new Set(['see also', 'monaco sandbox']);

const SYNONYM_MAP = SYNONYM_GROUPS.reduce((map, group) => {
  group.forEach((term) => {
    map[term] = group.filter((item) => item !== term);
  });
  return map;
}, {});

function normalizeQuery(value) {
  return (value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s/\-#._]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value) {
  const normalized = normalizeQuery(value);
  if (!normalized) return [];
  const rawParts = normalized.match(/[a-z0-9][a-z0-9._/#-]*/g) || [];
  return rawParts.filter((part) => part.length > 2 || /\d/.test(part));
}

function meaningfulTokens(value) {
  return tokenize(value).filter((part) => !STOP_WORDS.has(part) || /\d/.test(part));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isVersionToken(value) {
  return /^\d+(?:[._-]\d+)+$/.test(value);
}

function countOccurrences(text, term) {
  if (!text || !term) return 0;
  const matches = text.match(new RegExp(escapeRegExp(term), 'gi'));
  return matches ? matches.length : 0;
}

function includesWholeTerm(text, term) {
  if (!text || !term) return false;
  return new RegExp(`\\b${escapeRegExp(term)}\\b`, 'i').test(text);
}

function getQueryIntent(query) {
  const normalized = normalizeQuery(query);
  return {
    normalized,
    asksHowTo: /\b(how|configure|install|launch|setup|activate|deactivate|obtain|view|manage)\b/.test(normalized),
    asksReleaseNotes: /\b(release|releases|release-notes|changed|what changed|known issues|bug|bugs|fix|fixed)\b/.test(normalized),
    asksLicensing: /\b(license|licensing|activate|activation|deactivate|seat|provision)\b/.test(normalized),
    asksJavascript: /\b(javascript|script|gpio|ftp|tcpip|tcp\/ip|serial|hid|beeper|editor)\b/.test(normalized),
    versionTokens: meaningfulTokens(normalized).filter(isVersionToken),
  };
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
    storeFields: ['title', 'heading', 'text', 'url', 'contentType', 'category'],
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

function runSearchVariants(searchIndex, variants) {
  const merged = new Map();

  variants.forEach((variant, index) => {
    if (!variant) return;
    const results = searchIndex.search(variant, {
      boost: { title: 3, heading: 4, text: 1 },
      prefix: true,
      fuzzy: index === 0 ? 0.1 : 0.2,
    });

    results.forEach((result) => {
      const key = `${result.url}::${result.heading}`;
      const existing = merged.get(key);
      const adjustedScore = result.score * (index === 0 ? 1.25 : 1);
      if (!existing || adjustedScore > existing.score) {
        merged.set(key, {...result, score: adjustedScore});
      }
    });
  });

  return Array.from(merged.values());
}

function rerankResult(result, queryIntent, queryTerms) {
  const title = normalizeQuery(result.title);
  const heading = normalizeQuery(result.heading);
  const text = normalizeQuery(result.text);
  const category = result.category || '';
  const contentType = normalizeQuery(result.contentType || '');

  let score = result.score;

  queryTerms.forEach((term) => {
    if (includesWholeTerm(title, term)) score += 5;
    if (includesWholeTerm(heading, term)) score += 4;
    if (includesWholeTerm(text, term)) score += 1.2;
    if (isVersionToken(term) && includesWholeTerm(`${result.url} ${title} ${heading} ${text}`, term)) {
      score += 8;
    }

    score += Math.min(3, countOccurrences(heading, term)) * 0.8;
    score += Math.min(5, countOccurrences(text, term)) * 0.15;
  });

  if (queryIntent.normalized && heading.includes(queryIntent.normalized)) score += 6;
  if (queryIntent.normalized && title.includes(queryIntent.normalized)) score += 5;
  if (queryIntent.normalized && text.includes(queryIntent.normalized)) score += 2.5;

  if (LOW_SIGNAL_HEADINGS.has(heading)) score -= 8;

  if (queryIntent.asksHowTo && (contentType.includes('tutorial') || /\b(using|activating|deactivating|obtaining|viewing|bridging|install|configure|getting started)\b/.test(heading))) {
    score += 3.5;
  }

  if (queryIntent.asksReleaseNotes && category === 'release-notes') score += 5;
  if (queryIntent.asksLicensing && category === 'licensing') score += 4;
  if (queryIntent.asksJavascript && category === 'javascript') score += 3;

  if (queryIntent.versionTokens.length > 0 && category === 'release-notes') score += 2;

  return score;
}

function buildSnippet(text, queryTerms) {
  const cleanedText = String(text || '').replace(/\s+/g, ' ').trim();
  if (!cleanedText) return '';

  const terms = queryTerms.filter(Boolean);
  const sentences = cleanedText
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (!sentences.length) {
    return cleanedText;
  }

  if (!terms.length) {
    return sentences.slice(0, 2).join(' ');
  }

  const normalizedTerms = terms.map((term) => term.toLowerCase());

  const scoredSentences = sentences.map((sentence, index) => {
    const normalizedSentence = sentence.toLowerCase();
    const termMatches = normalizedTerms.filter((term) => includesWholeTerm(normalizedSentence, term)).length;
    return {
      sentence,
      index,
      score: termMatches,
    };
  });

  const topSentence = scoredSentences
    .sort((left, right) => right.score - left.score || left.index - right.index)[0];

  if (!topSentence || topSentence.score === 0) {
    return sentences.slice(0, 2).join(' ');
  }

  const sentenceIndex = topSentence.index;
  const output = [sentences[sentenceIndex]];

  // Add one adjacent sentence when available for fuller context.
  if (sentences[sentenceIndex + 1]) {
    output.push(sentences[sentenceIndex + 1]);
  } else if (sentenceIndex > 0) {
    output.unshift(sentences[sentenceIndex - 1]);
  }

  return output.join(' ').trim();
}

function extractDirectSteps(text, maxSteps = 6) {
  const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];

  const numberedPattern = /(?:^|\s)(\d+)\.\s+([^\d].*?)(?=(?:\s\d+\.\s)|$)/g;
  const numbered = [];
  let match;

  while ((match = numberedPattern.exec(cleaned)) !== null) {
    const stepText = String(match[2] || '').trim();
    if (stepText.length >= 8) {
      numbered.push(stepText);
    }
    if (numbered.length >= maxSteps) break;
  }

  if (numbered.length >= 2) {
    return numbered;
  }

  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  return sentences
    .filter((sentence) => /\b(click|select|open|enter|enable|disable|run|go to|choose|verify|save|submit|install|launch|activate|deactivate|provision|configure)\b/i.test(sentence))
    .slice(0, maxSteps);
}

function summarizeDirectAnswer(results) {
  const top = results[0];
  const summary = top?.snippet || top?.text || '';
  const sentence = String(summary)
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .find(Boolean);

  if (sentence) return sentence;
  return 'I found the best matching guidance in the documentation and summarized the direct steps below.';
}

function rankRecords(searchIndex, query, max = 5) {
  if (!searchIndex) return [];
  const normalizedQuery = normalizeQuery(query);
  const rawTerms = meaningfulTokens(query);
  const terms = expandTerms(rawTerms);
  if (!terms.length && !normalizedQuery) return [];

  const termQuery = rawTerms.join(' ');
  const expandedQuery = terms.join(' ');
  const variants = Array.from(new Set([normalizedQuery, termQuery, expandedQuery].filter(Boolean)));
  const queryIntent = getQueryIntent(query);
  const rawResults = runSearchVariants(searchIndex, variants)
    .map((result) => ({
      ...result,
      score: rerankResult(result, queryIntent, rawTerms),
    }))
    .sort((left, right) => right.score - left.score);

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
      contentType: result.contentType,
      category: result.category,
      snippet: buildSnippet(result.text, [...queryIntent.versionTokens, ...rawTerms]),
    });
    if (deduped.length >= max) break;
  }

  const maxScore = deduped[0]?.score || 1;
  return deduped.map((item) => ({
    ...item,
    coverage: Math.min(1, item.score / maxScore),
  }));
}

function getTopMatchCoverage(topResult, queryTerms) {
  if (!topResult || !queryTerms.length) {
    return {ratio: 0, matchedCount: 0};
  }

  const haystack = normalizeQuery(`${topResult.title} ${topResult.heading} ${topResult.text} ${topResult.url}`);
  const matchedCount = queryTerms.filter((term) => includesWholeTerm(haystack, term)).length;
  return {
    ratio: matchedCount / queryTerms.length,
    matchedCount,
  };
}

function getConfidence(results, query) {
  const queryTerms = meaningfulTokens(query);
  const queryIntent = getQueryIntent(query);

  if (!results.length) {
    return { label: 'Low', value: 0.1, reason: 'No relevant sections found.' };
  }

  const top = results[0];
  const second = results[1];
  const scoreGap = second ? top.score - second.score : top.score;
  const {ratio: termMatchRatio, matchedCount} = getTopMatchCoverage(top, queryTerms);

  let confidenceValue = Math.min(
    0.98,
    (top.coverage * 0.45)
      + (Math.min(scoreGap, 6) / 28)
      + (termMatchRatio * 0.45)
      + 0.05
  );

  if (queryTerms.length >= 3 && termMatchRatio < 0.45) {
    confidenceValue = Math.min(confidenceValue, 0.48);
  }

  if (queryIntent.versionTokens.length > 0) {
    const versionMatched = queryIntent.versionTokens.some((token) =>
      includesWholeTerm(normalizeQuery(`${top.title} ${top.heading} ${top.text} ${top.url}`), token)
    );
    if (!versionMatched) {
      confidenceValue = Math.min(confidenceValue, 0.4);
    }
  }

  if (queryIntent.asksReleaseNotes && top.category !== 'release-notes') {
    confidenceValue = Math.min(confidenceValue, 0.45);
  }

  if (queryIntent.asksLicensing && top.category !== 'licensing') {
    confidenceValue = Math.min(confidenceValue, 0.5);
  }

  const reasonSummary = `Matched ${matchedCount}/${Math.max(1, queryTerms.length)} key terms in top result.`;

  if (confidenceValue >= 0.72) {
    return { label: 'High', value: confidenceValue, reason: reasonSummary, termMatchRatio };
  }
  if (confidenceValue >= 0.5) {
    return { label: 'Medium', value: confidenceValue, reason: reasonSummary, termMatchRatio };
  }
  return { label: 'Low', value: confidenceValue, reason: reasonSummary, termMatchRatio };
}

function shouldAbstain(results, confidence, query) {
  if (!results.length) return true;
  if (confidence?.label !== 'Low') return false;

  const queryIntent = getQueryIntent(query || '');
  const top = results[0] || {};
  const topCoverage = results[0]?.coverage || 0;
  const termMatchRatio = confidence?.termMatchRatio || 0;

  // If the top hit is in the exact intent category, do not abstain too aggressively.
  if (queryIntent.asksLicensing && top.category === 'licensing' && topCoverage >= 0.42) {
    return false;
  }
  if (queryIntent.asksReleaseNotes && top.category === 'release-notes' && topCoverage >= 0.42) {
    return false;
  }
  if (queryIntent.asksJavascript && top.category === 'javascript' && topCoverage >= 0.42) {
    return false;
  }

  // Abstain only when both coverage and term match are weak.
  return topCoverage < 0.55 && termMatchRatio < 0.45;
}

function buildAnswerPayload(results, confidence, query) {
  if (shouldAbstain(results, confidence, query)) {
    return {
      text: 'I cannot answer this reliably from the current docs index. Try asking a question about Aurora Focus documentation, such as licensing, release notes, JavaScript scripting, or setup.',
      answerType: 'abstained',
    };
  }

  if (!results.length) {
    return {
      text: 'I could not find a direct answer in the local docs index. Try adding product, version, or feature names.',
      answerType: 'no-results',
    };
  }

  const directAnswer = summarizeDirectAnswer(results);
  const steps = extractDirectSteps(results[0]?.text || '', 6);

  if (steps.length) {
    const formattedSteps = steps.map((step, index) => `${index + 1}. ${step}`).join('\n');
    return {
      text: `Answer: ${directAnswer}\n\nDirect steps:\n${formattedSteps}`,
      answerType: 'direct-steps',
    };
  }

  return {
    text: `Answer: ${directAnswer}\n\nI could not extract explicit step-by-step instructions for this query from the indexed text. Please open the top source for full procedure details.`,
    answerType: 'summary',
  };
}

function toWeekStartIso(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const day = date.getUTCDay();
  const daysFromMonday = (day + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysFromMonday);
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

function createEventId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `askai-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getSessionId() {
  if (typeof window === 'undefined') return 'askai-server';

  try {
    const existing = window.sessionStorage.getItem(ASKAI_SESSION_ID_STORAGE_KEY);
    if (existing) return existing;

    const next = createEventId();
    window.sessionStorage.setItem(ASKAI_SESSION_ID_STORAGE_KEY, next);
    return next;
  } catch {
    return 'askai-session-unavailable';
  }
}

function getPrimaryIntent(query) {
  const intent = getQueryIntent(query);

  if (intent.asksReleaseNotes) return 'release-notes';
  if (intent.asksLicensing) return 'licensing';
  if (intent.asksJavascript) return 'javascript';
  if (intent.asksHowTo) return 'how-to';
  if (intent.versionTokens.length > 0) return 'versioned';
  return 'general';
}

function persistAnalyticsEvent(storageKey, event, maxItems) {
  if (typeof window === 'undefined') return;

  try {
    const existing = JSON.parse(window.localStorage.getItem(storageKey) || '[]');
    const next = [event, ...existing].slice(0, maxItems);
    window.localStorage.setItem(storageKey, JSON.stringify(next));
  } catch {
    // Ignore storage failures so AskAI can continue responding.
  }
}

function getFailureReason(results, confidence, query) {
  if (!results.length) return 'no-results';
  if (shouldAbstain(results, confidence, query)) return 'abstained';
  if (confidence?.label === 'Low') return 'low-confidence';
  if (results.length === 1 && (results[0]?.coverage || 0) < 0.5) return 'single-weak-match';
  return '';
}

function shouldTrackFailedSearch(query, results, confidence) {
  const trimmed = String(query || '').trim();
  if (!trimmed) return false;
  return Boolean(getFailureReason(results, confidence, trimmed));
}

function buildFailedSearchEvent(query, results, confidence) {
  const recordedAt = new Date().toISOString();
  const normalizedQuery = normalizeQuery(query);
  const failureReason = getFailureReason(results, confidence, query);
  const closestReturnedPage = results[0]?.url || '';
  const queryIntent = getQueryIntent(query);

  return {
    query: String(query || '').trim(),
    normalizedQuery,
    failureReason,
    confidence: confidence?.value || 0,
    confidenceLabel: confidence?.label || 'Low',
    closestReturnedPage,
    topResults: results.slice(0, 3).map((item) => ({
      title: item.title,
      heading: item.heading,
      url: item.url,
      score: item.score,
      coverage: item.coverage,
    })),
    recordedAt,
    weekStart: toWeekStartIso(recordedAt),
    path: typeof window !== 'undefined' ? window.location.pathname : '/ask-ai',
    primaryIntent: getPrimaryIntent(query),
    versionTokens: queryIntent.versionTokens,
    topResultCategory: results[0]?.category || '',
    topResultHeading: results[0]?.heading || '',
    topCoverage: Number(((results[0]?.coverage) || 0).toFixed(3)),
    termMatchRatio: Number(((confidence?.termMatchRatio) || 0).toFixed(3)),
  };
}

function persistFailedSearch(event) {
  persistAnalyticsEvent(FAILED_SEARCH_STORAGE_KEY, event, MAX_STORED_FAILED_SEARCHES);
}

function emitFailedSearchAnalytics(event) {
  if (typeof window === 'undefined') return;

  try {
    window.dispatchEvent(new CustomEvent('askai:failed-search', {detail: event}));
  } catch {
    // Ignore event emission failures.
  }

  if (typeof window.gtag === 'function') {
    window.gtag('event', 'askai_failed_search', {
      query: event.query,
      confidence: event.confidence,
      confidence_label: event.confidenceLabel,
      result_count: event.topResults.length,
    });
  }

  const savedWebhookUrl = (() => {
    try {
      return window.localStorage.getItem(WEBHOOK_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  })();

  const webhookUrl = window.ASKAI_FAILED_SEARCH_WEBHOOK || savedWebhookUrl;
  if (!webhookUrl) return;

  const body = JSON.stringify(event);

  if (navigator.sendBeacon) {
    try {
      navigator.sendBeacon(webhookUrl, new Blob([body], {type: 'application/json'}));
      return;
    } catch {
      // Fall through to fetch.
    }
  }

  fetch(webhookUrl, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body,
    keepalive: true,
  }).catch(() => {
    // Ignore network errors so search UX stays unaffected.
  });
}

function trackFailedSearch(query, results, confidence) {
  if (!shouldTrackFailedSearch(query, results, confidence)) return;
  const event = buildFailedSearchEvent(query, results, confidence);
  persistFailedSearch(event);
  emitFailedSearchAnalytics(event);
}

function buildSearchEvent({
  searchId,
  query,
  contextualQuery,
  results,
  confidence,
  answerType,
  sourceCount,
  usedFollowUpContext,
  latencyMs,
}) {
  const recordedAt = new Date().toISOString();
  const trimmedQuery = String(query || '').trim();
  const queryIntent = getQueryIntent(trimmedQuery);
  const top = results[0] || {};
  const failureReason = getFailureReason(results, confidence, trimmedQuery);

  return {
    eventType: 'search',
    searchId,
    sessionId: getSessionId(),
    query: trimmedQuery,
    normalizedQuery: normalizeQuery(trimmedQuery),
    executedQuery: String(contextualQuery || trimmedQuery).trim(),
    primaryIntent: getPrimaryIntent(trimmedQuery),
    versionTokens: queryIntent.versionTokens,
    confidence: Number((confidence?.value || 0).toFixed(3)),
    confidenceLabel: confidence?.label || 'Low',
    termMatchRatio: Number(((confidence?.termMatchRatio) || 0).toFixed(3)),
    resultCount: results.length,
    sourceCount,
    hasSources: sourceCount > 0,
    answerType,
    usedFollowUpContext: Boolean(usedFollowUpContext),
    isFailure: Boolean(failureReason),
    failureReason,
    wasAbstained: failureReason === 'abstained',
    topResultUrl: top.url || '',
    topResultTitle: top.title || '',
    topResultHeading: top.heading || '',
    topResultCategory: top.category || '',
    topCoverage: Number(((top.coverage) || 0).toFixed(3)),
    closestReturnedPage: top.url || '',
    latencyMs: Math.max(0, Math.round(Number(latencyMs) || 0)),
    recordedAt,
    weekStart: toWeekStartIso(recordedAt),
    path: typeof window !== 'undefined' ? window.location.pathname : '/ask-ai',
  };
}

function persistSearchEvent(event) {
  persistAnalyticsEvent(SEARCH_EVENT_STORAGE_KEY, event, MAX_STORED_SEARCH_EVENTS);
}

function buildSourceClickEvent(searchEvent, source, sourceIndex) {
  const recordedAt = new Date().toISOString();

  return {
    eventType: 'source-click',
    clickId: createEventId(),
    searchId: searchEvent?.searchId || '',
    sessionId: searchEvent?.sessionId || getSessionId(),
    query: searchEvent?.query || '',
    normalizedQuery: searchEvent?.normalizedQuery || normalizeQuery(searchEvent?.query || ''),
    primaryIntent: searchEvent?.primaryIntent || 'general',
    sourceUrl: source?.url || '',
    sourceLabel: source?.label || '',
    sourceIndex,
    recordedAt,
    weekStart: toWeekStartIso(recordedAt),
    path: typeof window !== 'undefined' ? window.location.pathname : '/ask-ai',
  };
}

function persistSourceClickEvent(event) {
  persistAnalyticsEvent(SOURCE_CLICK_STORAGE_KEY, event, MAX_STORED_SOURCE_CLICKS);
}

function trackSourceClick(searchEvent, source, sourceIndex = 0) {
  if (!searchEvent?.searchId || !source?.url) return;
  persistSourceClickEvent(buildSourceClickEvent(searchEvent, source, sourceIndex));
}

function trackSearch(query, results, confidence, meta) {
  const searchEvent = buildSearchEvent({
    searchId: meta.searchId,
    query,
    contextualQuery: meta.contextualQuery,
    results,
    confidence,
    answerType: meta.answerType,
    sourceCount: meta.sourceCount || 0,
    usedFollowUpContext: meta.usedFollowUpContext,
    latencyMs: meta.latencyMs,
  });

  persistSearchEvent(searchEvent);

  if (shouldTrackFailedSearch(query, results, confidence)) {
    const failedEvent = {
      ...buildFailedSearchEvent(query, results, confidence),
      searchId: searchEvent.searchId,
      sessionId: searchEvent.sessionId,
      answerType: meta.answerType,
      usedFollowUpContext: Boolean(meta.usedFollowUpContext),
      latencyMs: searchEvent.latencyMs,
    };
    persistFailedSearch(failedEvent);
    emitFailedSearchAnalytics(failedEvent);
  }

  return searchEvent;
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

function isLikelyFollowUpQuestion(query) {
  const normalized = normalizeQuery(query);
  const terms = meaningfulTokens(normalized);
  const hasReferentialCue = /\b(it|that|those|them|same|above|previous|earlier|also|and what about|what about this|how about that)\b/.test(normalized);

  if (terms.length <= 2) return hasReferentialCue;
  return hasReferentialCue;
}

export default function AskAIPage() {
  const {siteConfig} = useDocusaurusContext();
  const enableInternalAnalytics = Boolean(siteConfig?.customFields?.enableInternalAnalytics);
  const [question, setQuestion] = useState('');
  const [records, setRecords] = useState([]);
  const [searchIndex, setSearchIndex] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: 'Ask me anything about these docs. I will answer from local indexed content and provide source links.',
      sources: [],
    },
  ]);

  const indexUrl = useBaseUrl('/askai-index.json');
  const autoAskedRef = useRef(false);

  // Auto-ask if the page was opened with ?q= from the homepage search form.
  useEffect(() => {
    if (autoAskedRef.current) return;
    if (isLoading || !searchIndex) return;
    const params = new URLSearchParams(window.location.search);
    const initialQuery = params.get('q')?.trim();
    if (initialQuery) {
      autoAskedRef.current = true;
      setQuestion('');
      askQuestion(initialQuery);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, searchIndex]);

  useEffect(() => {
    let mounted = true;
    async function loadIndex() {
      try {
        setLoadError('');
        const response = await fetch(indexUrl, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`Index request failed with HTTP ${response.status}`);
        }
        const payload = await response.json();
        if (mounted) {
          const loadedRecords = Array.isArray(payload.records) ? payload.records : [];
          if (!loadedRecords.length) {
            throw new Error('AskAI index is empty or malformed.');
          }
          setRecords(loadedRecords);
          setSearchIndex(createSearchIndex(loadedRecords));
        }
      } catch (error) {
        if (mounted) {
          setRecords([]);
          setSearchIndex(null);
          setLoadError(error?.message || 'Could not load AskAI index.');
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

    if (!searchIndex) {
      setMessages((current) => [
        ...current,
        { role: 'user', text: trimmed, sources: [] },
        {
          role: 'assistant',
          text: 'AskAI is unavailable right now because the local index did not load. Please refresh the page, then try again.',
          confidence: {
            label: 'Low',
            value: 0.1,
            reason: loadError || 'Local docs index not loaded.',
          },
          sources: [],
        },
      ]);
      return;
    }

    const searchId = createEventId();
    const startedAt = typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();
    const previousUserQuestions = messages
      .filter((message) => message.role === 'user')
      .slice(-2)
      .map((message) => message.text)
      .join(' ');
    const usedFollowUpContext = isLikelyFollowUpQuestion(trimmed);
    const contextualQuery = usedFollowUpContext
      ? `${trimmed} ${previousUserQuestions}`.trim()
      : trimmed;

    const isReleaseCountQuery = isCountQuestion(trimmed)
      && (isReleaseNotesQuestion(trimmed) || hasReleaseContext(messages));

    if (isReleaseCountQuery) {
      const releaseNotesCount = getReleaseNotesCount(records);
      const results = [
        {
          title: 'Release Notes',
          heading: 'Overview',
          text: `There are ${releaseNotesCount} release notes pages in the docs.`,
          url: '/docs/release-notes/',
          score: 1,
          category: 'release-notes',
          coverage: 1,
        },
      ];
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

      const searchEvent = trackSearch(trimmed, results, assistantMessage.confidence, {
        searchId,
        contextualQuery: trimmed,
        answerType: 'count',
        sourceCount: assistantMessage.sources.length,
        usedFollowUpContext: false,
        latencyMs: 0,
      });
      assistantMessage.searchEvent = searchEvent;

      setMessages((current) => [
        ...current,
        { role: 'user', text: trimmed, sources: [] },
        assistantMessage,
      ]);
      return;
    }

    const results = rankRecords(searchIndex, contextualQuery);
    const confidence = getConfidence(results, trimmed);
    const answerPayload = buildAnswerPayload(results, confidence, trimmed);
    const sources = shouldAbstain(results, confidence, trimmed)
      ? []
      : results.slice(0, 1).map((item) => ({
          label: `${item.title} — ${item.heading}`,
          url: item.url,
        }));
    const searchEvent = trackSearch(trimmed, results, confidence, {
      searchId,
      contextualQuery,
      answerType: answerPayload.answerType,
      sourceCount: sources.length,
      usedFollowUpContext,
      latencyMs: (typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now()) - startedAt,
    });

    const assistantMessage = {
      role: 'assistant',
      text: answerPayload.text,
      confidence,
      sources,
      searchEvent,
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
        {enableInternalAnalytics ? (
          <p>
            Use the <Link to="/dev-dashboard">Dev Dashboard</Link> Ask AI Analytics tile to review failed-search aggregates and export to CSV/Google Sheets.
          </p>
        ) : null}

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
                disabled={isLoading || !searchIndex}
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
                    {message.sources.slice(0, 4).map((source, sourceIndex) => (
                      <li key={`${source.url}-${source.label}`}>
                        <Link to={source.url} onClick={() => trackSourceClick(message.searchEvent, source, sourceIndex)}>{source.label}</Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ))}

          {isLoading ? <p>Loading local docs index…</p> : null}
          {!isLoading && loadError ? (
            <p style={{ color: 'var(--ifm-color-danger-dark)', fontWeight: 600 }}>
              AskAI index failed to load: {loadError}
            </p>
          ) : null}
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
            <button type="submit" className="button button--primary" disabled={isLoading || !searchIndex}>
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

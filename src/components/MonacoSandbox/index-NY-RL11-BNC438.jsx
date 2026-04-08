import React, { useState, useRef } from 'react';
import BrowserOnly from '@docusaurus/BrowserOnly';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

// ---------------------------------------------------------------------------
// V2 Monaco telemetry helpers (dev-only, stored in localStorage)
// ---------------------------------------------------------------------------
const MONACO_V2_KEY = 'monaco.v2-telemetry-events';
const MAX_MONACO_EVENTS = 300;

function createMonacoEventId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `mon-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getMonacoSessionId() {
  if (typeof window === 'undefined') return 'ssr';
  try {
    const key = 'monaco.session-id';
    const existing = window.sessionStorage.getItem(key);
    if (existing) return existing;
    const next = createMonacoEventId();
    window.sessionStorage.setItem(key, next);
    return next;
  } catch {
    return 'unavailable';
  }
}

function emitMonacoTelemetry(eventType, extra = {}) {
  if (typeof window === 'undefined') return;
  try {
    const now = new Date();
    const event = {
      eventId: createMonacoEventId(),
      eventTimestamp: now.toISOString(),
      snapshotDate: now.toISOString().slice(0, 10),
      environment: 'dev',
      eventType,
      sessionId: getMonacoSessionId(),
      docUrl: window.location.pathname,
      ...extra,
    };
    const existing = JSON.parse(window.localStorage.getItem(MONACO_V2_KEY) || '[]');
    const next = [event, ...existing].slice(0, MAX_MONACO_EVENTS);
    window.localStorage.setItem(MONACO_V2_KEY, JSON.stringify(next));
  } catch {
    // Never block editor functionality over telemetry.
  }
}

export default function MonacoSandbox({
  language = 'javascript',
  value = '',
  height = '320px',
}) {
  const {siteConfig} = useDocusaurusContext();
  const enableTelemetry = Boolean(siteConfig?.customFields?.enableInternalAnalytics);
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const editorRef = useRef(null);
  const originalLogRef = useRef(console.log);
  const originalValueRef = useRef(value);
  const mountStartRef = useRef(Date.now());

  const outerFrameStyle = {
    border: '0.5px solid #000',
    padding: '8px',
    backgroundColor: '#fff',
  };

  const buttonStyle = {
    padding: '8px 16px',
    marginBottom: '8px',
    marginRight: '8px',
    backgroundColor: '#007ACC',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
  };

  const outputStyle = {
    marginTop: '8px',
    padding: '8px',
    backgroundColor: '#1e1e1e',
    color: '#d4d4d4',
    borderRadius: '4px',
    fontFamily: 'monospace',
    fontSize: '12px',
    maxHeight: '200px',
    overflowY: 'auto',
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word',
  };

  const runCode = () => {
    if (!editorRef.current) return;

    setIsRunning(true);
    setOutput('Running...\n');

    try {
      const code = editorRef.current.getValue();
      const logs = [];

      // Capture console.log
      const originalLog = console.log;
      console.log = (...args) => {
        logs.push(args.map(arg => {
          if (typeof arg === 'object') {
            return JSON.stringify(arg, null, 2);
          }
          return String(arg);
        }).join(' '));
        originalLog(...args);
      };

      // Execute the code
      const func = new Function(code);
      func();

      // Restore console.log
      console.log = originalLog;

      setOutput(logs.length > 0 ? logs.join('\n') : 'Code executed successfully (no output)');
    } catch (error) {
      setOutput(`Error: ${error.message}\n\nStack:\n${error.stack}`);
      if (enableTelemetry) {
        emitMonacoTelemetry('runtime_exception', {
          exceptionName: error.name || 'Error',
          exceptionMessage: error.message || '',
        });
      }
    } finally {
      setIsRunning(false);
    }
  };

  const clearCode = () => {
    if (!editorRef.current) return;
    editorRef.current.setValue(originalValueRef.current);
    setOutput('');
  };

  return (
    <div style={outerFrameStyle}>
      <div>
        <button 
          onClick={runCode} 
          style={buttonStyle}
          disabled={isRunning}
        >
          {isRunning ? 'Running...' : 'Run Code'}
        </button>
        <button 
          onClick={clearCode} 
          style={{...buttonStyle, backgroundColor: '#d9534f'}}
        >
          Clear
        </button>
      </div>
      <BrowserOnly fallback={<div>Loading editor…</div>}>
        {() => {
          const Editor = require('@monaco-editor/react').default;
          return (
            <>
              <Editor
                height={height}
                defaultLanguage={language}
                defaultValue={value}
                theme="vs-dark"
                onMount={(editor) => {
                  editorRef.current = editor;
                  if (enableTelemetry) {
                    emitMonacoTelemetry('load_success', {
                      editorInitMs: Math.max(0, Date.now() - mountStartRef.current),
                    });
                  }
                }}
                options={{
                  minimap: {enabled: false},
                  fontSize: 13,
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                }}
              />
              {output && <div style={outputStyle}>{output}</div>}
            </>
          );
        }}
      </BrowserOnly>
    </div>
  );
}
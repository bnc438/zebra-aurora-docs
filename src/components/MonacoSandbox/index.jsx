import React, { useState, useRef } from 'react';
import BrowserOnly from '@docusaurus/BrowserOnly';

export default function MonacoSandbox({
  language = 'javascript',
  value = '',
  height = '320px',
}) {
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const editorRef = useRef(null);
  const originalLogRef = useRef(console.log);
  const originalValueRef = useRef(value);

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
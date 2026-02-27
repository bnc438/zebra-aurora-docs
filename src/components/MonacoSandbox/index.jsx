import React from 'react';
import BrowserOnly from '@docusaurus/BrowserOnly';

export default function MonacoSandbox({
  language = 'javascript',
  value = '',
  height = '320px',
}) {
  const outerFrameStyle = {
    border: '0.5px solid #000',
    padding: '8px',
    backgroundColor: '#fff',
  };

  return (
    <div style={outerFrameStyle}>
      <BrowserOnly fallback={<div>Loading editor…</div>}>
        {() => {
          const Editor = require('@monaco-editor/react').default;
          return (
            <Editor
              height={height}
              defaultLanguage={language}
              defaultValue={value}
              theme="vs-dark"
              options={{
                minimap: {enabled: false},
                fontSize: 13,
                scrollBeyondLastLine: false,
                automaticLayout: true,
              }}
            />
          );
        }}
      </BrowserOnly>
    </div>
  );
}
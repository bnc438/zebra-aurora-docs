import React from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';

export default function DownloadSectionPdfButton({fileName, label = 'Download PDF'}) {
  const href = useBaseUrl(`/pdf/${fileName}`);

  return (
    <a
      className="pagination-nav__link download-pdf-link"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      <span className="download-pdf-link__text">{label}</span>
    </a>
  );
}

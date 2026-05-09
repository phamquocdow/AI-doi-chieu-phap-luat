import React from 'react';
import PdfJsViewer from './PdfJsViewer';

export default function DocumentPaperView({ pdfUrlA, pdfUrlB, details, highlightEnabled = true }) {
  return (
    <div className="lc-doc-wrap">
      <div className="lc-doc-grid">
        <PdfJsViewer
          pdfUrl={pdfUrlA}
          details={details}
          side="a"
          label="Bản 1"
          accentColor="gray"
          highlightEnabled={highlightEnabled}
        />
        <PdfJsViewer
          pdfUrl={pdfUrlB}
          details={details}
          side="b"
          label="Bản 2"
          accentColor="gray"
          highlightEnabled={highlightEnabled}
        />
      </div>

      <style>{`
        .lc-doc-wrap {
          overflow-x: auto;
          padding-bottom: 0.5rem;
          scrollbar-width: thin;
          scrollbar-color: gray gray;
        }
        .lc-doc-grid {
          display: grid;
          grid-template-columns: minmax(520px, 1fr) minmax(520px, 1fr);
          gap: 1.25rem;
          min-width: 1080px;
        }
      `}</style>
    </div>
  );
}

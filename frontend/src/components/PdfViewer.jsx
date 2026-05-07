import { useEffect, useRef, useState } from "react";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.js?url";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const PdfViewer = ({ url, highlights = [], highlightColor = "rgba(255,245,157,0.28)" }) => {
  const containerRef = useRef(null);
  const pdfRef = useRef(null);
  const renderToken = useRef(0);
  const [scale, setScale] = useState(1.12);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);

  const resetContainer = () => {
    const container = containerRef.current;
    if (container) container.innerHTML = "";
  };

  const updateCurrentPage = () => {
    const container = containerRef.current;
    if (!container) return setCurrentPage(0);
    const probe = container.scrollTop + container.clientHeight * 0.2;
    const pages = Array.from(container.querySelectorAll(".pdf-page"));
    let cp = 0;
    for (const node of pages) {
      if (node.offsetTop <= probe) cp = Number(node.dataset.page) || cp;
      else break;
    }
    setCurrentPage(cp || (pages.length ? 1 : 0));
  };

  const goToPage = (n) => {
    const container = containerRef.current;
    if (!container) return;
    const node = container.querySelector(`.pdf-page[data-page="${n}"]`);
    if (!node) return;
    container.scrollTo({ top: Math.max(0, node.offsetTop - 12), behavior: "smooth" });
  };

  const renderAllPages = async (token) => {
    const container = containerRef.current;
    const pdf = pdfRef.current;
    if (!container || !pdf) return;

    const previousRatio = container.scrollHeight > container.clientHeight ? container.scrollTop / Math.max(1, container.scrollHeight - container.clientHeight) : 0;

    container.innerHTML = "";

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      if (token !== renderToken.current) return;

      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      const outputScale = window.devicePixelRatio || 1;

      const pageWrap = document.createElement("div");
      pageWrap.className = "pdf-page";
      pageWrap.dataset.page = String(pageNumber);
      pageWrap.style.position = "relative";
      pageWrap.style.marginBottom = "12px";

      const canvas = document.createElement("canvas");
      canvas.className = "pdf-page-canvas";
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      canvas.style.display = "block";

      const ctx = canvas.getContext("2d");

      const textLayerDiv = document.createElement("div");
      textLayerDiv.className = "pdf-text-layer";
      textLayerDiv.style.position = "absolute";
      textLayerDiv.style.top = "0";
      textLayerDiv.style.left = "0";
      textLayerDiv.style.right = "0";
      textLayerDiv.style.bottom = "0";
      textLayerDiv.style.pointerEvents = "none";
      textLayerDiv.style.color = "transparent";

      pageWrap.appendChild(canvas);
      pageWrap.appendChild(textLayerDiv);
      container.appendChild(pageWrap);

      await page.render({ canvasContext: ctx, viewport, transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null }).promise;

      // build text layer (approximate positions) for phrase-based highlights
      try {
        const textContent = await page.getTextContent();
        textContent.items.forEach((item) => {
          const transform = item.transform;
          const fontHeight = Math.hypot(transform[2], transform[3]);
          const tx = transform[4] || 0;
          const ty = transform[5] || 0;

          const span = document.createElement("span");
          span.textContent = item.str;
          span.style.whiteSpace = "pre";
          span.style.position = "absolute";
          span.style.left = `${(tx / viewport.width) * 100}%`;
          span.style.top = `${ty - fontHeight}px`;
          span.style.transform = `matrix(${transform[0]},${transform[1]},${transform[2]},${transform[3]},0,0)`;
          span.style.transformOrigin = "0% 0%";
          span.style.fontSize = `${fontHeight}px`;
          span.style.pointerEvents = "auto";
          textLayerDiv.appendChild(span);
        });
      } catch (err) {
        // ignore text layer errors
      }

      // render phrase highlights
      if (Array.isArray(highlights) && highlights.length) {
        requestAnimationFrame(() => {
          const phrases = [...new Set(highlights.filter(Boolean).map((h) => (typeof h === 'string' ? h.trim() : '')).filter(Boolean))];
          const spans = Array.from(textLayerDiv.querySelectorAll('span'));
          spans.forEach((span) => {
            const originalText = span.textContent || '';
            phrases.forEach((phrase) => {
              if (!phrase) return;
              const lowerText = originalText.toLowerCase();
              const lowerPhrase = phrase.toLowerCase();
              let startIndex = 0;
              while (true) {
                const matchIndex = lowerText.indexOf(lowerPhrase, startIndex);
                if (matchIndex === -1) break;
                const range = document.createRange();
                const textNode = span.firstChild;
                if (!textNode) break;
                range.setStart(textNode, matchIndex);
                range.setEnd(textNode, matchIndex + phrase.length);
                const rects = range.getClientRects();
                for (const rect of rects) {
                  const highlight = document.createElement('div');
                  const parentRect = pageWrap.getBoundingClientRect();
                  highlight.style.position = 'absolute';
                  highlight.style.left = `${rect.left - parentRect.left}px`;
                  highlight.style.top = `${rect.top - parentRect.top}px`;
                  highlight.style.width = `${rect.width}px`;
                  highlight.style.height = `${rect.height}px`;
                  highlight.style.background = highlightColor;
                  highlight.style.opacity = '0.45';
                  highlight.style.pointerEvents = 'none';
                  highlight.style.borderRadius = '3px';
                  pageWrap.appendChild(highlight);
                }
                startIndex = matchIndex + phrase.length;
              }
            });
          });
        });
      }
    }

    if (previousRatio) {
      container.scrollTop = previousRatio * Math.max(0, container.scrollHeight - container.clientHeight);
    } else {
      container.scrollTop = 0;
    }

    updateCurrentPage();
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!url) {
        resetContainer();
        pdfRef.current = null;
        setNumPages(0);
        return;
      }

      try {
        renderToken.current += 1;
        const token = renderToken.current;
        const loadingTask = getDocument(url);
        const pdf = await loadingTask.promise;
        if (cancelled || token !== renderToken.current) return;
        pdfRef.current = pdf;
        setNumPages(pdf.numPages || 0);
        await renderAllPages(token);
        const container = containerRef.current;
        if (container) container.addEventListener('scroll', updateCurrentPage);
      } catch (err) {
        console.error('PDF load error', err);
        pdfRef.current = null;
      }
    };

    load();

    return () => {
      cancelled = true;
      renderToken.current += 1;
      const container = containerRef.current;
      if (container) container.removeEventListener('scroll', updateCurrentPage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  // re-render pages when scale or highlights change
  useEffect(() => {
    if (!pdfRef.current) return;
    renderToken.current += 1;
    const token = renderToken.current;
    renderAllPages(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale, JSON.stringify(highlights)]);

  const zoomIn = () => setScale((s) => Math.min(3, +(s * 1.2).toFixed(2)));
  const zoomOut = () => setScale((s) => Math.max(0.5, +(s / 1.2).toFixed(2)));
  const fitWidth = () => {
    const container = containerRef.current;
    if (!container) return;
    const firstPage = container.querySelector('.pdf-page-canvas');
    if (!firstPage) return;
    const canvasWidth = firstPage.clientWidth || firstPage.offsetWidth || 800;
    const available = Math.max(200, container.clientWidth - 24);
    setScale((available / canvasWidth) || 1.0);
  };

  return (
    <div className="pdf-root" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="pdf-toolbar">
        <div className="pdf-title">Preview</div>
        <div className="pdf-controls">
          <button className="btn" onClick={() => goToPage(Math.max(1, currentPage - 1))} title="Previous">◀</button>
          <div className="page-indicator">
            <input type="number" min={1} max={numPages || 1} value={currentPage || ''} onChange={(e) => { const v = Number(e.target.value); if (v >= 1) goToPage(v); }} />
            <span>/</span>
            <span className="page-count">{numPages}</span>
          </div>
          <button className="btn" onClick={() => goToPage(Math.min(numPages || 1, (currentPage || 1) + 1))} title="Next">▶</button>
          <div className="sep" />
          <button className="btn" onClick={zoomOut} title="Zoom out">−</button>
          <button className="btn" onClick={zoomIn} title="Zoom in">+</button>
          <button className="btn" onClick={fitWidth} title="Fit width">Fit</button>
          <div className="sep" />
          <div className="scale-label">{Math.round(scale * 100)}%</div>
        </div>
      </div>

      <div className="pdf-wrapper" style={{ flex: 1, overflow: 'auto', padding: 12, background: 'var(--bg-secondary)' }} ref={containerRef} />
    </div>
  );
};

export default PdfViewer;

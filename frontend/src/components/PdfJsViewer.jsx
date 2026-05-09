import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

const BASE_URL = 'http://localhost:8000';

// Side A = old doc (red highlights), Side B = new doc (blue highlights)
const HL_FILL  = { a: 'rgba(239,68,68,0.22)',  b: 'rgba(14,165,233,0.22)' };
const HL_BORDER = { a: 'rgba(239,68,68,0.70)', b: 'rgba(14,165,233,0.70)' };

function buildFlat(items) {
  let flat = '';
  const charMap = [];
  for (let ti = 0; ti < items.length; ti++) {
    const s = items[ti].str || '';
    for (const ch of s) { charMap.push(ti); flat += ch; }
    if (s.length) { charMap.push(ti); flat += ' '; }
  }
  return { flat, charMap };
}

function indicesToRects(indexSet, items, viewport) {
  const lineMap = new Map();
  for (const ti of indexSet) {
    const it = items[ti];
    if (!it?.transform) continue;
    const key = Math.round(it.transform[5]);
    if (!lineMap.has(key)) lineMap.set(key, []);
    lineMap.get(key).push(ti);
  }
  const rects = [];
  for (const tiList of lineMap.values()) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const ti of tiList) {
      const { transform: [, , , , tx, ty], width: w = 0, height: h = 10 } = items[ti];
      const [vx1, vy1] = viewport.convertToViewportPoint(tx, ty);
      const [vx2, vy2] = viewport.convertToViewportPoint(tx + w, ty + h);
      x0 = Math.min(x0, vx1, vx2); y0 = Math.min(y0, vy1, vy2);
      x1 = Math.max(x1, vx1, vx2); y1 = Math.max(y1, vy1, vy2);
    }
    if (isFinite(x0) && x1 > x0 && y1 > y0)
      rects.push({ x: x0, y: y0, width: x1 - x0, height: y1 - y0 });
  }
  return rects;
}

function findPhraseRects(items, phrase, viewport) {
  if (!phrase || phrase.trim().length < 2 || items.length === 0) return [];
  const { flat, charMap } = buildFlat(items);
  const normalised = phrase.replace(/\s+/g, ' ').trim();
  let re;
  try {
    const src = normalised
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/ /g, '\\s+');
    re = new RegExp(src, 'gi');
  } catch (_) { return []; }
  const rects = [];
  let m;
  while ((m = re.exec(flat)) !== null) {
    const idx = m.index, end = idx + m[0].length;
    const set = new Set();
    for (let ci = idx; ci < end && ci < charMap.length; ci++) set.add(charMap[ci]);
    rects.push(...indicesToRects(set, items, viewport));
    if (!m[0].length) re.lastIndex++;
  }
  return rects;
}

function addBox(overlay, rect, side) {
  const box = document.createElement('div');
  box.style.cssText = `
    position:absolute;
    left:${Math.max(0, rect.x)}px;
    top:${Math.max(0, rect.y)}px;
    width:${Math.max(4, rect.width)}px;
    height:${Math.max(4, rect.height)}px;
    background:${HL_FILL[side]};
    border:1.5px solid ${HL_BORDER[side]};
    border-radius:2px;
    pointer-events:none;
  `;
  overlay.appendChild(box);
}

export default function PdfJsViewer({ pdfUrl, details, side, label, accentColor, highlightEnabled = true }) {
  const wrapperRef = useRef(null);
  const pagesRootRef = useRef(null);
  const initialRenderedRef = useRef(false);
  const [pageNum, setPageNum] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [scale, setScale] = useState(0.8);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const keywords = React.useMemo(() => {
    const set = new Set();
    for (const item of (details || [])) {
      if (item.clause_change_type === 'unchanged') continue;
      const list = side === 'a' ? (item.citations_a || []) : (item.citations_b || []);
      for (const kw of list) {
        const k = (kw || '').replace(/\s+/g, ' ').trim();
        if (k.length >= 2) set.add(k);
      }
    }
    return [...set];
  }, [details, side]);

  const renderPdf = useCallback(async () => {
    if (!pdfUrl || !pagesRootRef.current) return;
    setLoading(true); setError(null);
    const root = pagesRootRef.current;
    root.innerHTML = '';
    try {
      const fullUrl = pdfUrl.startsWith('http') ? pdfUrl : `${BASE_URL}${pdfUrl}`;
      const pdfDoc = await pdfjsLib.getDocument(fullUrl).promise;
      setPageCount(pdfDoc.numPages);
      for (let pn = 1; pn <= pdfDoc.numPages; pn++) {
        const page = await pdfDoc.getPage(pn);
        const viewport = page.getViewport({ scale });
        const dpr = window.devicePixelRatio || 1;
        const pageNode = document.createElement('div');
        pageNode.className = 'lc-pdf-page';
        pageNode.dataset.page = String(pn);
        pageNode.style.cssText = `
          position:relative;width:${viewport.width}px;height:${viewport.height}px;
          margin:0 auto 12px;background:#fff;
          box-shadow:0 2px 12px rgba(0,0,0,.18);flex-shrink:0;border-radius:3px;
        `;
        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        const overlay = document.createElement('div');
        overlay.style.cssText = `position:absolute;top:0;left:0;width:${viewport.width}px;height:${viewport.height}px;pointer-events:none;`;
        pageNode.appendChild(canvas);
        pageNode.appendChild(overlay);
        root.appendChild(pageNode);
        const ctx = canvas.getContext('2d');
        if (dpr !== 1) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        await page.render({ canvasContext: ctx, viewport }).promise;
        if (highlightEnabled && keywords.length > 0) {
          try {
            const tc = await page.getTextContent();
            const items = tc.items.filter(it => it.str && it.str.trim());
            for (const kw of keywords) {
              const rects = findPhraseRects(items, kw, viewport);
              for (const r of rects) addBox(overlay, r, side);
            }
          } catch (_) { /* image-based PDF */ }
        }
      }
      setPageNum(1);
      if (!initialRenderedRef.current) {
        initialRenderedRef.current = true;
        setTimeout(() => { try { renderPdf(); } catch (_) {} }, 120);
      }
    } catch (err) {
      console.error('PdfJsViewer:', err);
      setError('Không thể tải PDF. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, [pdfUrl, keywords, side, scale]);

  useEffect(() => { renderPdf(); }, [renderPdf]);

  const handleScroll = useCallback(() => {
    const w = wrapperRef.current, r = pagesRootRef.current;
    if (!w || !r) return;
    const probe = w.scrollTop + w.clientHeight * 0.2;
    let cur = 1;
    r.querySelectorAll('.lc-pdf-page').forEach(n => {
      if (n.offsetTop <= probe) cur = Number(n.dataset.page);
    });
    setPageNum(cur);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      {/* Header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        padding: '0.6rem 1rem',
        background: accentColor,
        borderRadius: '0.6rem 0.6rem 0 0',
        fontWeight: 700, fontSize: '0.85rem', color: '#fff',
        userSelect: 'none', flexShrink: 0,
      }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,.8)', flexShrink: 0 }} />
        {label}

        {/* Zoom controls */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.2rem',
          marginLeft: 'auto', marginRight: '0.75rem',
          background: 'rgba(0,0,0,.18)', padding: '2px 6px', borderRadius: '6px'
        }}>
          <button onClick={() => setScale(p => Math.max(0.4, p - 0.1))}
            style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', padding: '2px' }} title="Thu nhỏ">
            <ZoomOut size={15} />
          </button>
          <span style={{ fontSize: '0.72rem', minWidth: '34px', textAlign: 'center' }}>{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(p => Math.min(2.5, p + 0.1))}
            style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', padding: '2px' }} title="Phóng to">
            <ZoomIn size={15} />
          </button>
          <button onClick={() => setScale(0.8)}
            style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', padding: '2px', marginLeft: '4px', borderLeft: '1px solid rgba(255,255,255,.25)', paddingLeft: '8px' }} title="Đặt lại">
            <Maximize size={14} />
          </button>
        </div>

        <span style={{ fontWeight: 400, fontSize: '0.78rem', opacity: 0.82 }}>
          {loading ? 'Đang tải…' : error ? '⚠ Lỗi' : `${pageNum} / ${pageCount}`}
        </span>
      </div>

      {/* Scroll area */}
      <div
        ref={wrapperRef}
        onScroll={handleScroll}
        style={{
          height: '720px', overflowY: 'scroll', overflowX: 'auto',
          border: `1.5px solid ${accentColor}55`, borderTop: 'none',
          borderRadius: '0 0 0.6rem 0.6rem',
          background: '#e8eff8', padding: '1rem 0.75rem',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}
      >
        {error && (
          <div style={{
            color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: '0.5rem', padding: '1rem 1.5rem',
            fontFamily: 'Segoe UI,sans-serif', fontSize: '0.88rem',
          }}>{error}</div>
        )}
        <div ref={pagesRootRef} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }} />
      </div>
    </div>
  );
}

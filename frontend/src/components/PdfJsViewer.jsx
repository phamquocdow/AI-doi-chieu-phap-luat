import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

const BASE_URL = 'http://localhost:8000';

const HL_FILL = {
  a: 'rgba(239,68,68,0.13)',
  b: 'rgba(29,78,216,0.12)',
};

const HL_BORDER = {
  a: 'rgba(220,38,38,0.18)',
  b: 'rgba(29,78,216,0.18)',
};

const HL_DOT = {
  a: '#dc2626',
  b: '#1d4ed8',
};

const HL_STRIKE = '#ef4444';

// ─────────────────────────────────────────────────────────────
// LCS
// ─────────────────────────────────────────────────────────────

function tokenize(text) {
  return text ? text.split(/(\s+)/) : [];
}

function lcs(a, b) {
  const m = a.length;
  const n = b.length;

  const matrix = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0)
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      matrix[i][j] =
        a[i - 1] === b[j - 1]
          ? matrix[i - 1][j - 1] + 1
          : Math.max(matrix[i - 1][j], matrix[i][j - 1]);
    }
  }

  const result = [];

  let i = m;
  let j = n;

  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.unshift({
        type: 'equal',
        value: a[i - 1],
      });

      i--;
      j--;
    } else if (matrix[i - 1][j] >= matrix[i][j - 1]) {
      result.unshift({
        type: 'delete',
        value: a[i - 1],
      });

      i--;
    } else {
      result.unshift({
        type: 'insert',
        value: b[j - 1],
      });

      j--;
    }
  }

  while (i > 0) {
    result.unshift({
      type: 'delete',
      value: a[i - 1],
    });

    i--;
  }

  while (j > 0) {
    result.unshift({
      type: 'insert',
      value: b[j - 1],
    });

    j--;
  }

  return result;
}

// ─────────────────────────────────────────────────────────────
// PDF helpers
// ─────────────────────────────────────────────────────────────

function buildFlat(items) {
  let flat = '';
  const charMap = [];

  for (let ti = 0; ti < items.length; ti++) {
    const s = items[ti].str || '';

    for (const ch of s) {
      charMap.push(ti);
      flat += ch;
    }

    if (s.length) {
      charMap.push(ti);
      flat += ' ';
    }
  }

  return { flat, charMap };
}

function findContextBounds(flat, chunkText) {
  if (!chunkText) return null;
  const cleanChunk = chunkText.replace(/\s+/g, ' ').trim();
  if (cleanChunk.length < 10) return null;

  // 1. Khớp chính xác toàn bộ (dùng regex linh hoạt khoảng trắng)
  const fullSrc = cleanChunk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
  try {
    const fullRe = new RegExp(fullSrc, 'gi');
    const m = fullRe.exec(flat);
    if (m) return { start: m.index, end: m.index + m[0].length };
  } catch (e) { }

  // 2. Fallback: Dùng mỏ neo đầu + cuối (Anchor-based)
  // Nếu giữa đoạn có ký tự lạ, vẫn tìm được vùng bao quanh dựa vào đầu/cuối đoạn
  const ANCHOR_LEN = Math.min(40, Math.floor(cleanChunk.length / 2));
  const startAnchor = cleanChunk.slice(0, ANCHOR_LEN).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
  const endAnchor = cleanChunk.slice(-ANCHOR_LEN).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
  let startIdx = -1, endIdx = -1;
  try {
    const startRe = new RegExp(startAnchor, 'gi');
    const startMatch = startRe.exec(flat);
    if (startMatch) startIdx = startMatch.index;

    const endRe = new RegExp(endAnchor, 'gi');
    if (startIdx !== -1) endRe.lastIndex = startIdx;
    const endMatch = endRe.exec(flat);
    if (endMatch) endIdx = endMatch.index + endMatch[0].length;
  } catch (e) { }

  if (startIdx !== -1 && endIdx !== -1) return { start: startIdx, end: endIdx };
  else if (startIdx !== -1) return { start: startIdx, end: Math.min(flat.length, startIdx + cleanChunk.length + 100) };
  else if (endIdx !== -1) return { start: Math.max(0, endIdx - cleanChunk.length - 100), end: endIdx };

  // 3. Fallback: Tìm theo câu dài nhất bên trong chunk
  const sentences = cleanChunk.split(/[.?!]\s/).filter(s => s.length > 25);
  for (const s of sentences) {
    const sAnchor = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
    try {
      const sRe = new RegExp(sAnchor, 'gi');
      const sMatch = sRe.exec(flat);
      if (sMatch) {
        return {
          start: Math.max(0, sMatch.index - 150),
          end: Math.min(flat.length, sMatch.index + sMatch[0].length + 150)
        };
      }
    } catch (e) { }
  }

  return null;
}

function indicesToRects(indexSet, items, viewport) {
  const lineMap = new Map();

  for (const ti of indexSet) {
    const it = items[ti];

    if (!it?.transform) continue;

    const key = Math.round(it.transform[5]);

    if (!lineMap.has(key)) {
      lineMap.set(key, []);
    }

    lineMap.get(key).push(ti);
  }

  const rects = [];

  for (const tiList of lineMap.values()) {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;

    for (const ti of tiList) {
      const {
        transform: [, , , , tx, ty],
        width: w = 0,
        height: h = 10,
      } = items[ti];

      const [vx1, vy1] = viewport.convertToViewportPoint(tx, ty);

      const [vx2, vy2] = viewport.convertToViewportPoint(
        tx + w,
        ty + h
      );

      x0 = Math.min(x0, vx1, vx2);
      y0 = Math.min(y0, vy1, vy2);

      x1 = Math.max(x1, vx1, vx2);
      y1 = Math.max(y1, vy1, vy2);
    }

    if (isFinite(x0) && x1 > x0 && y1 > y0) {
      rects.push({
        x: x0,
        y: y0,
        width: x1 - x0,
        height: y1 - y0,
      });
    }
  }

  return rects;
}

function getBoundsRects(bounds, items, flatData, viewport) {
  if (!bounds) return [];

  const { charMap } = flatData;

  const set = new Set();

  const start = Math.max(0, bounds.start);
  const end = Math.min(charMap.length, bounds.end);

  for (let ci = start; ci < end; ci++) {
    if (charMap[ci] !== undefined) {
      set.add(charMap[ci]);
    }
  }

  return indicesToRects(set, items, viewport);
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
    border:1px solid ${HL_BORDER[side]};
    border-radius:3px;
    pointer-events:none;
  `;

  if (side === 'a') {
    const strike = document.createElement('div');

    strike.style.cssText = `
      position:absolute;
      top:50%;
      left:0;
      width:100%;
      height:1.5px;
      background:${HL_STRIKE};
      transform:translateY(-50%);
      opacity:0.75;
    `;

    box.appendChild(strike);
  }

  overlay.appendChild(box);
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export default function PdfJsViewer({
  pdfUrl,
  details,
  side,
  label,
  accentColor,
  highlightEnabled = true,
}) {
  const wrapperRef = useRef(null);
  const pagesRootRef = useRef(null);

  // FIX render double React StrictMode
  const renderIdRef = useRef(0);

  const [pageNum, setPageNum] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [scale, setScale] = useState(0.8);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const highlightItems = useMemo(() => {
    const results = [];

    for (const item of details || []) {
      const type = item.clause_change_type;

      if (type === 'unchanged') continue;

      const chunkText =
        side === 'a'
          ? item.content_a
          : item.content_b;

      if (!chunkText) continue;

      if (
        (type === 'added' && side === 'b') ||
        (type === 'deleted' && side === 'a')
      ) {
        results.push({
          chunkText,
          isFullChunk: true,
        });

        continue;
      }

      if (type === 'modified' && item._lcsDiff) {
        results.push({
          chunkText,
          isFullChunk: false,
          diffTokens: item._lcsDiff,
        });
      }
    }

    return results;
  }, [details, side]);

  const renderPdf = useCallback(async () => {
    if (!pdfUrl || !pagesRootRef.current) return;

    const currentRenderId = ++renderIdRef.current;

    setLoading(true);
    setError(null);

    const root = pagesRootRef.current;

    root.innerHTML = '';

    try {
      const fullUrl = pdfUrl.startsWith('http')
        ? pdfUrl
        : `${BASE_URL}${pdfUrl}`;

      const pdfDoc = await pdfjsLib.getDocument(fullUrl).promise;

      if (currentRenderId !== renderIdRef.current) return;

      setPageCount(pdfDoc.numPages);

      for (let pn = 1; pn <= pdfDoc.numPages; pn++) {
        if (currentRenderId !== renderIdRef.current) return;

        const page = await pdfDoc.getPage(pn);

        const viewport = page.getViewport({ scale });

        const dpr = window.devicePixelRatio || 1;

        const pageNode = document.createElement('div');

        pageNode.className = 'lc-pdf-page';

        pageNode.dataset.page = String(pn);

        pageNode.style.cssText = `
          position:relative;
          width:${viewport.width}px;
          height:${viewport.height}px;
          margin:0 auto 12px;
          background:#fff;
          box-shadow:0 2px 12px rgba(0,0,0,.18);
          flex-shrink:0;
        `;

        const canvas = document.createElement('canvas');

        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);

        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        const overlay = document.createElement('div');

        overlay.style.cssText = `
          position:absolute;
          top:0;
          left:0;
          width:${viewport.width}px;
          height:${viewport.height}px;
          pointer-events:none;
        `;

        pageNode.appendChild(canvas);
        pageNode.appendChild(overlay);

        root.appendChild(pageNode);

        const ctx = canvas.getContext('2d');

        if (dpr !== 1) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        await page.render({
          canvasContext: ctx,
          viewport,
        }).promise;

        if (currentRenderId !== renderIdRef.current) return;

        if (highlightEnabled && highlightItems.length > 0) {
          try {
            const tc = await page.getTextContent();

            const pgItems = tc.items.filter(
              (it) => it.str && it.str.trim()
            );

            const flatData = buildFlat(pgItems);

            const { flat, charMap } = flatData;

            for (const item of highlightItems) {
              const bounds = findContextBounds(
                flat,
                item.chunkText
              );

              if (!bounds) continue;

              if (item.isFullChunk) {
                const rects = getBoundsRects(
                  bounds,
                  pgItems,
                  flatData,
                  viewport
                );

                for (const r of rects) {
                  addBox(overlay, r, side);
                }
              } else if (item.diffTokens) {
                let pos = 0;

                for (const token of item.diffTokens) {
                  const isMatchSide =
                    (side === 'a' &&
                      token.type === 'delete') ||
                    (side === 'b' &&
                      token.type === 'insert');

                  const advancesPos =
                    token.type === 'equal' ||
                    isMatchSide;

                  if (isMatchSide) {
                    const text = (
                      token.value || ''
                    ).trim();

                    if (
                      text.length >= 1 &&
                      /\w/.test(text)
                    ) {
                      const start = bounds.start + pos;

                      const end =
                        start + token.value.length;

                      const set = new Set();

                      for (
                        let ci = start;
                        ci < end &&
                        ci < charMap.length;
                        ci++
                      ) {
                        if (
                          charMap[ci] !== undefined
                        ) {
                          set.add(charMap[ci]);
                        }
                      }

                      const rects = indicesToRects(
                        set,
                        pgItems,
                        viewport
                      );

                      for (const r of rects) {
                        addBox(overlay, r, side);
                      }
                    }
                  }

                  if (advancesPos) {
                    pos += token.value.length;
                  }
                }
              }
            }
          } catch (e) {
            console.error(e);
          }
        }
      }

      setPageNum(1);
    } catch (err) {
      console.error('PdfJsViewer:', err);

      setError(
        'Không thể tải PDF. Vui lòng thử lại.'
      );
    } finally {
      setLoading(false);
    }
  }, [
    pdfUrl,
    highlightItems,
    side,
    scale,
    highlightEnabled,
  ]);

  useEffect(() => {
    renderPdf();
  }, [renderPdf]);

  const handleScroll = useCallback(() => {
    const w = wrapperRef.current;
    const r = pagesRootRef.current;

    if (!w || !r) return;

    const probe =
      w.scrollTop + w.clientHeight * 0.2;

    let cur = 1;

    r.querySelectorAll('.lc-pdf-page').forEach((n) => {
      if (n.offsetTop <= probe) {
        cur = Number(n.dataset.page);
      }
    });

    setPageNum(cur);
  }, []);

  const legendLabel =
    side === 'a'
      ? 'Từ bị xóa / thay đổi'
      : 'Từ được thêm / mới';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        flex: 1,
        height: '100vh',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.6rem 1rem',
          background: accentColor,
          fontWeight: 700,
          fontSize: '0.85rem',
          color: '#fff',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: HL_DOT[side],
          }}
        />

        {label}

        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            marginLeft: '0.5rem',
            background: HL_FILL[side],
            border: `1px solid ${HL_BORDER[side]}`,
            borderRadius: 3,
            padding: '1px 7px',
            fontSize: '0.7rem',
            fontWeight: 600,
            color: '#fff',
          }}
        >
          {legendLabel}
        </span>

        {/* Zoom */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.2rem',
            marginLeft: 'auto',
            marginRight: '0.75rem',
            background: 'rgba(0,0,0,.18)',
            padding: '2px 6px',
          }}
        >
          <button
            onClick={() =>
              setScale((p) =>
                Math.max(0.4, p - 0.1)
              )
            }
            style={{
              background: 'transparent',
              border: 'none',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            <ZoomOut size={15} />
          </button>

          <span
            style={{
              fontSize: '0.72rem',
              minWidth: '34px',
              textAlign: 'center',
            }}
          >
            {Math.round(scale * 100)}%
          </span>

          <button
            onClick={() =>
              setScale((p) =>
                Math.min(2.5, p + 0.1)
              )
            }
            style={{
              background: 'transparent',
              border: 'none',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            <ZoomIn size={15} />
          </button>

          <button
            onClick={() => setScale(0.8)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            <Maximize size={14} />
          </button>
        </div>

        <span
          style={{
            fontWeight: 400,
            fontSize: '0.78rem',
            opacity: 0.82,
          }}
        >
          {loading
            ? 'Đang tải…'
            : error
              ? '⚠ Lỗi'
              : `${pageNum} / ${pageCount}`}
        </span>
      </div>

      {/* Scroll area */}
      <div
        ref={wrapperRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'scroll',
          overflowX: 'auto',
          border: `1.5px solid ${accentColor}55`,
          borderTop: 'none',
          background: '#f1f5f9',
          padding: '1rem 0.75rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {error && (
          <div
            style={{
              color: '#dc2626',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              padding: '1rem 1.5rem',
              fontSize: '0.88rem',
            }}
          >
            {error}
          </div>
        )}

        <div
          ref={pagesRootRef}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        />
      </div>
    </div>
  );
}
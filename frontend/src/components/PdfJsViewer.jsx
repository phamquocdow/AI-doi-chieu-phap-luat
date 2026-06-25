import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { ZoomIn, ZoomOut, Maximize, FileX2 } from 'lucide-react';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

const BASE_URL = 'http://localhost:8000';

// Bản cũ (a) = đỏ (nội dung bị xóa/đổi) · Bản mới (b) = xanh dương (nội dung thêm/mới)
const HL_FILL = {
  a: 'rgba(248,113,113,0.38)',
  b: 'rgba(96,150,255,0.38)',
};

const HL_BORDER = {
  a: 'rgba(220,38,38,0.95)',
  b: 'rgba(29,99,237,0.95)',
};

const HL_DOT = {
  a: '#dc2626',
  b: '#1d63ed',
};

// ─────────────────────────────────────────────────────────────
// PDF helpers
// ─────────────────────────────────────────────────────────────

// Chuỗi "nén": bỏ TOÀN BỘ khoảng trắng + map vị trí ký tự -> index text-item.
// pdf.js thường tách chữ tiếng Việt thành nhiều mảnh rời ("CỘNG" -> "C","Ộ","NG"),
// nên so khớp trên chuỗi còn khoảng trắng sẽ trượt. Nén lại giúp khớp ổn định.
function buildCompact(items) {
  let compact = '';
  const toItem = [];

  for (let ti = 0; ti < items.length; ti++) {
    for (const ch of (items[ti].str || '')) {
      if (/\s/.test(ch)) continue;
      compact += ch;
      toItem.push(ti);
    }
  }

  return { compact, compactLower: compact.toLowerCase(), toItem };
}

// Tìm vùng [start,end) trong chuỗi nén cho một đoạn văn (bỏ qua khoảng trắng, có fallback mỏ neo).
function findChunkRegion(compactLower, chunkText) {
  if (!chunkText) return null;
  const needle = chunkText.replace(/\s+/g, '').toLowerCase();
  if (needle.length < 8) return null;

  // 1. Khớp nguyên đoạn
  const idx = compactLower.indexOf(needle);
  if (idx !== -1) return { start: idx, end: idx + needle.length };

  // 2. Fallback: mỏ neo đầu + cuối
  const A = Math.min(30, Math.floor(needle.length / 2));
  const startA = needle.slice(0, A);
  const endA = needle.slice(-A);

  const s = compactLower.indexOf(startA);
  let e = s !== -1 ? compactLower.indexOf(endA, s + A) : -1;
  if (e === -1) e = compactLower.indexOf(endA);

  if (s !== -1 && e !== -1 && e + endA.length > s) return { start: s, end: e + endA.length };
  if (s !== -1) return { start: s, end: Math.min(compactLower.length, s + needle.length) };
  if (e !== -1) return { start: Math.max(0, e + endA.length - needle.length), end: e + endA.length };

  return null;
}

function indicesToRects(indexSet, items, viewport) {
  // Tính bbox (toạ độ viewport) cho từng text-item trong tập, gom theo dòng
  const lineMap = new Map();

  for (const ti of indexSet) {
    const it = items[ti];

    if (!it?.transform) continue;

    const {
      transform: [, , , , tx, ty],
      width: w = 0,
      height: h = 10,
    } = it;

    const [vx1, vy1] = viewport.convertToViewportPoint(tx, ty);
    const [vx2, vy2] = viewport.convertToViewportPoint(tx + w, ty + h);

    const box = {
      x0: Math.min(vx1, vx2),
      y0: Math.min(vy1, vy2),
      x1: Math.max(vx1, vx2),
      y1: Math.max(vy1, vy2),
    };

    if (!isFinite(box.x0) || box.x1 <= box.x0 || box.y1 <= box.y0) continue;

    // Khoá dòng dựa trên baseline (làm tròn để chịu lệch sub-pixel)
    const key = Math.round(box.y0 / 3);

    if (!lineMap.has(key)) lineMap.set(key, []);
    lineMap.get(key).push(box);
  }

  const rects = [];

  for (const boxes of lineMap.values()) {
    // Chiều cao ĐỒNG NHẤT cho cả dòng (mép trên/dưới chung) → dải tô phẳng, đều
    let top = Infinity;
    let bot = -Infinity;
    for (const b of boxes) {
      top = Math.min(top, b.y0);
      bot = Math.max(bot, b.y1);
    }
    const lineH = bot - top;

    // Sắp theo x rồi gộp các từ liền kề (cách nhau ~1 dấu cách) thành một dải,
    // chừa khoảng trống ở những từ không thay đổi nằm giữa
    boxes.sort((a, b) => a.x0 - b.x0);

    let cur = null;
    for (const b of boxes) {
      if (!cur) { cur = { x0: b.x0, x1: b.x1 }; continue; }

      const gap = b.x0 - cur.x1;
      if (gap <= lineH * 0.6) {
        cur.x1 = Math.max(cur.x1, b.x1);
      } else {
        rects.push({ x: cur.x0, y: top, width: cur.x1 - cur.x0, height: lineH });
        cur = { x0: b.x0, x1: b.x1 };
      }
    }
    if (cur) rects.push({ x: cur.x0, y: top, width: cur.x1 - cur.x0, height: lineH });
  }

  return rects;
}

function addBox(overlay, rect, side) {
  // Một lớp màu phẳng, đều: không viền, không gạch, không blend (tránh loang lổ)
  const PAD_Y = 1.5;

  const box = document.createElement('div');

  box.style.cssText = `
    position:absolute;
    left:${Math.max(0, rect.x)}px;
    top:${Math.max(0, rect.y - PAD_Y)}px;
    width:${Math.max(4, rect.width)}px;
    height:${Math.max(6, rect.height + PAD_Y * 2)}px;
    background:${HL_FILL[side]};
    border-radius:2px;
    pointer-events:none;
  `;

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

  // Cache tài liệu PDF đã tải để zoom không phải tải lại từ server
  const pdfDocRef = useRef(null);
  const loadedUrlRef = useRef(null);

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

      // Chỉ tải PDF từ server khi URL đổi; zoom dùng lại doc đã cache
      let pdfDoc = pdfDocRef.current;
      if (!pdfDoc || loadedUrlRef.current !== fullUrl) {
        pdfDoc = await pdfjsLib.getDocument(fullUrl).promise;
        if (currentRenderId !== renderIdRef.current) return;
        pdfDocRef.current = pdfDoc;
        loadedUrlRef.current = fullUrl;
      }

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
          box-shadow:0 2px 12px rgba(26,31,43,.14);
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

            // Chuỗi nén (bỏ hết khoảng trắng) để khớp ổn định với text PDF bị vỡ
            const { compactLower, toItem } = buildCompact(pgItems);

            // Gom TẤT CẢ chữ cần tô vào một tập rồi vẽ một lần → dải đều, không chồng ô
            const hlSet = new Set();

            for (const item of highlightItems) {
              const region = findChunkRegion(compactLower, item.chunkText);

              if (!region) continue;

              if (item.isFullChunk) {
                const end = Math.min(toItem.length, region.end);
                for (let k = Math.max(0, region.start); k < end; k++) {
                  hlSet.add(toItem[k]);
                }
              } else if (item.diffTokens) {
                // Đi qua token theo thứ tự, TÌM TỪNG TỪ (đã nén) trong vùng chunk.
                // Mỗi token khớp lại đồng bộ con trỏ nên không bị trượt.
                let cursor = region.start;

                for (const token of item.diffTokens) {
                  const isMatchSide =
                    (side === 'a' && token.type === 'delete') ||
                    (side === 'b' && token.type === 'insert');

                  // Token chỉ tồn tại ở phía bên kia → không có trong vùng này
                  if (token.type !== 'equal' && !isMatchSide) continue;

                  const word = (token.value || '').replace(/\s+/g, '').toLowerCase();
                  if (!word) continue;

                  const idx = compactLower.indexOf(word, cursor);
                  if (idx === -1 || idx >= region.end) continue;

                  const endPos = idx + word.length;
                  cursor = endPos;

                  if (!isMatchSide || !/[\p{L}\p{N}]/u.test(word)) continue;

                  for (let k = idx; k < endPos && k < toItem.length; k++) {
                    hlSet.add(toItem[k]);
                  }
                }
              }
            }

            for (const r of indicesToRects(hlSet, pgItems, viewport)) {
              addBox(overlay, r, side);
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

  // Giải phóng tài liệu PDF khi component bị gỡ (tránh rò bộ nhớ)
  useEffect(() => {
    return () => {
      pdfDocRef.current?.destroy?.();
      pdfDocRef.current = null;
      loadedUrlRef.current = null;
    };
  }, []);

  const handleScroll = useCallback(() => {
    const w = wrapperRef.current;
    const r = pagesRootRef.current;

    if (!w || !r) return;

    // Dùng toạ độ tương đối so với vùng cuộn (không phụ thuộc offsetParent)
    const wTop = w.getBoundingClientRect().top;
    const probe = w.clientHeight * 0.2;

    let cur = 1;

    r.querySelectorAll('.lc-pdf-page').forEach((n) => {
      const top = n.getBoundingClientRect().top - wTop;
      if (top <= probe) {
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
        height: '100dvh',
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

        {!pdfUrl && !error && (
          <div
            style={{
              margin: 'auto',
              maxWidth: 320,
              textAlign: 'center',
              color: 'var(--text-muted)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '2rem 1rem',
            }}
          >
            <div style={{
              width: 52, height: 52, borderRadius: 'var(--radius-md)',
              background: '#fff', border: '1px solid var(--border-hairline)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-faint)',
            }}>
              <FileX2 size={24} strokeWidth={1.5} />
            </div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>
              Không có bản xem trước PDF
            </div>
            <div style={{ fontSize: '0.8rem', lineHeight: 1.55 }}>
              Máy chủ chưa tạo được file PDF từ tài liệu (thường do thiếu LibreOffice
              hoặc MS Word để chuyển đổi DOCX). Kết quả đối chiếu bên dưới vẫn hoạt động bình thường.
            </div>
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
import { useEffect, useRef, useState } from "react";

/**
 * Draws the blue connector arrow between the selected field row (`fromRef`) and its highlighted
 * location in the document viewer (`toRef`), both positioned within `containerRef` (which must be
 * `position: relative`). Recomputes on every animation frame while `active` so the arrow stays
 * aligned through independent scrolling in either panel, PDF zoom changes, and window resize,
 * without wiring a brittle set of per-container scroll listeners (scroll events don't bubble, and
 * either panel — or the page itself — can be the one that scrolls). The loop only runs while a
 * field with a real document location is selected, so it costs nothing the rest of the time.
 */
export default function FieldDocumentConnector({ containerRef, fromRef, toRef, active }) {
  const [path, setPath] = useState(null);
  const frameRef = useRef(null);

  useEffect(() => {
    if (!active) {
      setPath(null);
      return undefined;
    }

    const tick = () => {
      const container = containerRef.current;
      const from = fromRef.current;
      const to = toRef.current;

      if (!container || !from || !to) {
        setPath(null);
        frameRef.current = requestAnimationFrame(tick);
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const fromRect = from.getBoundingClientRect();
      const toRect = to.getBoundingClientRect();

      const visible =
        fromRect.bottom > containerRect.top &&
        fromRect.top < containerRect.bottom &&
        toRect.bottom > containerRect.top &&
        toRect.top < containerRect.bottom;

      if (!visible) {
        setPath(null);
        frameRef.current = requestAnimationFrame(tick);
        return;
      }

      const x1 = fromRect.right - containerRect.left;
      const y1 = fromRect.top + fromRect.height / 2 - containerRect.top;
      const x2 = toRect.left - containerRect.left;
      const y2 = toRect.top + toRect.height / 2 - containerRect.top;
      const midX = (x1 + x2) / 2;

      setPath((prev) => {
        if (prev && Math.abs(prev.x1 - x1) < 0.5 && Math.abs(prev.y1 - y1) < 0.5 && Math.abs(prev.x2 - x2) < 0.5 && Math.abs(prev.y2 - y2) < 0.5) {
          return prev;
        }
        return { x1, y1, x2, y2, midX };
      });

      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [active, containerRef, fromRef, toRef]);

  if (!path) return null;

  return (
    <svg className="pointer-events-none absolute inset-0 z-20 h-full w-full overflow-visible">
      <defs>
        <marker id="stage1-field-arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="#2563eb" />
        </marker>
      </defs>
      <path
        d={`M ${path.x1} ${path.y1} C ${path.midX} ${path.y1}, ${path.midX} ${path.y2}, ${path.x2} ${path.y2}`}
        stroke="#2563eb"
        strokeWidth="2"
        fill="none"
        markerEnd="url(#stage1-field-arrowhead)"
      />
    </svg>
  );
}

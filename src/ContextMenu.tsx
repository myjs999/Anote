import React, { useEffect, useRef } from 'react';

export type MenuItem = { label: string; action: () => void; danger?: boolean };

type Props = {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
};

export default function ContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('click', onClickOutside);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', onClickOutside);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  useEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (rect.right > vw) ref.current.style.left = `${vw - rect.width - 4}px`;
    if (rect.bottom > vh) ref.current.style.top = `${vh - rect.height - 4}px`;
  }, []);

  return (
    <div className="ctx-menu" ref={ref} style={{ left: x, top: y }}>
      {items.map((item, i) => (
        <div
          key={i}
          className={`ctx-item ${item.danger ? 'danger' : ''}`}
          onClick={() => { item.action(); onClose(); }}
        >
          {item.label}
        </div>
      ))}
    </div>
  );
}

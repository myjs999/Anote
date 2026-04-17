import React, { useState, useRef, useEffect } from 'react';

export type MenuItemDef =
  | { type?: 'item'; label: string; shortcut?: string; action: () => void; disabled?: boolean }
  | { type: 'separator' };

export type MenuDef = { label: string; items: MenuItemDef[] };

function Dropdown({ items, onClose }: { items: MenuItemDef[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div ref={ref} className="menu-dropdown">
      {items.map((item, i) =>
        item.type === 'separator' ? (
          <div key={i} className="menu-separator" />
        ) : (
          <div
            key={i}
            className={`menu-item ${item.disabled ? 'disabled' : ''}`}
            onClick={() => {
              if (!item.disabled) { item.action(); onClose(); }
            }}
          >
            <span>{item.label}</span>
            {item.shortcut && <span className="menu-shortcut">{item.shortcut}</span>}
          </div>
        ),
      )}
    </div>
  );
}

function Menu({ def, open, onOpen, onClose }: {
  def: MenuDef;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  return (
    <div className="menu-entry" style={{ position: 'relative' }}>
      <button className={`menu-btn ${open ? 'active' : ''}`} onClick={open ? onClose : onOpen}>
        {def.label}
      </button>
      {open && <Dropdown items={def.items} onClose={onClose} />}
    </div>
  );
}

export default function MenuBar({
  menus,
  pathBar,
  pathError,
  onPathChange,
  onPathBlur,
  onPathKeyDown,
}: {
  menus: MenuDef[];
  pathBar: string;
  pathError: string;
  onPathChange: (v: string) => void;
  onPathBlur: () => void;
  onPathKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <div className="menubar">
      <div className="menubar-menus">
        {menus.map((def, i) => (
          <Menu
            key={def.label}
            def={def}
            open={openIdx === i}
            onOpen={() => setOpenIdx(i)}
            onClose={() => setOpenIdx(null)}
          />
        ))}
      </div>
      <div className="menubar-path">
        <div className="path-bar-wrap">
          <input
            className={`path-bar ${pathError ? 'path-bar-error' : ''}`}
            value={pathBar}
            onChange={(e) => onPathChange(e.target.value)}
            onFocus={(e) => e.target.select()}
            onBlur={onPathBlur}
            onKeyDown={onPathKeyDown}
            placeholder="Enter file path or URL and press Enter…"
            spellCheck={false}
          />
          {pathError && <div className="path-hint">{pathError}</div>}
        </div>
      </div>
    </div>
  );
}

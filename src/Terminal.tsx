import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

type Props = { cwd: string };

export default function Terminal({ cwd }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const idRef = useRef<number | null>(null);
  const lineRef = useRef('');
  const [dead, setDead] = useState(false);

  useEffect(() => {
    const term = new XTerm({
      theme: {
        background: '#0f1117',
        foreground: '#d8dadf',
        cursor: '#6aa3ff',
        black: '#1e1e2e', red: '#e06c75', green: '#98c379',
        yellow: '#e5c07b', blue: '#6aa3ff', magenta: '#c678dd',
        cyan: '#56b6c2', white: '#d8dadf',
        brightBlack: '#5b5e66', brightRed: '#e06c75', brightGreen: '#98c379',
        brightYellow: '#e5c07b', brightBlue: '#82b3ff', brightMagenta: '#c678dd',
        brightCyan: '#56b6c2', brightWhite: '#ffffff',
      },
      fontFamily: "'Cascadia Code', 'Cascadia Mono', Consolas, 'Courier New', monospace",
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: true,
      allowProposedApi: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current!);
    fit.fit();
    termRef.current = term;
    fitRef.current = fit;

    window.api.terminal.create(cwd).then((id) => {
      idRef.current = id;

      const offData = window.api.terminal.onData(id, (data) => term.write(data));
      const offExit = window.api.terminal.onExit(id, () => {
        term.write('\r\n\x1b[31m[Process exited]\x1b[0m\r\n');
        setDead(true);
      });

      // Handle keyboard input — collect lines, send on Enter
      term.onKey(({ key, domEvent }) => {
        const ev = domEvent as KeyboardEvent;
        if (ev.key === 'Enter') {
          window.api.terminal.write(id, lineRef.current + '\r\n');
          term.write('\r\n');
          lineRef.current = '';
        } else if (ev.key === 'Backspace') {
          if (lineRef.current.length > 0) {
            lineRef.current = lineRef.current.slice(0, -1);
            term.write('\b \b');
          }
        } else if (!ev.ctrlKey && !ev.altKey && !ev.metaKey && key.length === 1) {
          lineRef.current += key;
          term.write(key);
        } else if (ev.ctrlKey && ev.key === 'c') {
          window.api.terminal.write(id, '\x03');
          lineRef.current = '';
          term.write('^C\r\n');
        }
      });

      return () => { offData(); offExit(); };
    });

    const ro = new ResizeObserver(() => { try { fit.fit(); } catch {} });
    ro.observe(containerRef.current!);

    return () => {
      ro.disconnect();
      if (idRef.current !== null) window.api.terminal.kill(idRef.current);
      term.dispose();
    };
  }, [cwd]);

  const restart = () => {
    if (termRef.current) termRef.current.clear();
    lineRef.current = '';
    setDead(false);
    if (idRef.current !== null) window.api.terminal.kill(idRef.current);
    window.api.terminal.create(cwd).then((id) => {
      idRef.current = id;
      const offData = window.api.terminal.onData(id, (data) => termRef.current?.write(data));
      const offExit = window.api.terminal.onExit(id, () => {
        termRef.current?.write('\r\n\x1b[31m[Process exited]\x1b[0m\r\n');
        setDead(true);
      });
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0f1117' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px', borderBottom: '1px solid #303237', flexShrink: 0 }}>
        <span style={{ fontSize: 12, color: '#8b8f98' }}>PowerShell</span>
        <div style={{ flex: 1 }} />
        {dead && (
          <button onClick={restart} style={{ background: '#25272d', color: '#d8dadf', border: '1px solid #3a3d44', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 12 }}>
            Restart
          </button>
        )}
      </div>
      <div ref={containerRef} style={{ flex: 1, padding: '4px 4px 0', minHeight: 0 }} />
    </div>
  );
}

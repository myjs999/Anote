import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';
import CodeMirror from '@uiw/react-codemirror';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView } from '@codemirror/view';

const fontTheme = EditorView.theme({
  '&': { fontFamily: "'Cascadia Code', 'Cascadia Mono', Consolas, monospace" },
  '.cm-content': { fontFamily: "'Cascadia Code', 'Cascadia Mono', Consolas, monospace" },
  '.cm-gutters': { fontFamily: "'Cascadia Code', 'Cascadia Mono', Consolas, monospace" },
});
import { cpp } from '@codemirror/lang-cpp';
import { xml } from '@codemirror/lang-xml';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { markdown } from '@codemirror/lang-markdown';
import { json } from '@codemirror/lang-json';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { rust } from '@codemirror/lang-rust';
import { java } from '@codemirror/lang-java';
import { go } from '@codemirror/lang-go';
import { yaml } from '@codemirror/lang-yaml';
import { sql } from '@codemirror/lang-sql';
import UnsavedDialog from './Dialog';
import Terminal from './Terminal';
import ContextMenu, { MenuItem } from './ContextMenu';
import InputDialog from './InputDialog';
import ConfirmDialog from './ConfirmDialog';

const langByExt: Record<string, () => any> = {
  cpp: cpp, c: cpp, h: cpp, hpp: cpp, cc: cpp, cxx: cpp,
  xml: xml, svg: xml,
  js: javascript, jsx: javascript, ts: javascript, tsx: javascript, mjs: javascript, cjs: javascript,
  py: python,
  md: markdown, markdown: markdown,
  json: json,
  html: html, htm: html,
  css: css, scss: css,
  rs: rust,
  java: java,
  go: go,
  yml: yaml, yaml: yaml,
  sql: sql,
};

function getLangExtensions(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const fn = langByExt[ext];
  return fn ? [fn()] : [];
}

const marked = new Marked(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext';
      return hljs.highlight(code, { language }).value;
    },
  }),
);

type Entry = { name: string; path: string; isDir: boolean };
type Tab = { entry: Entry; content: string; dirty: boolean; preview: boolean };
type InputDlg = { title: string; defaultValue?: string; onConfirm: (v: string) => void };
type ConfirmDlg = { message: string; onConfirm: () => void };
type CtxMenu = { x: number; y: number; items: MenuItem[] };

const ROOT_KEY = 'notes-app:root';

export default function App() {
  const [root, setRoot] = useState<string | null>(() => localStorage.getItem(ROOT_KEY));
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeIdx, setActiveIdx] = useState<number>(-1);
  const [closePrompt, setClosePrompt] = useState<{ idx: number } | null>(null);
  const [termOpen, setTermOpen] = useState(false);
  const [termHeight, setTermHeight] = useState(220);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);

  // Global tree refresh — incrementing forces all mounted Trees to re-list their dir
  const [treeVersion, setTreeVersion] = useState(0);
  const refreshTree = useCallback(() => setTreeVersion((v) => v + 1), []);

  // Shared dialogs — lifted to App so they work from any depth
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
  const [inputDlg, setInputDlg] = useState<InputDlg | null>(null);
  const [confirmDlg, setConfirmDlg] = useState<ConfirmDlg | null>(null);

  const askInput = useCallback(
    (title: string, defaultValue?: string) =>
      new Promise<string | null>((resolve) =>
        setInputDlg({
          title,
          defaultValue,
          onConfirm: (v) => { setInputDlg(null); resolve(v); },
        }),
      ),
    [],
  );

  const activeTab = tabs[activeIdx] ?? null;

  const pickRoot = async () => {
    const dir = await window.api.pickFolder();
    if (dir) {
      localStorage.setItem(ROOT_KEY, dir);
      setRoot(dir);
      setTabs([]);
      setActiveIdx(-1);
    }
  };

  const openFile = useCallback(async (entry: Entry) => {
    if (entry.isDir) return;
    const existing = tabs.findIndex((t) => t.entry.path === entry.path);
    if (existing !== -1) { setActiveIdx(existing); return; }
    const content = await window.api.read(entry.path);
    setTabs((prev) => {
      const next = [...prev, { entry, content, dirty: false, preview: true }];
      setActiveIdx(next.length - 1);
      return next;
    });
  }, [tabs]);

  const forceCloseTab = useCallback((idx: number) => {
    setClosePrompt(null);
    setTabs((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      setActiveIdx((cur) => {
        if (next.length === 0) return -1;
        if (idx < cur) return cur - 1;
        if (idx === cur) return Math.min(cur, next.length - 1);
        return cur;
      });
      return next;
    });
  }, []);

  const closeTab = useCallback((idx: number) => {
    setTabs((prev) => {
      if (prev[idx]?.dirty) { setClosePrompt({ idx }); return prev; }
      const next = prev.filter((_, i) => i !== idx);
      setActiveIdx((cur) => {
        if (next.length === 0) return -1;
        if (idx < cur) return cur - 1;
        if (idx === cur) return Math.min(cur, next.length - 1);
        return cur;
      });
      return next;
    });
  }, []);

  const updateActive = useCallback((patch: Partial<Tab>) => {
    setTabs((prev) => prev.map((t, i) => (i === activeIdx ? { ...t, ...patch } : t)));
  }, [activeIdx]);

  const save = useCallback(async () => {
    if (!activeTab || activeTab.entry.isDir) return;
    await window.api.write(activeTab.entry.path, activeTab.content);
    updateActive({ dirty: false });
  }, [activeTab, updateActive]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); save(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        e.preventDefault();
        if (activeIdx !== -1) closeTab(activeIdx);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault();
        setTermOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save, activeIdx, closeTab]);

  const startDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startY: e.clientY, startH: termHeight };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const delta = dragRef.current.startY - ev.clientY;
      setTermHeight(Math.max(80, Math.min(600, dragRef.current.startH + delta)));
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [termHeight]);

  // File operations — used by Tree via callbacks
  const newItem = useCallback(async (parentDir: string, isDir: boolean) => {
    const name = await askInput(isDir ? 'New folder name' : 'New file name (e.g. note.md)');
    if (!name) return;
    await window.api.create(parentDir, name, isDir);
    refreshTree();
  }, [askInput, refreshTree]);

  const renameItem = useCallback(async (entry: Entry) => {
    const next = await askInput('Rename', entry.name);
    if (next && next !== entry.name) {
      const parent = entry.path.slice(0, -entry.name.length);
      await window.api.rename(entry.path, parent + next);
      refreshTree();
    }
  }, [askInput, refreshTree]);

  const deleteItem = useCallback((entry: Entry) => {
    setConfirmDlg({
      message: `Delete "${entry.name}"?`,
      onConfirm: async () => {
        setConfirmDlg(null);
        await window.api.remove(entry.path);
        refreshTree();
      },
    });
  }, [refreshTree]);

  const showEntryMenu = useCallback((e: React.MouseEvent, entry: Entry) => {
    e.preventDefault();
    e.stopPropagation();
    const items: MenuItem[] = entry.isDir
      ? [
          { label: 'New File',   action: () => newItem(entry.path, false) },
          { label: 'New Folder', action: () => newItem(entry.path, true) },
          { label: 'Rename',     action: () => renameItem(entry) },
          { label: 'Delete',     action: () => deleteItem(entry), danger: true },
        ]
      : [
          { label: 'Rename', action: () => renameItem(entry) },
          { label: 'Delete', action: () => deleteItem(entry), danger: true },
        ];
    setCtxMenu({ x: e.clientX, y: e.clientY, items });
  }, [newItem, renameItem, deleteItem]);

  const showSidebarMenu = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.row')) return;
    e.preventDefault();
    if (!root) return;
    setCtxMenu({
      x: e.clientX, y: e.clientY,
      items: [
        { label: 'New File',   action: () => newItem(root, false) },
        { label: 'New Folder', action: () => newItem(root, true) },
      ],
    });
  }, [root, newItem]);

  const langExtensions = useMemo(
    () => (activeTab ? getLangExtensions(activeTab.entry.name) : []),
    [activeTab?.entry.name],
  );
  const isMd = activeTab && /\.md$/i.test(activeTab.entry.name);
  const promptTab = closePrompt !== null ? tabs[closePrompt.idx] : null;

  if (!root) {
    return (
      <div className="welcome">
        <h1>Notes</h1>
        <p>Pick a folder to use as your notes workspace.</p>
        <button onClick={pickRoot}>Choose folder</button>
      </div>
    );
  }

  return (
    <div className="layout">
      {/* Shared dialogs */}
      {ctxMenu && <ContextMenu {...ctxMenu} onClose={() => setCtxMenu(null)} />}
      {inputDlg && (
        <InputDialog
          title={inputDlg.title}
          defaultValue={inputDlg.defaultValue}
          onConfirm={inputDlg.onConfirm}
          onCancel={() => setInputDlg(null)}
        />
      )}
      {confirmDlg && (
        <ConfirmDialog
          message={confirmDlg.message}
          onConfirm={confirmDlg.onConfirm}
          onCancel={() => setConfirmDlg(null)}
        />
      )}
      {promptTab && closePrompt && (
        <UnsavedDialog
          filename={promptTab.entry.name}
          onSave={async () => { await window.api.write(promptTab.entry.path, promptTab.content); forceCloseTab(closePrompt.idx); }}
          onDiscard={() => forceCloseTab(closePrompt.idx)}
          onCancel={() => setClosePrompt(null)}
        />
      )}

      <aside className="sidebar" onContextMenu={showSidebarMenu}>
        <div className="sidebar-header">
          <span title={root}>{root.split(/[\\/]/).pop()}</span>
          <button onClick={pickRoot} title="Change folder">…</button>
        </div>
        <Tree
          dir={root}
          onSelect={openFile}
          selectedPath={activeTab?.entry.path}
          openPaths={new Set(tabs.map((t) => t.entry.path))}
          onEntryContext={showEntryMenu}
          globalVersion={treeVersion}
        />
      </aside>

      <main className="editor">
        {tabs.length > 0 && (
          <TabBar tabs={tabs} activeIdx={activeIdx} onSelect={setActiveIdx} onClose={closeTab} />
        )}
        {!activeTab && !termOpen && <div className="placeholder">Open a file from the sidebar.</div>}
        {activeTab && (
          <>
            <div className="toolbar">
              <div className="spacer" />
              {isMd && (
                <button onClick={() => updateActive({ preview: !activeTab.preview })}>
                  {activeTab.preview ? 'Hide preview' : 'Show preview'}
                </button>
              )}
              <button onClick={save} disabled={!activeTab.dirty}>Save (Ctrl+S)</button>
              <button onClick={() => setTermOpen((o) => !o)} title="Toggle terminal (Ctrl+`)">⌨ Terminal</button>
            </div>
            <div className={`pane ${isMd && activeTab.preview ? 'split' : ''}`}>
              <CodeMirror
                key={activeTab.entry.path}
                value={activeTab.content}
                theme={oneDark}
                extensions={[...langExtensions, fontTheme]}
                onChange={(v) => updateActive({ content: v, dirty: true })}
                height="100%"
                style={{ height: '100%', fontSize: 14, fontFamily: "'Cascadia Code', 'Cascadia Mono', Consolas, monospace" }}
              />
              {isMd && activeTab.preview && (
                <div
                  className="preview"
                  dangerouslySetInnerHTML={{ __html: marked.parse(activeTab.content) as string }}
                />
              )}
            </div>
          </>
        )}
        {termOpen && root && (
          <>
            <div className="term-resize-handle" onMouseDown={startDrag} />
            <div className="term-panel" style={{ height: termHeight }}>
              <Terminal cwd={root} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function TabBar({ tabs, activeIdx, onSelect, onClose }: {
  tabs: Tab[]; activeIdx: number;
  onSelect: (i: number) => void; onClose: (i: number) => void;
}) {
  return (
    <div className="tabbar">
      {tabs.map((tab, i) => (
        <div
          key={tab.entry.path}
          className={`tab ${i === activeIdx ? 'active' : ''}`}
          onClick={() => onSelect(i)}
          onMouseDown={(e) => { if (e.button === 1) { e.preventDefault(); onClose(i); } }}
          title={tab.entry.path}
        >
          <span className="tab-name">{tab.entry.name}</span>
          {tab.dirty && <span className="tab-dirty">●</span>}
          <span className="tab-close" onClick={(e) => { e.stopPropagation(); onClose(i); }}>×</span>
        </div>
      ))}
    </div>
  );
}

function Tree({
  dir, onSelect, selectedPath, openPaths, onEntryContext, globalVersion, depth = 0,
}: {
  dir: string;
  onSelect: (e: Entry) => void;
  selectedPath?: string;
  openPaths?: Set<string>;
  onEntryContext: (e: React.MouseEvent, entry: Entry) => void;
  globalVersion: number;
  depth?: number;
}) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    window.api.list(dir).then((es) =>
      setEntries(es.sort((a, b) =>
        a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1,
      )),
    );
  }, [dir, globalVersion]);

  return (
    <ul className="tree" style={{ paddingLeft: depth === 0 ? 4 : 12 }}>
      {entries.map((entry) => {
        const isActive = selectedPath === entry.path;
        const isTabOpen = openPaths?.has(entry.path);
        return (
          <li key={entry.path}>
            <div
              className={`row ${isActive ? 'active' : isTabOpen ? 'open' : ''}`}
              onClick={() => {
                onSelect(entry);
                if (entry.isDir) setOpen((o) => ({ ...o, [entry.path]: !o[entry.path] }));
              }}
              onContextMenu={(e) => onEntryContext(e, entry)}
            >
              <span className="icon">{entry.isDir ? (open[entry.path] ? '▾' : '▸') : '·'}</span>
              <span className="name">{entry.name}</span>
            </div>
            {entry.isDir && open[entry.path] && (
              <Tree
                dir={entry.path}
                onSelect={onSelect}
                selectedPath={selectedPath}
                openPaths={openPaths}
                onEntryContext={onEntryContext}
                globalVersion={globalVersion}
                depth={depth + 1}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

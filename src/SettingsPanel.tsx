import React from 'react';
import { useSettings } from './SettingsContext';

const FONT_FAMILIES = [
  'Cascadia Code',
  'Cascadia Mono',
  'Consolas',
  'Courier New',
  'JetBrains Mono',
  'Fira Code',
  'Source Code Pro',
];

const ACCENT_PRESETS = [
  '#6aa3ff', '#98c379', '#e5c07b', '#e06c75',
  '#c678dd', '#56b6c2', '#d19a66', '#ffffff',
];

export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { settings, update } = useSettings();
  const s = settings;

  return (
    <div className="settings-backdrop" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <span>Settings</span>
          <button className="settings-close" onClick={onClose}>×</button>
        </div>
        <div className="settings-body">

          {/* Editor */}
          <section className="settings-section">
            <div className="settings-section-title">Editor</div>

            <Row label="Font Family">
              <select value={s.editor.fontFamily} onChange={(e) => update({ editor: { fontFamily: e.target.value } })}>
                {FONT_FAMILIES.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </Row>

            <Row label={`Font Size (${s.editor.fontSize}px)`}>
              <input type="range" min={10} max={24} value={s.editor.fontSize}
                onChange={(e) => update({ editor: { fontSize: +e.target.value } })} />
            </Row>

            <Row label={`Tab Size (${s.editor.tabSize})`}>
              <input type="range" min={1} max={8} step={1} value={s.editor.tabSize}
                onChange={(e) => update({ editor: { tabSize: +e.target.value } })} />
            </Row>

            <Row label="Word Wrap">
              <Toggle checked={s.editor.wordWrap} onChange={(v) => update({ editor: { wordWrap: v } })} />
            </Row>

            <Row label="Line Numbers">
              <Toggle checked={s.editor.lineNumbers} onChange={(v) => update({ editor: { lineNumbers: v } })} />
            </Row>
          </section>

          {/* Terminal */}
          <section className="settings-section">
            <div className="settings-section-title">Terminal</div>

            <Row label={`Font Size (${s.terminal.fontSize}px)`}>
              <input type="range" min={10} max={20} value={s.terminal.fontSize}
                onChange={(e) => update({ terminal: { fontSize: +e.target.value } })} />
            </Row>
          </section>

          {/* Theme */}
          <section className="settings-section">
            <div className="settings-section-title">Theme</div>

            <Row label="Accent Color">
              <div className="color-row">
                {ACCENT_PRESETS.map((c) => (
                  <div
                    key={c}
                    className={`color-swatch ${s.theme.accentColor === c ? 'active' : ''}`}
                    style={{ background: c }}
                    onClick={() => update({ theme: { accentColor: c } })}
                  />
                ))}
                <input type="color" value={s.theme.accentColor}
                  onChange={(e) => update({ theme: { accentColor: e.target.value } })} />
              </div>
            </Row>
          </section>

          {/* General */}
          <section className="settings-section">
            <div className="settings-section-title">General</div>

            <Row label="Auto Save">
              <Toggle checked={s.general.autoSave} onChange={(v) => update({ general: { autoSave: v } })} />
            </Row>

            {s.general.autoSave && (
              <Row label={`Auto Save Interval (${s.general.autoSaveInterval}s)`}>
                <input type="range" min={1} max={60} value={s.general.autoSaveInterval}
                  onChange={(e) => update({ general: { autoSaveInterval: +e.target.value } })} />
              </Row>
            )}

            <Row label="Confirm Before Delete">
              <Toggle checked={s.general.confirmDelete} onChange={(v) => update({ general: { confirmDelete: v } })} />
            </Row>
          </section>

        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="settings-row">
      <span className="settings-label">{label}</span>
      <div className="settings-control">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className={`toggle ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}>
      <div className="toggle-thumb" />
    </div>
  );
}

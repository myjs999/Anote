import React, { useEffect, useState } from 'react';

type PythonEnv = { name: string; exePath: string; version: string; type: string };

const TYPE_LABEL: Record<string, string> = {
  system: 'System',
  conda: 'Conda',
  venv: 'Venv',
};

const TYPE_COLOR: Record<string, string> = {
  system: '#6aa3ff',
  conda: '#98c379',
  venv: '#e5c07b',
};

export default function PythonEnvPanel({ onClose }: { onClose: () => void }) {
  const [envs, setEnvs] = useState<PythonEnv[] | null>(null);

  useEffect(() => {
    window.api.python.listEnvs().then(setEnvs);
  }, []);

  return (
    <div className="settings-backdrop" onClick={onClose}>
      <div
        className="settings-panel"
        style={{ maxWidth: 600, maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="settings-header">
          <span>Python Environments</span>
          <button onClick={onClose}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          {envs === null && (
            <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: 32 }}>
              Scanning…
            </div>
          )}
          {envs !== null && envs.length === 0 && (
            <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: 32 }}>
              No Python environments found.
            </div>
          )}
          {envs !== null && envs.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ color: 'var(--text-dim)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 500 }}>Name</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 500 }}>Version</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 500 }}>Type</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 500 }}>Path</th>
                </tr>
              </thead>
              <tbody>
                {envs.map((env, i) => (
                  <tr
                    key={i}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      background: i % 2 === 0 ? 'transparent' : 'var(--bg-2)',
                    }}
                  >
                    <td style={{ padding: '8px 8px', fontWeight: 500 }}>{env.name}</td>
                    <td style={{ padding: '8px 8px', color: 'var(--text-dim)', fontFamily: 'monospace' }}>
                      {env.version}
                    </td>
                    <td style={{ padding: '8px 8px' }}>
                      <span
                        style={{
                          fontSize: 11,
                          padding: '2px 7px',
                          borderRadius: 10,
                          background: TYPE_COLOR[env.type] + '22',
                          color: TYPE_COLOR[env.type],
                          border: `1px solid ${TYPE_COLOR[env.type]}44`,
                        }}
                      >
                        {TYPE_LABEL[env.type] ?? env.type}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: '8px 8px',
                        color: 'var(--text-faint)',
                        fontSize: 11,
                        fontFamily: 'monospace',
                        wordBreak: 'break-all',
                      }}
                    >
                      {env.exePath}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

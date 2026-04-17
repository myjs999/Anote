import React, { useEffect, useRef } from 'react';

type Props = {
  filename: string;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
};

export default function UnsavedDialog({ filename, onSave, onDiscard, onCancel }: Props) {
  const saveRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    saveRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-title">Unsaved Changes</div>
        <div className="dialog-body">
          Do you want to save changes to <strong>{filename}</strong>?
        </div>
        <div className="dialog-actions">
          <button className="btn-save" ref={saveRef} onClick={onSave}>Save</button>
          <button className="btn-discard" onClick={onDiscard}>Don't Save</button>
          <button className="btn-cancel" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

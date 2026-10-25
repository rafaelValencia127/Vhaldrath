import { useEffect, useRef, type ReactNode } from 'react';
import { useServices, useSyncState } from '../app/services';
import { ATLAS_COLUMNS, TILE, TILES, type TileName } from './map/atlas-index';

export function Sprite({ name, scale = 3, label }: { name: TileName; scale?: number; label?: string }) {
  const idx = TILES[name];
  const size = TILE * scale;
  return (
    <span
      className="sprite"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{
        width: size,
        height: size,
        backgroundSize: `${ATLAS_COLUMNS * size}px auto`,
        backgroundPosition: `-${(idx % ATLAS_COLUMNS) * size}px -${Math.floor(idx / ATLAS_COLUMNS) * size}px`,
      }}
    />
  );
}

export function XpBar({ into, of, label }: { into: number; of: number; label: string }) {
  const pct = Math.max(0, Math.min(100, (into / of) * 100));
  return (
    <div className="xp">
      <div className="row" style={{ justifyContent: 'space-between', fontSize: 13 }}>
        <span className="label">{label}</span>
        <span className="muted">
          {Math.floor(into)} / {of} XP
        </span>
      </div>
      <div className="bar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={of} aria-valuenow={Math.floor(into)}>
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const SYNC_TEXT = {
  'local-only': ['Saved in this browser', ''],
  'signed-out': ['Signed out · saved locally', 'warn'],
  syncing: ['Syncing…', 'warn'],
  synced: ['Synced', 'ok'],
  pending: ['Changes waiting to sync', 'warn'],
  offline: ['Offline · will sync later', 'warn'],
  error: ['Sync failed · will retry', 'err'],
} as const;

export function SyncChip() {
  const { status, error } = useSyncState();
  const [text, tone] = SYNC_TEXT[status];
  return (
    <span className={`chip ${tone}`} title={error} role="status">
      <span className="dot" aria-hidden />
      {text}
    </span>
  );
}

export function Toasts() {
  const { toasts, dismissToast } = useServices();
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`} role={t.kind === 'error' ? 'alert' : undefined}>
          <p>{t.text}</p>
          <button className="btn btn-ghost btn-sm" onClick={() => dismissToast(t.id)} aria-label="Dismiss">
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

export function Modal({ children, onClose, className = '', labelledBy }: { children: ReactNode; onClose: () => void; className?: string; labelledBy?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('button, [href], input, textarea')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus();
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div ref={ref} className={`panel modal ${className}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function Confirm({ title, body, confirmLabel, danger, onConfirm, onCancel }: { title: string; body: ReactNode; confirmLabel: string; danger?: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Modal onClose={onCancel} labelledBy="confirm-title">
      <h2 id="confirm-title">{title}</h2>
      <div>{body}</div>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button className={`btn ${danger ? 'btn-danger' : 'btn-gold'}`} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

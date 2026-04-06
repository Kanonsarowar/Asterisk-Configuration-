'use client';

export default function Toggle({ checked, onChange, label }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 18, height: 18, accentColor: 'var(--accent)' }}
      />
      <span style={{ fontSize: 14, color: 'var(--muted)' }}>{label}</span>
    </label>
  );
}

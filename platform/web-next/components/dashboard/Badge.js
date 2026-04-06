'use client';

const tones = {
  default: { bg: 'rgba(59,130,246,0.15)', color: '#93c5fd' },
  success: { bg: 'rgba(34,197,94,0.15)', color: '#86efac' },
  warn: { bg: 'rgba(234,179,8,0.15)', color: '#fde047' },
  muted: { bg: 'rgba(139,155,180,0.12)', color: 'var(--muted)' },
};

export default function Badge({ children, tone = 'default' }) {
  const t = tones[tone] || tones.default;
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: 12,
        fontWeight: 600,
        padding: '4px 10px',
        borderRadius: 999,
        background: t.bg,
        color: t.color,
      }}
    >
      {children}
    </span>
  );
}

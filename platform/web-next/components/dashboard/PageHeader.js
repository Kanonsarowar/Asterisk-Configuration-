'use client';

export default function PageHeader({ title, subtitle, actions }) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 16,
        marginBottom: 24,
      }}
    >
      <div>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>{title}</h1>
        {subtitle && (
          <p style={{ margin: '8px 0 0', color: 'var(--muted)', fontSize: 14, maxWidth: 560 }}>{subtitle}</p>
        )}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{actions}</div>}
    </div>
  );
}

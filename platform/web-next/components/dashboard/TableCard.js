'use client';

export default function TableCard({ children }) {
  return (
    <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
      <div style={{ minWidth: 640 }}>{children}</div>
    </div>
  );
}

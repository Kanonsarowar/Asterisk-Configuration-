'use client';

export default function FilterBar({ children }) {
  return (
    <div
      className="card"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 16,
        alignItems: 'flex-end',
        marginBottom: 16,
      }}
    >
      {children}
    </div>
  );
}

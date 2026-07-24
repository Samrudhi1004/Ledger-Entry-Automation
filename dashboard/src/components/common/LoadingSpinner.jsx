export default function LoadingSpinner({ message = 'Loading...' }) {
  return (
    <div className="spinner-container" style={{ flexDirection: 'column', gap: 12 }}>
      <div className="spinner" />
      <span className="text-xs text-muted">{message}</span>
    </div>
  );
}

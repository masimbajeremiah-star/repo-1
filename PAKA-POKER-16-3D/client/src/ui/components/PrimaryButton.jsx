export default function PrimaryButton({ children, onClick, disabled }) {
  return (
    <button type="button" className="primary-button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export default function PrimaryButton({ children, onClick, disabled, type = 'button' }) {
  return (
    <button type={type} className="primary-button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

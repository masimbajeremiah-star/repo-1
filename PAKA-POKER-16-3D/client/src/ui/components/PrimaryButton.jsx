export default function PrimaryButton({ children, onClick, disabled, type = 'button', ...buttonProps }) {
  return (
    <button {...buttonProps} type={type} className="primary-button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

'use client';
export function PasswordField({ id, label, autoComplete, describedBy }: {
  id: string; label: string; autoComplete: 'current-password' | 'new-password'; describedBy?: string;
}) {
  return <div className="field">
    <label htmlFor={id}>{label}</label>
    <input id={id} name={id} type="password" autoComplete={autoComplete}
      required aria-describedby={describedBy} spellCheck={false} autoCapitalize="none" />
  </div>;
}

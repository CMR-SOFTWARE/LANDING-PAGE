import type { ReactNode } from "react";

type Props = {
  id: string;
  label: ReactNode;
  error?: string;
  full?: boolean;
  children: ReactNode;
};

export function FormField({ id, label, error, full, children }: Props) {
  return (
    <div className={`form-field${full ? " form-field--full" : ""}${error ? " is-invalid" : ""}`}>
      <label htmlFor={id}>{label}</label>
      <span className="form-input-shell">{children}</span>
      {error ? (
        <p className="form-field-error" id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

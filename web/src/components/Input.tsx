import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const inputId = id ?? props.name ?? (label ? slugify(label) : undefined);
    return (
      <div className="w-full">
        {label && (
          <label className="label" htmlFor={inputId}>
            {label}
          </label>
        )}
        <input id={inputId} ref={ref} className={`input ${className ?? ''}`} {...props} />
        {error && <p className="text-danger-600 text-sm mt-1">{error}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';

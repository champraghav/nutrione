import React from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, className, id, children, ...props }, ref) => {
    const selectId = id ?? props.name ?? (label ? slugify(label) : undefined);
    return (
      <div className="w-full">
        {label && (
          <label className="label" htmlFor={selectId}>
            {label}
          </label>
        )}
        <select id={selectId} ref={ref} className={`input ${className ?? ''}`} {...props}>
          {children}
        </select>
      </div>
    );
  }
);
Select.displayName = 'Select';

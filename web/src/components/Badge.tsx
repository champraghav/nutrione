import React from 'react';
import clsx from 'clsx';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'primary' | 'gray';

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  success: 'bg-success-100 text-success-700',
  warning: 'bg-warning-100 text-warning-600',
  danger: 'bg-danger-100 text-danger-600',
  primary: 'bg-primary-100 text-primary-700',
  gray: 'bg-gray-100 text-gray-700',
};

export function Badge({ variant = 'gray', children }: { variant?: BadgeVariant; children: React.ReactNode }) {
  return (
    <span className={clsx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', VARIANT_CLASSES[variant])}>
      {children}
    </span>
  );
}

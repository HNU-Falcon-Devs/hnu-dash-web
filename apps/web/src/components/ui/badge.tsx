import React from 'react';
import { cn } from '@/utils/cn';
import type {
  AttendanceStatus,
  GlobalSystemRole,
  TenantMemberRole,
} from '@/lib/definitions';
import {
  ATTENDANCE_STATUS_CONFIG,
  GLOBAL_ROLE_CONFIG,
  TENANT_ROLE_CONFIG,
} from '@/lib/constants';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | 'default'
    | 'primary'
    | 'success'
    | 'warning'
    | 'danger'
    | 'purple'
    | 'outline';
  size?: 'sm' | 'md';
  dot?: boolean;
}

export function Badge({
  className,
  variant = 'default',
  size = 'sm',
  dot = false,
  children,
  ...props
}: BadgeProps) {
  const baseStyles =
    'inline-flex items-center font-medium rounded-full border transition-colors select-none';

  const variants = {
    default: 'bg-slate-100 text-slate-700 border-slate-200/80',
    primary: 'bg-blue-50 text-blue-700 border-blue-200/80',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    warning: 'bg-amber-50 text-amber-700 border-amber-200/80',
    danger: 'bg-rose-50 text-rose-700 border-rose-200/80',
    purple: 'bg-purple-50 text-purple-700 border-purple-200/80',
    outline: 'bg-transparent text-slate-700 border-slate-300',
  };

  const sizes = {
    sm: 'text-xs px-2.5 py-0.5 gap-1.5',
    md: 'text-sm px-3 py-1 gap-2',
  };

  const dotColors = {
    default: 'bg-slate-400',
    primary: 'bg-blue-600',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-rose-500',
    purple: 'bg-purple-600',
    outline: 'bg-slate-500',
  };

  return (
    <span
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      {...props}
    >
      {dot && (
        <span
          className={cn('h-1.5 w-1.5 rounded-full shrink-0', dotColors[variant])}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}

/**
 * Pre-configured badge for organization-scoped member roles.
 */
export function TenantRoleBadge({ role }: { role: TenantMemberRole }) {
  const config = TENANT_ROLE_CONFIG[role];
  const variantMap: Record<TenantMemberRole, BadgeProps['variant']> = {
    admin: 'purple',
    officer: 'primary',
    student: 'default',
  };

  return (
    <Badge variant={variantMap[role]} dot>
      {config.label}
    </Badge>
  );
}

/**
 * Pre-configured badge for platform-wide authority.
 */
export function GlobalRoleBadge({ role }: { role: GlobalSystemRole }) {
  const config = GLOBAL_ROLE_CONFIG[role];
  const variant = role === 'admin' ? 'warning' : 'default';

  return (
    <Badge variant={variant} dot>
      {config.label}
    </Badge>
  );
}

/**
 * Pre-configured badge for individual scan verification states.
 */
export function AttendanceStatusBadge({ status }: { status: AttendanceStatus }) {
  const config = ATTENDANCE_STATUS_CONFIG[status];
  const variantMap: Record<AttendanceStatus, BadgeProps['variant']> = {
    present: 'success',
    late: 'warning',
    excused: 'primary',
  };

  return (
    <Badge variant={variantMap[status]} dot>
      {config.label}
    </Badge>
  );
}

import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  block?: boolean;
  jumbo?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

/**
 * Accessible button: always a real <button> with an explicit type, a 44px minimum touch
 * target from CSS, a visible focus ring, and support for a supplementary description via
 * aria-describedby-free `title`-less hint text passed as aria-label.
 */
export function Button({
  variant = 'primary',
  block = false,
  jumbo = false,
  icon,
  children,
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = [
    'btn',
    `btn--${variant}`,
    block ? 'btn--block' : '',
    jumbo ? 'btn--jumbo' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type} className={classes} {...rest}>
      {icon ? (
        <span aria-hidden="true" className="btn__icon">
          {icon}
        </span>
      ) : null}
      <span>{children}</span>
    </button>
  );
}

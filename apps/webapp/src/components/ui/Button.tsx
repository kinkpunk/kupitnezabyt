import React, { type ButtonHTMLAttributes, type ReactNode } from "react";

type ButtonVariant = "primary" | "ghost" | "icon";
type ButtonSize = "default" | "compact";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "default",
  className = "",
  children,
  ...rest
}: ButtonProps) {
  const baseClass = `ds-button ds-button--${variant}`;
  const sizeClass = variant === "primary" ? ` ds-button--${size}` : "";
  return (
    <button className={`${baseClass}${sizeClass} ${className}`.trim()} type="button" {...rest}>
      {children}
    </button>
  );
}

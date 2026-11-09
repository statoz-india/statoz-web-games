import type { SVGProps } from "react";

export type IconProps = {
  size?: number;
};

// Decorative: every icon sits next to a visible or aria-label name.
export function SvgIcon({
  size = 20,
  children,
  ...rest
}: IconProps & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

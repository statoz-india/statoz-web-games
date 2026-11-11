import { SvgIcon, type IconProps } from "./svg.icon";

export function ClockIcon({ size = 13 }: IconProps) {
  return (
    <SvgIcon
      size={size}
      viewBox="0 0 16 16"
      strokeWidth={1.5}
      strokeLinecap="butt"
      strokeLinejoin="miter"
    >
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 4.5v3.8l2.5 1.5" />
    </SvgIcon>
  );
}

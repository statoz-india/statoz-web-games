import { SvgIcon, type IconProps } from "./svg.icon";

// Winners' podium under a crown.
export function PodiumIcon({ size = 30 }: IconProps) {
  return (
    <SvgIcon
      size={size}
      viewBox="0 0 32 32"
      strokeWidth={1.75}
      strokeLinecap="butt"
      strokeLinejoin="miter"
      strokeMiterlimit={2}
    >
      <path d="M2 28H30" />
      <path d="M4 28V21H11" />
      <path d="M11 28V15H21V28" />
      <path d="M21 21H28V28" />
      <path
        d="M11 12L12 5L14.5 8L16 4L17.5 8L20 5L21 12Z"
        fill="currentColor"
        fillRule="evenodd"
        stroke="none"
      />
    </SvgIcon>
  );
}

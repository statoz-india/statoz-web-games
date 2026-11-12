import { SvgIcon, type IconProps } from "./svg.icon";

// Loot chest: chamfered lid, banded body and a lock.
export function ChestIcon({ size = 30 }: IconProps) {
  return (
    <SvgIcon
      size={size}
      viewBox="0 0 32 32"
      strokeWidth={1.75}
      strokeLinecap="butt"
      strokeLinejoin="miter"
      strokeMiterlimit={2}
    >
      <path d="M4 14V10L8 6H24L28 10V14" />
      <path d="M4 14H28V25L26 27H6L4 25Z" />
      <path d="M10 6V14M22 6V14" />
      <path
        d="M14 12H18V18L16 20L14 18Z"
        fill="currentColor"
        fillRule="evenodd"
        stroke="none"
      />
    </SvgIcon>
  );
}

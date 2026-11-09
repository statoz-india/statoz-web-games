import { SvgIcon, type IconProps } from "./svg.icon";

export function LibraryIcon({ size }: IconProps) {
  return (
    <SvgIcon size={size}>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1" />
    </SvgIcon>
  );
}

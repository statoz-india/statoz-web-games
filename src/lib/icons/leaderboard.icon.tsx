import { SvgIcon, type IconProps } from "./svg.icon";

export function LeaderboardIcon({ size }: IconProps) {
  return (
    <SvgIcon size={size}>
      <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
      <path d="M8 6H5a3 3 0 0 0 3 4.5M16 6h3a3 3 0 0 1-3 4.5" />
      <path d="M12 13v4M9 20h6M10 17h4" />
    </SvgIcon>
  );
}

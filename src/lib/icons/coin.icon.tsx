import { SvgIcon, type IconProps } from "./svg.icon";

export function CoinIcon({ size }: IconProps) {
  return (
    <SvgIcon size={size}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
    </SvgIcon>
  );
}

import { SvgIcon, type IconProps } from "./svg.icon";

export function ShopIcon({ size }: IconProps) {
  return (
    <SvgIcon size={size}>
      <path d="M5.5 8h13l-1 12h-11z" />
      <path d="M9 10V7a3 3 0 0 1 6 0v3" />
    </SvgIcon>
  );
}

import { SvgIcon, type IconProps } from "./svg.icon";

export function PauseIcon({ size = 14 }: IconProps) {
  return (
    <SvgIcon size={size} viewBox="0 0 16 16" fill="currentColor" stroke="none">
      <path d="M4 3h3v10H4zM10 3h3v10h-3z" />
    </SvgIcon>
  );
}

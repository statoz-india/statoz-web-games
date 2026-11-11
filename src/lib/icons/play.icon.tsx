import { SvgIcon, type IconProps } from "./svg.icon";

export function PlayIcon({ size = 15 }: IconProps) {
  return (
    <SvgIcon size={size} viewBox="0 0 16 16" fill="currentColor" stroke="none">
      <path d="M4 2v12l10-6z" />
    </SvgIcon>
  );
}

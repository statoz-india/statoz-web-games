import { SvgIcon, type IconProps } from "./svg.icon";

// Material Symbols "close".
export function CloseIcon({ size = 20 }: IconProps) {
  return (
    <SvgIcon
      size={size}
      viewBox="0 -960 960 960"
      fill="currentColor"
      stroke="none"
    >
      <path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z" />
    </SvgIcon>
  );
}

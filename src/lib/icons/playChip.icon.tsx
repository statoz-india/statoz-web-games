import { SvgIcon, type IconProps } from "./svg.icon";

// Narrower than PlayIcon so it sits evenly beside the chip's small label.
export function PlayChipIcon({ size = 12 }: IconProps) {
  return (
    <SvgIcon size={size} viewBox="0 0 16 16" fill="currentColor" stroke="none">
      <path d="M5 3v10l8-5z" />
    </SvgIcon>
  );
}

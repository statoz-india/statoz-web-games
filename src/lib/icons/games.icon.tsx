import { SvgIcon, type IconProps } from "./svg.icon";

export function GamesIcon({ size }: IconProps) {
  return (
    <SvgIcon size={size}>
      <path d="M7 6h10a4 4 0 0 1 3.98 3.6l.52 5.2A2.9 2.9 0 0 1 16.4 17l-1.4-2H9l-1.4 2a2.9 2.9 0 0 1-5.1-2.2l.52-5.2A4 4 0 0 1 7 6z" />
      <path d="M7 10.5h3M8.5 9v3" />
      <path d="M15 10h.01M17 12h.01" />
    </SvgIcon>
  );
}

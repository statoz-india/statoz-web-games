import { SvgIcon, type IconProps } from "./svg.icon";

export function FlameIcon({ size }: IconProps) {
  return (
    <SvgIcon size={size} fill="currentColor" stroke="none">
      <path d="M12.5 2.5c.6 3.2 4.5 5.2 4.5 10a5 5 0 0 1-10 0c0-2.6 1.4-4.3 2.7-5.4-.1 2 .7 3.4 2 3.9-.7-3.1-.2-6 .8-8.5z" />
    </SvgIcon>
  );
}

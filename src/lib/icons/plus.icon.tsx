import { SvgIcon, type IconProps } from "./svg.icon";

export function PlusIcon({ size = 12 }: IconProps) {
  return (
    <SvgIcon size={size} strokeWidth={3}>
      <path d="M12 5v14M5 12h14" />
    </SvgIcon>
  );
}

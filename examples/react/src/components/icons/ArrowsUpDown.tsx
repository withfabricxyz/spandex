import type { IconProps } from "./types";

export function ArrowsUpDown({
  className,
  width = 16,
  height = 20,
  fill,
  title = "Switch",
  style,
}: IconProps & {
  style?: React.CSSProperties;
}) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox="0 0 16 20"
      fill={fill || "none"}
      aria-hidden={!title}
      style={style}
    >
      <title>{title}</title>
      <path d="M16 15L11 20L6 15L7.425 13.6L10 16.175V9H12V16.175L14.575 13.6L16 15ZM10 5L8.575 6.4L6 3.825V11H4V3.825L1.425 6.4L0 5L5 0L10 5Z" />
    </svg>
  );
}

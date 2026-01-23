import type { IconProps } from "./types";

export function ChevronDown({
  className,
  width = 12,
  height = 8,
  fill,
  title = "Chevron Down",
}: IconProps) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox="0 0 12 8"
      fill={fill || "none"}
      aria-hidden={!title}
    >
      <title>{title}</title>
      <path d="M6 7.4L0 1.4L1.4 0L6 4.6L10.6 0L12 1.4L6 7.4Z" fill={fill || "#0F0F0F"} />
    </svg>
  );
}

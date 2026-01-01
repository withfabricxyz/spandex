import type { IconProps } from "./types";

export function Check({ className, width = 11, height = 9, fill, title = "Check" }: IconProps) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox="0 0 11 9"
      fill={fill || "none"}
      aria-hidden={!title}
    >
      <title>{title}</title>
      <path d="M3.8 8.01667L0 4.21667L0.95 3.26667L3.8 6.11667L9.91667 0L10.8667 0.95L3.8 8.01667Z" />
    </svg>
  );
}

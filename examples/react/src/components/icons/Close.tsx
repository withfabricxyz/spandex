import type { IconProps } from "./types";

export function Close({ className, width = 10, height = 10, fill, title = "Close" }: IconProps) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox="0 0 10 10"
      fill={fill || "none"}
      aria-hidden={!title}
    >
      <title>{title}</title>
      <path d="M0.933334 9.33334L0 8.4L3.73333 4.66667L0 0.933334L0.933334 0L4.66667 3.73333L8.4 0L9.33334 0.933334L5.6 4.66667L9.33334 8.4L8.4 9.33334L4.66667 5.6L0.933334 9.33334Z" />
    </svg>
  );
}

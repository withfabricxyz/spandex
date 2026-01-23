import type { IconProps } from "./types";

export function CloseAlt({ className, width = 12, height = 12, fill, title = "Close" }: IconProps) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox="0 0 12 12"
      fill={fill || "none"}
      aria-hidden={!title}
    >
      <title>{title}</title>
      <path
        d="M1.2 12L0 10.8L4.8 6L0 1.2L1.2 0L6 4.8L10.8 0L12 1.2L7.2 6L12 10.8L10.8 12L6 7.2L1.2 12Z"
        fill={fill || "#0F0F0F"}
      />
    </svg>
  );
}

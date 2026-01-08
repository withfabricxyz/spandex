import type { ForwardedRef } from "react";

export interface IconProps {
  className?: string;
  width?: number;
  height?: number;
  fill?: string;
  title?: string;
  ref?: ForwardedRef<SVGSVGElement>;
}

import { motion, useAnimationFrame, useMotionValue } from "motion/react";
import { useLayoutEffect, useRef } from "react";

/** Normal scroll speed in seconds per content-width. Lower = faster. */
export const MARQUEE_DURATION = 40;
export const MARQUEE_HOVER_DURATION = 120;

export default function Marquee({
  children,
  direction = "rtl",
  gap = 40,
  duration = MARQUEE_DURATION,
  hoverDuration = MARQUEE_HOVER_DURATION,
}: {
  children: React.ReactNode;
  direction?: "ltr" | "rtl";
  gap?: number;
  duration?: number;
  hoverDuration?: number;
}) {
  const x = useMotionValue(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const hoveredRef = useRef(false);

  // LTR starts at -contentWidth so logos enter from the left on first frame
  useLayoutEffect(() => {
    if (direction === "ltr" && contentRef.current) {
      x.set(-contentRef.current.offsetWidth);
    }
  }, [direction, x]);

  useAnimationFrame((_, delta) => {
    const contentWidth = contentRef.current?.offsetWidth ?? 0;
    if (contentWidth === 0) return;

    const activeDuration = hoveredRef.current ? hoverDuration : duration;
    const step = (contentWidth / (activeDuration * 1000)) * delta;

    let newX: number;
    if (direction === "rtl") {
      newX = x.get() - step;
      if (newX <= -contentWidth) newX += contentWidth;
    } else {
      newX = x.get() + step;
      if (newX >= 0) newX -= contentWidth;
    }

    x.set(newX);
  });

  const groupStyle = {
    gap: `${gap}px`,
    paddingRight: `${gap}px`,
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: <>
    <div
      className="overflow-hidden w-full"
      onMouseEnter={() => {
        hoveredRef.current = true;
      }}
      onMouseLeave={() => {
        hoveredRef.current = false;
      }}
    >
      <motion.div className="flex w-max items-center" style={{ x }}>
        <div ref={contentRef} className="flex shrink-0 items-center" style={groupStyle}>
          {children}
        </div>
        <div className="flex shrink-0 items-center" style={groupStyle} aria-hidden="true">
          {children}
        </div>
      </motion.div>
    </div>
  );
}

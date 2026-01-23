import { useEffect, useState } from "react";

/**
 * A hook to get the current visual viewport's height.
 * This is useful for adjusting layouts when the on-screen virtual keyboard appears on mobile devices.
 * @returns The height of the visual viewport in pixels, or `undefined` if not available on the server.
 */
export function useVisualViewportHeight() {
  const [height, setHeight] = useState<number | undefined>(
    typeof window !== "undefined" ? window.innerHeight : undefined,
  );

  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;

    const visualViewport = window.visualViewport;

    const handleResize = () => {
      setHeight(visualViewport.height);
    };

    setHeight(visualViewport.height);

    visualViewport.addEventListener("resize", handleResize);

    return () => {
      visualViewport.removeEventListener("resize", handleResize);
    };
  }, []);

  return height;
}

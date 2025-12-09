import { useNoScroll } from "../../hooks/useNoScroll";
import { useVisualViewportHeight } from "../../hooks/useVisualViewportHeight";
import { getSafeAreaValue } from "../../utils/dom";

import "./BottomSheet.css";

interface BottomSheetProps extends React.HTMLAttributes<HTMLDivElement> {
  isOpen: boolean;
  /*
   * the site header is already accounted for; this is a list of additional safe areas.
   *
   * the position/order of the safe area in the DOM doesn't matter; all safe area heights are summed
   * to determine the maximum height of the bottom sheet.
   *
   * useful in cases where you have additional components that are competing for vertical space
   * such as a mobile search input beneath the bottom sheet.
   */
  safeAreas?: string[];
  onInteractOutside?: () => void;
}

export function BottomSheet({
  className,
  children,
  isOpen,
  safeAreas,
  onInteractOutside,
}: BottomSheetProps) {
  const viewportHeight = useVisualViewportHeight();
  const headerHeight = getSafeAreaValue("--safe-area-site-header");
  const additionalOffsetsSum = safeAreas
    ? safeAreas.map(getSafeAreaValue).reduce((a, b) => a + b, 0)
    : 0;
  const style = viewportHeight
    ? {
        maxHeight: `${viewportHeight - (headerHeight + additionalOffsetsSum)}px`,
      }
    : {};
  const classNames = [
    "bottom-sheet",
    isOpen ? "bottom-sheet--open" : "",
    "no-scrollbar",
    className || "",
  ].join(" ");

  useNoScroll(isOpen);

  return (
    <>
      {/** biome-ignore lint/a11y/noStaticElementInteractions: <> */}
      <div
        className={`bottom-sheet__scrim ${isOpen ? "bottom-sheet__scrim--open" : ""}`}
        onClick={onInteractOutside}
        onKeyUp={onInteractOutside}
      />
      <div className={classNames} style={style}>
        {children}
      </div>
    </>
  );
}

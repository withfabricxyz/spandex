interface ScrimProps {
  isOpen: boolean;
  zIndex?: string;
  onClick?: () => void;
}

export function Scrim({ isOpen, zIndex = "z-layer-dialog-scrim", onClick }: ScrimProps) {
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: scrim
    <div
      className={`fixed top-0 left-0 w-full h-full ${zIndex} bg-surface-sub backdrop-blur-xs ${isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
      onClick={onClick}
      onKeyUp={onClick}
    />
  );
}

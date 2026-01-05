import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { THEME_VALUES, THEMES, type Theme, useTheme } from "../../hooks/useTheme";

const createThemeSelection = (name: Theme) => ({
  name,
  colors: THEME_VALUES[name],
  icon: () => {
    const primary = THEME_VALUES[name][0];
    const secondary = THEME_VALUES[name][1];

    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
      >
        <title>{name}</title>
        <g clipPath="url(#clip0_189_7073)">
          <path
            d="M17.0711 2.92893C16.1425 2.00035 15.0401 1.26375 13.8269 0.761204C12.6136 0.258658 11.3133 6.7946e-07 10 5.11064e-09C8.68683 8.48048e-07 7.38647 0.258658 6.17321 0.761205C4.95995 1.26375 3.85756 2.00035 2.92898 2.92893C2.00039 3.85752 1.2638 4.95991 0.76125 6.17317C0.258703 7.38642 4.55431e-05 8.68678 4.57116e-05 10C4.58802e-05 11.3132 0.258704 12.6136 0.761251 13.8268C1.2638 15.0401 2.00039 16.1425 2.92898 17.0711L10 10L17.0711 2.92893Z"
            fill={primary}
          />
          <path
            d="M2.92898 17.0711C3.85756 17.9997 4.95995 18.7362 6.17321 19.2388C7.38647 19.7413 8.68683 20 10 20C11.3133 20 12.6136 19.7413 13.8269 19.2388C15.0401 18.7362 16.1425 17.9997 17.0711 17.0711C17.9997 16.1425 18.7363 15.0401 19.2388 13.8268C19.7414 12.6136 20 11.3132 20 10C20 8.68678 19.7414 7.38642 19.2388 6.17317C18.7363 4.95991 17.9997 3.85752 17.0711 2.92893L10 10L2.92898 17.0711Z"
            fill={secondary}
          />
        </g>
        <rect
          x="0.5"
          y="0.5"
          width="19"
          height="19"
          rx="9.5"
          stroke="#0f0f0f"
          strokeOpacity="0.05"
        />
        <defs>
          <clipPath id="clip0_189_7073">
            <rect width="20" height="20" rx="10" fill="white" />
          </clipPath>
        </defs>
      </svg>
    );
  },
});

export const ThemePicker = () => {
  const { theme, setTheme } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const [displayOrder, setDisplayOrder] = useState<Theme[]>(() => {
    return [theme, ...THEMES.filter((name) => name !== theme)];
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const isMouseDownInsideRef = useRef(false);

  const orderedThemes = useMemo(() => {
    return displayOrder.map(createThemeSelection);
  }, [displayOrder]);

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setTheme(event.target.value as Theme);
    },
    [setTheme],
  );

  const handleLabelClick = useCallback(() => {
    if (!isExpanded) {
      setIsExpanded(true);
    }
  }, [isExpanded]);

  const handleClose = useCallback(() => {
    setIsExpanded(false);
    setDisplayOrder([theme, ...THEMES.filter((name) => name !== theme)]);
  }, [theme]);

  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      isMouseDownInsideRef.current = containerRef.current?.contains(event.target as Node) ?? false;
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (
        !isMouseDownInsideRef.current &&
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        handleClose();
      }
    };

    if (isExpanded) {
      document.addEventListener("mousedown", handleMouseDown);
      document.addEventListener("click", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("click", handleClickOutside);
    };
  }, [isExpanded, handleClose]);

  return (
    <section
      ref={containerRef}
      className={`fixed top-1/2 right-10 -translate-y-1/2 ${isExpanded ? "h-78" : "overflow-hidden h-14"} transition-all duration-500 origin-center`}
      aria-label="Theme picker"
    >
      <form className="flex flex-col gap-2">
        <fieldset className="border-0 p-0 m-0">
          <legend className="sr-only">Choose theme</legend>
          {orderedThemes.map(({ name, colors, icon }) => (
            <div key={name} className="relative">
              <input
                type="radio"
                id={`theme-${name}`}
                name="theme"
                value={name}
                checked={theme === name}
                onChange={handleChange}
                className="sr-only peer"
              />
              <label
                htmlFor={`theme-${name}`}
                onClick={handleLabelClick}
                onKeyDown={handleLabelClick}
                className="block p-2 rounded-full cursor-pointer"
                title={`Switch to ${name} theme`}
              >
                {icon()}
              </label>
              <div
                className={`
                  absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-layer-background scale-0 origin-center transition-transform rounded-full h-15 w-15 pointer-events-none
                  ${theme === name && isExpanded ? "scale-100" : "scale-0"}
                `}
                style={{ border: `0.125rem solid ${colors[1]}` }}
                aria-hidden="true"
              />
            </div>
          ))}
        </fieldset>
      </form>
    </section>
  );
};

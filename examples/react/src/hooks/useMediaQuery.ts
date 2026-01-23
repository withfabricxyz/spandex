import { useCallback, useEffect, useState } from "react";

export function useMediaQuery(query: string): boolean {
  const getMatches = useCallback((query: string): boolean => {
    // prevents SSR issues
    if (typeof window !== "undefined") return window.matchMedia(query).matches;
    return false;
  }, []);

  const [matches, setMatches] = useState<boolean>(getMatches(query));

  useEffect(() => {
    const matchMedia = window.matchMedia(query);

    const handleChange = () => {
      setMatches(getMatches(query));
    };

    handleChange();

    matchMedia.addEventListener("change", handleChange);

    return () => {
      matchMedia.removeEventListener("change", handleChange);
    };
  }, [query, getMatches]);

  return matches;
}

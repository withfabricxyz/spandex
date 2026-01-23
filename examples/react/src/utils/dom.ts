export const getSafeAreaValue = (property: string): number => {
  if (typeof window === "undefined" || !window.document) return 0;
  const value = window.getComputedStyle(window.document.documentElement).getPropertyValue(property);
  return Number(value.replace("px", ""));
};

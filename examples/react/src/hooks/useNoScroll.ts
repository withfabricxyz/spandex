import { useLayoutEffect } from "react";

export function useNoScroll(condition: boolean) {
  useLayoutEffect(() => {
    if (condition) {
      document.body.classList.add("no-scroll");
    } else {
      document.body.classList.remove("no-scroll");
    }

    return () => {
      document.body.classList.remove("no-scroll");
    };
  }, [condition]);
}

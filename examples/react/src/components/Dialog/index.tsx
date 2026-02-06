import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
// import { IconClose } from "~/components/library/Icons/IconClose";
// import { Subheadline500 } from "~/components/library/Typography";
// import { BottomSheet } from "../BottomSheet";
// import { IconButton } from "../IconButton";

import "./Dialog.css";
import { BottomSheet } from "../BottomSheet";

interface DialogProps extends React.PropsWithChildren {
  title: string;
  isOpen?: boolean;
  onClose?: () => void;
}

export function DialogPortal() {
  return <div id="dialog-root" />;
}

export function Dialog(props: DialogProps) {
  const root = useRef(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        props.onClose?.();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [props.onClose, props]);

  useEffect(() => {
    if (props.isOpen) {
      document.body.classList.add("no-scroll");
    } else {
      document.body.classList.remove("no-scroll");
    }

    return () => {
      document.body.classList.remove("no-scroll");
    };
  }, [props.isOpen]);

  if (!props.isOpen) return null;

  return createPortal(
    <div ref={root} className="dialog">
      <BottomSheet
        isOpen={props.isOpen}
        onInteractOutside={props.onClose}
        className="dialog__sheet"
      >
        <div className="dialog__content">
          <div className="dialog__title">
            <span className="text-[20px]">{props.title}</span>
            {/* <IconButton
              icon={<IconClose />}
              onClick={() => {
                props.onClose?.();
              }}
            /> */}
          </div>
          {props.children}
        </div>
      </BottomSheet>
    </div>,
    // biome-ignore lint/style/noNonNullAssertion: <>
    document.getElementById("dialog-root")!,
  );
}

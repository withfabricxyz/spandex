import { Link } from "@tanstack/react-router";
import type { JSX } from "react";
import { type ExternalToast, toast as sonnerToast, Toaster, type ToastT } from "sonner";
import { useMediaQuery } from "@/hooks/useMediaQuery";

interface ToastProps extends ToastT {
  message: string;
  link?: {
    href: string;
    label: JSX.Element | string;
    openInNewTab?: boolean;
  };
}

function Toast(props: ToastProps) {
  const { id, message, link, icon } = props;

  return (
    <div className="bg-primary text-surface-base p-8 rounded-xs text-[12px] font-['Sohne_Breit']">
      <div className="flex flex-row items-center gap-4">
        {icon && <div className="w-8 h-8">{icon}</div>}
        <div className="flex gap-10 items-center">
          <div>{message}</div>
          {link && (
            <Link
              to={link.href}
              target={link.openInNewTab ? "_blank" : "_self"}
              className="border-b flex items-baseline gap-2"
              onClick={() => {
                sonnerToast.dismiss(id);
              }}
            >
              {link.label}
              {link.openInNewTab && (
                <div className="h-8 w-8 flex items-center justify-center">
                  <svg
                    className="fill-surface-base"
                    xmlns="http://www.w3.org/2000/svg"
                    width="9"
                    height="9"
                    viewBox="0 0 9 9"
                    fill="none"
                  >
                    <title>Opens in new tab</title>
                    <path d="M0.933333 8.66667L0 7.73333L6.4 1.33333H0.666667V0H8.66667V8H7.33333V2.26667L0.933333 8.66667Z" />
                  </svg>
                </div>
              )}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export function toast(
  message: string,
  options?: Omit<ToastProps, "id" | "message"> & ExternalToast,
) {
  const { link, icon, ...sonnerOptions } = options || {};

  const toastId = sonnerToast.custom(
    (id) => <Toast id={id} message={message} link={link} icon={icon} />,
    sonnerOptions,
  );

  return {
    dismiss: () => sonnerToast.dismiss(toastId),
  };
}

export function ToastPortal() {
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  return <Toaster position={isDesktop ? "bottom-right" : "bottom-center"} />;
}

import { type ComponentPropsWithoutRef, forwardRef, type ReactNode } from "react";
import { twMerge } from "tailwind-merge";

type ButtonProps = {
  children: ReactNode;
  className?: string;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  size?: "md" | "lg";
  variant?: "primary" | "secondary";
  onClick?: () => void;
} & Omit<
  ComponentPropsWithoutRef<"button">,
  "children" | "className" | "type" | "disabled" | "onClick"
>;

const BigButton = forwardRef<HTMLButtonElement, Omit<ButtonProps, "size" | "variant">>(
  ({ type, disabled, onClick, children, ...rest }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled}
        onClick={onClick}
        className="bg-primary py-10 px-5 flex justify-center items-center gap-5 text-surface-base text-[40px] uppercase leading-[0.825] h-34.5 rounded-xs cursor-pointer disabled:bg-surface-sub hover:text-quaternary active:bg-secondary"
        {...rest}
      >
        {children}
      </button>
    );
  },
);

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className,
      type = "button",
      disabled,
      size = "md",
      variant = "primary",
      onClick,
      ...rest
    },
    ref,
  ) => {
    const classNames = twMerge(
      variant === "primary"
        ? "bg-primary text-surface-base hover:text-quaternary hover:bg-primary active:text-quaternary active:bg-secondary"
        : "bg-surface-base text-primary hover:bg-surface-mid active:bg-border",
      "relative text-xs cursor-pointer border border-primary rounded-xs p-4 h-20 flex gap-4 items-center justify-between whitespace-nowrap",
      className,
    );

    if (size === "lg") {
      return (
        <BigButton ref={ref} type={type} disabled={disabled} onClick={onClick} {...rest}>
          {children}
        </BigButton>
      );
    }

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled}
        className={classNames}
        onClick={onClick}
        {...rest}
      >
        {children}
      </button>
    );
  },
);

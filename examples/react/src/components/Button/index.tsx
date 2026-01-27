import type { ReactNode } from "react";

type ButtonProps = {
  children: ReactNode;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  size?: "md" | "lg";
  variant?: "primary" | "secondary";
  onClick?: () => void;
};

function BigButton(props: Omit<ButtonProps, "size">) {
  return (
    <button
      type={props.type}
      disabled={props.disabled}
      onClick={props.onClick}
      className="bg-primary py-10 px-5 flex justify-center items-center gap-5 text-surface-base text-[40px] uppercase leading-[0.825] h-34.5 rounded-xs cursor-pointer disabled:bg-surface-sub"
    >
      {props.children}
    </button>
  );
}

export function Button({
  children,
  type = "button",
  disabled,
  size = "md",
  variant = "primary",
  onClick,
}: ButtonProps) {
  if (size === "lg") {
    return (
      <BigButton type={type} disabled={disabled} onClick={onClick}>
        {children}
      </BigButton>
    );
  }

  return (
    <button
      type={type}
      disabled={disabled}
      className={`${variant === "primary" ? "bg-primary text-surface-base" : "bg-surface-base text-primary"} relative text-xs cursor-pointer border border-primary rounded-xs p-4 h-20 flex gap-4 items-center justify-between whitespace-nowrap`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

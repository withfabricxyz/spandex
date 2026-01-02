import type { ReactNode } from "react";

type ButtonProps = {
  children: ReactNode;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  size?: "md" | "lg";
  onClick?: () => void;
};

function BigButton(props: Omit<ButtonProps, "size">) {
  return (
    <button
      type={props.type}
      disabled={props.disabled}
      onClick={props.onClick}
      className="bg-primary py-10 px-5 flex justify-center items-center gap-5 text-surface-base text-[40px] uppercase leading-[0.825] h-[69px] rounded-xs cursor-pointer"
    >
      {props.children}
    </button>
  );
}

export function Button({ children, type = "button", disabled, size = "md", onClick }: ButtonProps) {
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
      className="relative bg-surface-base text-xs cursor-pointer border border-primary rounded-xs p-4 h-20 flex gap-4 items-center justify-between whitespace-nowrap text-primary"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

import * as RadixTooltip from "@radix-ui/react-tooltip";
import { useState } from "react";
import { useMediaQuery } from "@/hooks/useMediaQuery";

export function Tooltip({
  trigger,
  content,
}: {
  trigger: React.ReactNode;
  content: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const isMobile = useMediaQuery("(max-width: 768px)");

  return (
    <RadixTooltip.Root delayDuration={250} {...(isMobile ? { open } : undefined)}>
      <RadixTooltip.Trigger
        {...(isMobile
          ? { onClick: () => setOpen(!open), onBlur: () => setOpen(false) }
          : undefined)}
        tabIndex={0}
        asChild
      >
        {trigger}
      </RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content className="rounded-xs monospace z-layer-tooltip max-w-xs bg-surface-mid p-10 text-[12px] text-primary leading-9">
          {content}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}

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
        <RadixTooltip.Content className="monospace z-layer-tooltip max-w-xs rounded-1 bg-primary p-5 text-[12px] text-surface-base leading-9">
          {content}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}

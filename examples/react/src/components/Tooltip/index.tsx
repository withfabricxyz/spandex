import * as RadixTooltip from "@radix-ui/react-tooltip";

export function Tooltip({
  trigger,
  content,
}: {
  trigger: React.ReactNode;
  content: React.ReactNode;
}) {
  return (
    <RadixTooltip.Root delayDuration={250}>
      <RadixTooltip.Trigger asChild>{trigger}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content className="monospace z-layer-tooltip max-w-xs rounded-1 bg-primary p-5 text-[12px] text-surface-base leading-9">
          {content}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}

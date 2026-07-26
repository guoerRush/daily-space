"use client";

import * as React from "react";
import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  HTMLElement,
  React.ComponentProps<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full bg-input transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 data-checked:bg-primary data-disabled:cursor-not-allowed data-disabled:opacity-50",
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb className="pointer-events-none block size-4 translate-x-0.5 rounded-full bg-background shadow-sm transition-transform data-checked:translate-x-4" />
  </SwitchPrimitive.Root>
));
Switch.displayName = "Switch";

export { Switch };

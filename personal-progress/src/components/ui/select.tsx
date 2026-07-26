"use client";

import * as React from "react";
import { Select as SelectPrimitive } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const Select = SelectPrimitive.Root;
const SelectGroup = SelectPrimitive.Group;
const SelectValue = SelectPrimitive.Value;
const SelectLabel = SelectPrimitive.Label;
const SelectSeparator = SelectPrimitive.Separator;
const SelectScrollUpButton = SelectPrimitive.ScrollUpArrow;
const SelectScrollDownButton = SelectPrimitive.ScrollDownArrow;
const SelectPortal = SelectPrimitive.Portal;

const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-9 min-w-44 items-center justify-between gap-2 rounded-[calc(var(--radius)+2px)] border border-input/75 bg-card px-3 text-sm shadow-sm outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50",
      className,
    )}
    {...props}
  >
    {children}
    <ChevronDown className="size-4 opacity-60" />
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = "SelectTrigger";

const SelectContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof SelectPrimitive.Popup>
>(({ className, children, ...props }, ref) => (
  <SelectPortal>
    <SelectPrimitive.Positioner sideOffset={4} className="z-50">
      <SelectPrimitive.Popup
        ref={ref}
        className={cn(
          "min-w-[var(--anchor-width)] overflow-hidden rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-none",
          className,
        )}
        {...props}
      >
        {children}
      </SelectPrimitive.Popup>
    </SelectPrimitive.Positioner>
  </SelectPortal>
));
SelectContent.displayName = "SelectContent";

const SelectItem = React.forwardRef<
  HTMLElement,
  React.ComponentProps<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-default items-center rounded-md py-2 pl-8 pr-2 text-sm outline-none data-highlighted:bg-muted",
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 flex size-4 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="size-4" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = "SelectItem";

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectLabel,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
  SelectPortal,
  SelectTrigger,
  SelectContent,
  SelectItem,
};

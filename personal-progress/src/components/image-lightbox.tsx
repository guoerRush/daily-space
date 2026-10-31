"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ImageLightboxProps = {
  src: string;
  alt: string;
  renderTrigger: (openPreview: () => void) => ReactNode;
};

export function ImageLightbox({
  src,
  alt,
  renderTrigger,
}: ImageLightboxProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {renderTrigger(() => setOpen(true))}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="h-[min(92vh,60rem)] w-[min(96vw,90rem)] max-w-none gap-0 overflow-hidden bg-black/90 p-0 ring-0 sm:max-w-none"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>{alt || "图片预览"}</DialogTitle>
            <DialogDescription>
              图片放大预览。按 Esc 键或点击遮罩可关闭。
            </DialogDescription>
          </DialogHeader>
          <div className="relative size-full">
            <Image
              src={src}
              alt={alt}
              fill
              unoptimized
              sizes="96vw"
              className="object-contain"
              priority
            />
            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={() => setOpen(false)}
              aria-label="关闭图片预览"
              title="关闭"
              className="absolute right-3 top-3 shadow-sm"
            >
              <X />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

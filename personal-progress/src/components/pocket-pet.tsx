"use client";

import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { AlarmClock, Bell, Pencil, Plus, Trash2 } from "lucide-react";
import { RecordTimestamp } from "@/components/record-timestamp";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  getFeishuReminders,
  saveFeishuReminders,
  type FeishuReminder,
} from "@/lib/reminder";

const POSITION_STORAGE_KEY = "daily-space:pocket-pet-position";
const EDGE_GAP = 12;
const DRAG_THRESHOLD = 5;

type PetPosition = {
  x: number;
  y: number;
};

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  moved: boolean;
};

function clampPosition(
  position: PetPosition,
  element: HTMLElement | null,
): PetPosition {
  const viewport = window.visualViewport;
  const viewportLeft = viewport?.offsetLeft ?? 0;
  const viewportTop = viewport?.offsetTop ?? 0;
  const viewportWidth = viewport?.width ?? window.innerWidth;
  const viewportHeight = viewport?.height ?? window.innerHeight;
  const elementWidth = element?.offsetWidth ?? 64;
  const elementHeight = element?.offsetHeight ?? 64;
  const mobileNavigationHeight = viewportWidth < 1024 ? 68 : 0;
  const minX = viewportLeft + EDGE_GAP;
  const minY = viewportTop + EDGE_GAP;
  const maxX = Math.max(
    minX,
    viewportLeft + viewportWidth - elementWidth - EDGE_GAP,
  );
  const maxY = Math.max(
    minY,
    viewportTop + viewportHeight - elementHeight - EDGE_GAP - mobileNavigationHeight,
  );

  return {
    x: Math.min(Math.max(position.x, minX), maxX),
    y: Math.min(Math.max(position.y, minY), maxY),
  };
}

function readStoredPosition(): PetPosition | null {
  try {
    const stored = JSON.parse(
      window.localStorage.getItem(POSITION_STORAGE_KEY) ?? "null",
    ) as Partial<PetPosition> | null;
    if (
      stored &&
      Number.isFinite(stored.x) &&
      Number.isFinite(stored.y)
    ) {
      return { x: Number(stored.x), y: Number(stored.y) };
    }
  } catch {
    // Keep the default corner position when storage is unavailable or invalid.
  }
  return null;
}

function savePosition(position: PetPosition) {
  try {
    window.localStorage.setItem(
      POSITION_STORAGE_KEY,
      JSON.stringify(position),
    );
  } catch {
    // Dragging should still work when storage is unavailable.
  }
}

export function PocketPet() {
  const [open, setOpen] = useState(false);
  const [reminders, setReminders] = useState<FeishuReminder[]>([]);
  const [time, setTime] = useState("21:50");
  const [message, setMessage] = useState("该记录今天的生活与思考了。");
  const [editingId, setEditingId] = useState<string>();
  const [position, setPosition] = useState<PetPosition | null>(null);
  const [dragging, setDragging] = useState(false);
  const petRef = useRef<HTMLButtonElement>(null);
  const positionRef = useRef<PetPosition | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressPointerClickUntilRef = useRef(0);

  useEffect(() => {
    const element = petRef.current;
    if (!element) return;

    const rect = element.getBoundingClientRect();
    const initialPosition = clampPosition(
      readStoredPosition() ?? { x: rect.left, y: rect.top },
      element,
    );
    positionRef.current = initialPosition;
    setPosition(initialPosition);

    const keepInsideViewport = () => {
      const current = positionRef.current;
      if (!current) return;
      const next = clampPosition(current, petRef.current);
      positionRef.current = next;
      setPosition(next);
      savePosition(next);
    };

    window.addEventListener("resize", keepInsideViewport);
    window.visualViewport?.addEventListener("resize", keepInsideViewport);
    window.visualViewport?.addEventListener("scroll", keepInsideViewport);
    return () => {
      window.removeEventListener("resize", keepInsideViewport);
      window.visualViewport?.removeEventListener("resize", keepInsideViewport);
      window.visualViewport?.removeEventListener("scroll", keepInsideViewport);
    };
  }, []);

  const openClock = () => {
    setReminders(getFeishuReminders());
    setEditingId(undefined);
    setOpen(true);
  };

  const update = (next: FeishuReminder[]) => {
    setReminders(saveFeishuReminders(next));
  };

  const add = () => {
    if (
      !/^\d{2}:\d{2}$/.test(time) ||
      reminders.some((item) => item.time === time && item.id !== editingId)
    )
      return;
    const next = editingId
      ? reminders.map((item) => item.id === editingId
        ? { ...item, time, message: message.trim() || "该记录今天的生活与思考了。" }
        : item)
      : [
          ...reminders,
          {
            id: `${Date.now()}`,
            time,
            message: message.trim() || "该记录今天的生活与思考了。",
            enabled: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ];
    update(next.sort((a, b) => a.time.localeCompare(b.time)));
    setEditingId(undefined);
    setTime("21:50");
    setMessage("该记录今天的生活与思考了。");
  };

  const editReminder = (reminder: FeishuReminder) => {
    setEditingId(reminder.id);
    setTime(reminder.time);
    setMessage(reminder.message);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!event.isPrimary || event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const origin = positionRef.current ?? { x: rect.left, y: rect.top };
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: origin.x,
      originY: origin.y,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD) return;

    drag.moved = true;
    event.preventDefault();
    const next = clampPosition(
      { x: drag.originX + deltaX, y: drag.originY + deltaY },
      petRef.current,
    );
    positionRef.current = next;
    setPosition(next);
  };

  const finishPointerInteraction = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (drag.moved) {
      suppressPointerClickUntilRef.current = performance.now() + 500;
      if (positionRef.current) savePosition(positionRef.current);
    }
    dragRef.current = null;
    setDragging(false);
  };

  const handleClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (
      event.detail > 0 &&
      performance.now() < suppressPointerClickUntilRef.current
    ) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    openClock();
  };

  return (
    <div
      className="fixed z-30"
      style={
        position
          ? { left: position.x, top: position.y }
          : { right: 20, bottom: 20 }
      }
    >
      <button
        ref={petRef}
        type="button"
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointerInteraction}
        onPointerCancel={finishPointerInteraction}
        aria-label="设置飞书提醒时钟，可拖动位置"
        title="飞书提醒时钟"
        className={cn(
          "group relative grid size-16 touch-none select-none place-items-center overflow-visible rounded-full border-4 border-card bg-[#f8c75a] shadow-[0_9px_24px_rgba(55,105,97,0.24)] transition-[transform,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          dragging
            ? "cursor-grabbing scale-[1.03] shadow-[0_10px_24px_rgba(76,61,31,0.34)]"
            : "cursor-grab",
        )}
      >
        <span className="shinchan-pet-label">小新提醒屋，点击设置时钟</span>
        <span className="shinchan-pet-face" />
        <span className="shinchan-pet-hair" />
        <span className="shinchan-pet-brow shinchan-pet-brow-left" />
        <span className="shinchan-pet-brow shinchan-pet-brow-right" />
        <span className="shinchan-pet-eye shinchan-pet-eye-left" />
        <span className="shinchan-pet-eye shinchan-pet-eye-right" />
        <span className="shinchan-pet-mouth" />
        <span className="shinchan-pet-shirt" />
        <AlarmClock
          className="absolute -bottom-2 -right-2 rounded-full bg-primary p-1 text-primary-foreground"
          size={24}
        />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>飞书提醒时钟</DialogTitle>
            <DialogDescription>
              为每个提醒设置时间和发送到飞书群的文字。
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-2 text-sm font-medium">
              提醒时间
              <Input
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              飞书提醒文字
              <Textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                maxLength={500}
                className="min-h-20"
                placeholder="例如：复习英语单词，并写下今天的学习收获。"
              />
            </label>
            <Button onClick={add}>
              {editingId ? <Pencil data-icon="inline-start" /> : <Plus data-icon="inline-start" />}
              {editingId ? "保存修改" : "添加提醒"}
            </Button>
            {editingId ? (
              <Button variant="ghost" onClick={() => {
                setEditingId(undefined);
                setTime("21:50");
                setMessage("该记录今天的生活与思考了。");
              }}>取消修改</Button>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            {reminders.length ? (
              reminders.map((reminder) => (
                <div
                  key={reminder.id}
                  className="flex items-start gap-3 rounded-lg border px-3 py-3"
                >
                  <input
                    className="mt-1"
                    type="checkbox"
                    checked={reminder.enabled}
                    onChange={() =>
                      update(
                        reminders.map((item) =>
                          item.id === reminder.id
                            ? { ...item, enabled: !item.enabled }
                            : item,
                        ),
                      )
                    }
                    aria-label={`启用 ${reminder.time} 提醒`}
                  />
                  <Bell className="mt-0.5 text-primary" size={16} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{reminder.time}</p>
                    <p className="mt-1 text-sm leading-5 text-muted-foreground">
                      {reminder.message}
                    </p>
                    <RecordTimestamp
                      id={reminder.id}
                      createdAt={reminder.createdAt}
                      updatedAt={reminder.updatedAt}
                      className="mt-1"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => editReminder(reminder)}
                    aria-label={`修改 ${reminder.time} 提醒`}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() =>
                      update(
                        reminders.filter((item) => item.id !== reminder.id),
                      )
                    }
                    aria-label={`删除 ${reminder.time} 提醒`}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">
                还没有提醒时间。
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              完成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

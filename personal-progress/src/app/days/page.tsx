"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { uploadPhoto } from "@/lib/photo-upload";
import Image from "next/image";
import Link from "next/link";
import { CalendarHeart, Gift, ImagePlus, Maximize2, Pencil, Plus, Trash2, X } from "lucide-react";
import { AppFrame } from "@/components/app-frame";
import { ImageLightbox } from "@/components/image-lightbox";
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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  addSpecialDayType,
  countdown,
  deleteSpecialDay,
  getSpecialDayType,
  listSpecialDays,
  listSpecialDayTypes,
  saveSpecialDay,
  updateSpecialDay,
  type SpecialDay,
  type SpecialDayType,
} from "@/lib/days";
import { listJournals } from "@/lib/journals";

function ClientOnly({ children }: { children: ReactNode }) {
  const ready = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  return ready ? <>{children}</> : null;
}


export default function DaysPage() {
  return (
    <AppFrame>
      <ClientOnly>
        <DaysWorkspace />
      </ClientOnly>
    </AppFrame>
  );
}

function DaysWorkspace() {
  const [days, setDays] = useState(() => listSpecialDays());
  const [dayTypes, setDayTypes] = useState<SpecialDayType[]>(() =>
    listSpecialDayTypes(),
  );
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [repeatsYearly, setRepeatsYearly] = useState(false);
  const [type, setType] = useState("ordinary");
  const [filterType, setFilterType] = useState("all");
  const [newTypeName, setNewTypeName] = useState("");
  const [typeMessage, setTypeMessage] = useState("");
  const [diaryQuery, setDiaryQuery] = useState("");
  const [linkedDiaryId, setLinkedDiaryId] = useState("");
  const [note, setNote] = useState("");
  const [backgroundImage, setBackgroundImage] = useState("");
  const [imageMessage, setImageMessage] = useState("");
  const [editingDay, setEditingDay] = useState<SpecialDay | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editRepeatsYearly, setEditRepeatsYearly] = useState(false);
  const [editLinkedDiaryId, setEditLinkedDiaryId] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editType, setEditType] = useState("ordinary");
  const [editBackgroundImage, setEditBackgroundImage] = useState("");
  const diaries = listJournals()
    .filter((entry) => `${entry.date} ${entry.content}`.includes(diaryQuery))
    .slice(0, 6);
  const visibleDays = filterType === "all"
    ? days
    : days.filter(
        (day) => getSpecialDayType(day.type, day.category).id === filterType,
      );
  const now = new Date();
  const filteredDays = [...visibleDays].sort((left, right) => {
    const distance = Math.abs(countdown(left, now)) - Math.abs(countdown(right, now));
    if (distance !== 0) return distance;
    const dateOrder = left.date.localeCompare(right.date);
    return dateOrder !== 0 ? dateOrder : left.title.localeCompare(right.title, "zh-CN");
  });
  const addDay = () => {
    if (!title.trim() || !date) return;
    const selectedType = getSpecialDayType(type);
    saveSpecialDay({
      title: title.trim(),
      date,
      category: selectedType.category,
      repeatsYearly,
      type,
      linkedDiaryId: linkedDiaryId || undefined,
      note: note.trim() || undefined,
      backgroundImage: backgroundImage || undefined,
    });
    setDays(listSpecialDays());
    setTitle("");
    setDate("");
    setRepeatsYearly(false);
    setType("ordinary");
    setLinkedDiaryId("");
    setNote("");
    setBackgroundImage("");
    setImageMessage("");
  };
  const selectBackgroundImage = async (
    files: FileList | null,
    setImage: (value: string) => void,
  ) => {
    const file = files?.[0];
    if (!file) return;
    try {
      setImage(await uploadPhoto(file));
      setImageMessage("");
    } catch (error) {
      setImageMessage(error instanceof Error ? error.message : "图片读取失败，请重试。");
    }
  };
  const openEditDay = (day: SpecialDay) => {
    setEditingDay(day);
    setEditTitle(day.title);
    setEditDate(day.date);
    setEditRepeatsYearly(day.repeatsYearly);
    setEditLinkedDiaryId(day.linkedDiaryId ?? "");
    setEditNote(day.note ?? "");
    setEditType(getSpecialDayType(day.type, day.category).id);
    setEditBackgroundImage(day.backgroundImage ?? "");
    setImageMessage("");
  };
  const saveDayEdits = () => {
    if (!editingDay || !editTitle.trim() || !editDate) return;
    const selectedType = getSpecialDayType(editType, editingDay.category);
    updateSpecialDay({
      ...editingDay,
      title: editTitle.trim(),
      date: editDate,
      repeatsYearly: editRepeatsYearly,
      linkedDiaryId: editLinkedDiaryId || undefined,
      type: editType,
      category: selectedType.category,
      note: editNote.trim() || undefined,
      backgroundImage: editBackgroundImage || undefined,
    });
    setDays(listSpecialDays());
    setEditingDay(null);
  };
  const addType = () => {
    const normalizedName = newTypeName.trim().replace(/\s+/g, " ");
    const existing = dayTypes.find((item) => item.label === normalizedName);
    if (existing) {
      setType(existing.id);
      setNewTypeName("");
      setTypeMessage(`“${existing.label}”已经在三个类型列表中。`);
      return;
    }
    const created = addSpecialDayType(newTypeName);
    if (!created) {
      setTypeMessage("请输入新类型的名称。");
      return;
    }
    setDayTypes(listSpecialDayTypes());
    setType(created.id);
    setNewTypeName("");
    setTypeMessage(`已添加“${created.label}”，三个类型列表已同步。`);
  };
  return (
    <div className="mx-auto max-w-5xl">
      <div>
        <p className="text-sm text-[#65736a]">把重要日子留在眼前</p>
        <h1 className="mt-1 text-2xl font-semibold md:text-3xl">日子</h1>
      </div>
      <section className="mt-7 border border-[#dfe5df] bg-white p-5 md:p-6">
        <div className="flex items-center gap-2 text-[#2f6651]">
          <CalendarHeart size={19} />
          <h2 className="font-semibold">添加倒计时</h2>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_150px_140px_auto]">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && addDay()}
            placeholder="例如：毕业纪念日"
            className="min-w-0 border border-[#cfd8d0] px-3 py-2.5 text-sm outline-none focus:border-[#2f6651]"
          />
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="border border-[#cfd8d0] px-3 py-2.5 text-sm outline-none focus:border-[#2f6651]"
          />
          <select
            value={type}
            onChange={(event) => setType(event.target.value)}
            aria-label="纪念日类型"
            className="border border-[#cfd8d0] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2f6651]"
          >
            {dayTypes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <button
            onClick={addDay}
            className="flex items-center justify-center gap-2 bg-[#2f6651] px-4 py-2.5 text-sm font-medium text-white"
          >
            <Plus size={17} />
            添加
          </button>
        </div>
        <label className="mt-4 flex w-fit items-center gap-2 text-sm text-[#526158]">
          <input
            type="checkbox"
            checked={repeatsYearly}
            onChange={(event) => setRepeatsYearly(event.target.checked)}
            className="h-4 w-4 accent-[#2f6651]"
          />
          每年重复提醒
        </label>
        <div className="mt-4 grid gap-3 border-t border-[#edf1ed] pt-4 md:grid-cols-2">
          <label className="text-sm text-[#526158]">
            备注（可选）
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="写下这一天对你的意义"
              className="mt-2 min-h-20 resize-y"
            />
          </label>
          <div className="text-sm text-[#526158]">
            <span>背景图片（可选）</span>
            <input
              id="new-day-background"
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => void selectBackgroundImage(event.target.files, setBackgroundImage)}
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button variant="outline" render={<label htmlFor="new-day-background" />}>
                <ImagePlus data-icon="inline-start" />
                选择图片
              </Button>
              {backgroundImage ? (
                <Button variant="ghost" size="sm" onClick={() => setBackgroundImage("")}>
                  <X data-icon="inline-start" />
                  移除图片
                </Button>
              ) : null}
            </div>
            {backgroundImage ? (
              <ImageLightbox
                src={backgroundImage}
                alt="新纪念日背景预览"
                renderTrigger={(openPreview) => (
                  <button
                    type="button"
                    onClick={openPreview}
                    aria-label="放大查看新纪念日背景预览"
                    className="relative mt-3 block aspect-[16/7] w-full cursor-zoom-in overflow-hidden rounded-lg border border-border"
                  >
                    <Image
                      src={backgroundImage}
                      alt="新纪念日背景预览"
                      fill
                      unoptimized
                      sizes="(min-width: 768px) 50vw, 100vw"
                      className="object-cover"
                    />
                  </button>
                )}
              />
            ) : null}
          </div>
        </div>
        {imageMessage ? <p role="status" className="mt-3 text-sm text-destructive">{imageMessage}</p> : null}
        <div className="mt-4 grid gap-3 border-t border-[#edf1ed] pt-4 md:grid-cols-2">
          <div className="text-sm text-[#526158]">
            <label htmlFor="special-day-type-filter">筛选已创建的日子</label>
            <select
              id="special-day-type-filter"
              value={filterType}
              onChange={(event) => setFilterType(event.target.value)}
              className="mt-2 block w-full border border-[#cfd8d0] bg-white px-3 py-2 text-sm"
            >
              <option value="all">全部类型（{days.length}）</option>
              {dayTypes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}（
                  {
                    days.filter(
                      (day) =>
                        getSpecialDayType(day.type, day.category).id === item.id,
                    ).length
                  }
                  ）
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-[#718077]">
              当前显示 {filteredDays.length} / {days.length} 个已创建日子
            </p>
            <p className="mt-4 font-medium text-[#526158]">自定义纪念日类型</p>
            <div className="mt-2 flex gap-2">
              <input
                value={newTypeName}
                onChange={(event) => setNewTypeName(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && addType()}
                maxLength={30}
                placeholder="自定义类型名称"
                className="min-w-0 flex-1 border border-[#cfd8d0] bg-white px-3 py-2 text-sm outline-none focus:border-[#2f6651]"
              />
              <Button type="button" variant="outline" onClick={addType}>
                <Plus data-icon="inline-start" />
                新增类型
              </Button>
            </div>
            {typeMessage ? (
              <p role="status" className="mt-2 text-xs text-[#2f6651]">
                {typeMessage}
              </p>
            ) : null}
          </div>
          <div>
            <label className="text-sm text-[#526158]">
              关联一篇日记（可选）
              <input
                value={diaryQuery}
                onChange={(event) => setDiaryQuery(event.target.value)}
                placeholder="搜索日期或日记内容"
                className="mt-2 block w-full border border-[#cfd8d0] px-3 py-2 text-sm"
              />
            </label>
            {diaryQuery ? (
              <div className="mt-2 max-h-28 overflow-y-auto border border-[#edf1ed] bg-white">
                {diaries.map((entry) => (
                  <button
                    key={entry.date}
                    onClick={() => {
                      setLinkedDiaryId(entry.date);
                      setDiaryQuery(entry.date);
                    }}
                    className={`block w-full px-3 py-2 text-left text-sm hover:bg-[#f4f8f3] ${linkedDiaryId === entry.date ? "bg-[#edf5ef] text-[#2f6651]" : ""}`}
                  >
                    {entry.date}
                  </button>
                ))}
                {!diaries.length ? (
                  <p className="px-3 py-2 text-sm text-[#718077]">
                    没有匹配日记
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </section>
      <section className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredDays.map((day) => {
          const remaining = countdown(day);
          return (
            <article
              key={day.id}
              className={cn(
                "relative min-h-48 overflow-hidden border p-5",
                day.backgroundImage ? "border-transparent bg-[#26382d]" : "border-[#dfe5df] bg-white",
              )}
            >
              {day.backgroundImage ? (
                <>
                  <Image
                    src={day.backgroundImage}
                    alt=""
                    fill
                    unoptimized
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover"
                  />
                  <span aria-hidden="true" className="absolute inset-0 bg-[#1d3024]/65" />
                </>
              ) : null}
              <div className="relative z-10">
              <div className="flex items-start justify-between gap-3">
                <span className={cn("inline-flex items-center gap-2 text-sm", day.backgroundImage ? "text-white/90" : "text-[#65736a]")}>
                  <Gift size={16} className={day.backgroundImage ? "text-[#ffd69a]" : "text-[#b56b65]"} />
                  {getSpecialDayType(day.type, day.category).label}
                </span>
                <div className="flex items-center gap-1">
                  {day.backgroundImage ? (
                    <ImageLightbox
                      src={day.backgroundImage}
                      alt={`${day.title}的背景图片`}
                      renderTrigger={(openPreview) => (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={openPreview}
                          aria-label={`放大查看${day.title}的背景图片`}
                          title="放大查看背景图片"
                          className="text-white hover:bg-white/15 hover:text-white"
                        >
                          <Maximize2 />
                        </Button>
                      )}
                    />
                  ) : null}
                  <Button variant="ghost" size="icon" onClick={() => openEditDay(day)} aria-label={`编辑${day.title}`} title="编辑" className={day.backgroundImage ? "text-white hover:bg-white/15 hover:text-white" : "text-[#6f7d74]"}>
                    <Pencil />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => { deleteSpecialDay(day.id); setDays(listSpecialDays()); }} aria-label={`删除${day.title}`} title="删除" className={day.backgroundImage ? "text-white hover:bg-white/15 hover:text-white" : "text-[#8a968e] hover:bg-[#f7eeee] hover:text-[#b54f4f]"}>
                    <Trash2 />
                  </Button>
                </div>
              </div>
              <h2 className={cn("mt-3 font-semibold", day.backgroundImage && "text-white")}>{day.title}</h2>
              <strong className={cn("mt-3 block text-4xl font-semibold", day.backgroundImage ? "text-white" : "text-[#17221d]")}>
                {remaining >= 0
                  ? `${remaining} 天`
                  : `已过 ${Math.abs(remaining)} 天`}
              </strong>
              <p className={cn("mt-4 text-sm", day.backgroundImage ? "text-white/80" : "text-[#718077]")}>
                {day.repeatsYearly ? "每年" : day.date}
                {day.repeatsYearly
                  ? ` · ${new Date(`${day.date}T12:00:00`).toLocaleDateString("zh-CN", { month: "long", day: "numeric" })}`
                  : ""}
              </p>
              <RecordTimestamp
                date={day.date}
                id={day.id}
                createdAt={day.createdAt}
                updatedAt={day.updatedAt}
                className={day.backgroundImage ? "mt-2 text-white/70" : "mt-2"}
              />
              {day.note ? <p className={cn("mt-3 text-sm leading-6", day.backgroundImage ? "text-white/90" : "text-[#526158]")}>{day.note}</p> : null}
              {day.linkedDiaryId ? (
                <Link
                  href={`/journals/${day.linkedDiaryId}`}
                  className={cn("mt-3 inline-block text-sm font-medium hover:underline", day.backgroundImage ? "text-[#d5efd7]" : "text-[#2f6651]")}
                >
                  回顾那年今日
                </Link>
              ) : null}
              </div>
            </article>
          );
        })}
        {!days.length ? (
          <div className="col-span-full border border-dashed border-[#cfd8d0] px-5 py-16 text-center text-sm text-[#718077]">
            添加一个重要日子，在这里查看倒计时。
          </div>
        ) : !filteredDays.length ? (
          <div className="col-span-full border border-dashed border-[#cfd8d0] px-5 py-16 text-center text-sm text-[#718077]">
            当前类型还没有已创建的日子，请切换为“全部类型”或新增一条。
          </div>
        ) : null}
      </section>
      <Dialog open={Boolean(editingDay)} onOpenChange={(open) => !open && setEditingDay(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>修改纪念日</DialogTitle>
            <DialogDescription>日期、名称、类型、备注和背景图片都可以修改。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-foreground">
              名称
              <input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} className="mt-2 block w-full border border-input bg-card px-3 py-2 text-sm" />
            </label>
            <label className="text-sm font-medium text-foreground">
              日期
              <input type="date" value={editDate} onChange={(event) => setEditDate(event.target.value)} className="mt-2 block w-full border border-input bg-card px-3 py-2 text-sm" />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={editRepeatsYearly} onChange={(event) => setEditRepeatsYearly(event.target.checked)} />
            每年重复提醒
          </label>
          <label className="text-sm font-medium text-foreground">
            纪念日类型
            <select value={editType} onChange={(event) => setEditType(event.target.value)} className="mt-2 block w-full border border-input bg-card px-3 py-2 text-sm outline-none focus:border-ring">
              {dayTypes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-foreground">
            备注
            <Textarea value={editNote} onChange={(event) => setEditNote(event.target.value)} placeholder="写下这一天对你的意义" className="mt-2 min-h-28 resize-y" />
          </label>
          <label className="text-sm font-medium text-foreground">
            关联日记
            <select value={editLinkedDiaryId} onChange={(event) => setEditLinkedDiaryId(event.target.value)} className="mt-2 block w-full border border-input bg-card px-3 py-2 text-sm">
              <option value="">不关联日记</option>
              {listJournals().map((entry) => (
                <option key={entry.date} value={entry.date}>{entry.date}</option>
              ))}
            </select>
          </label>
          {editingDay ? (
            <RecordTimestamp
              date={editingDay.date}
              id={editingDay.id}
              createdAt={editingDay.createdAt}
              updatedAt={editingDay.updatedAt}
              showCreatedAt
            />
          ) : null}
          <div>
            <p className="text-sm font-medium text-foreground">背景图片</p>
            <input id="edit-day-background" type="file" accept="image/*" className="sr-only" onChange={(event) => void selectBackgroundImage(event.target.files, setEditBackgroundImage)} />
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant="outline" render={<label htmlFor="edit-day-background" />}>
                <ImagePlus data-icon="inline-start" />
                更换图片
              </Button>
              {editBackgroundImage ? <Button variant="ghost" onClick={() => setEditBackgroundImage("")}>
                <X data-icon="inline-start" />
                移除背景
              </Button> : null}
            </div>
            {editBackgroundImage ? (
              <ImageLightbox
                src={editBackgroundImage}
                alt={`${editingDay?.title ?? "纪念日"}背景预览`}
                renderTrigger={(openPreview) => (
                  <button
                    type="button"
                    onClick={openPreview}
                    aria-label={`放大查看${editingDay?.title ?? "纪念日"}背景预览`}
                    className="relative mt-3 block aspect-[16/8] w-full cursor-zoom-in overflow-hidden rounded-lg border border-border"
                  >
                    <Image
                      src={editBackgroundImage}
                      alt={`${editingDay?.title ?? "纪念日"}背景预览`}
                      fill
                      unoptimized
                      sizes="(min-width: 768px) 42rem, 100vw"
                      className="object-cover"
                    />
                  </button>
                )}
              />
            ) : null}
            {imageMessage ? <p role="status" className="mt-2 text-sm text-destructive">{imageMessage}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingDay(null)}>取消</Button>
            <Button onClick={saveDayEdits} disabled={!editTitle.trim() || !editDate}>保存修改</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

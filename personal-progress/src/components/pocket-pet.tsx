"use client";

import { useState } from "react";
import { AlarmClock, Bell, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getFeishuReminders, saveFeishuReminders, type FeishuReminder } from "@/lib/reminder";

export function PocketPet() {
  const [open, setOpen] = useState(false);
  const [reminders, setReminders] = useState<FeishuReminder[]>([]);
  const [time, setTime] = useState("21:50");
  const [message, setMessage] = useState("该记录今天的生活与思考了。");
  const openClock = () => { setReminders(getFeishuReminders()); setOpen(true); };
  const update = (next: FeishuReminder[]) => { setReminders(next); saveFeishuReminders(next); };
  const add = () => { if (!/^\d{2}:\d{2}$/.test(time) || reminders.some((item) => item.time === time)) return; update([...reminders, { id: `${Date.now()}`, time, message: message.trim() || "该记录今天的生活与思考了。", enabled: true }].sort((a, b) => a.time.localeCompare(b.time))); };
  return <div className="fixed bottom-5 right-5 z-30"><button onClick={openClock} aria-label="设置飞书提醒时钟" title="飞书提醒时钟" className="group relative grid h-16 w-16 place-items-center rounded-full border-4 border-[#fff8e8] bg-[#efc85d] shadow-[0_7px_18px_rgba(76,61,31,0.28)]"><span className="absolute -top-1 h-5 w-11 rounded-t-full bg-[#24231f]" /><span className="absolute top-4 flex gap-3 text-[10px] text-[#24231f]"><i className="h-1.5 w-1.5 rounded-full bg-[#24231f]" /><i className="h-1.5 w-1.5 rounded-full bg-[#24231f]" /></span><span className="mt-5 h-1.5 w-5 rounded-full border-b-2 border-[#b85b49]" /><AlarmClock className="absolute -bottom-2 -right-2 rounded-full bg-primary p-1 text-primary-foreground" size={24} /></button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>飞书提醒时钟</DialogTitle><DialogDescription>为每个提醒设置时间和发送到飞书群的文字。</DialogDescription></DialogHeader><div className="flex flex-col gap-3"><label className="flex flex-col gap-2 text-sm font-medium">提醒时间<Input type="time" value={time} onChange={(event) => setTime(event.target.value)} /></label><label className="flex flex-col gap-2 text-sm font-medium">飞书提醒文字<Textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={500} className="min-h-20" placeholder="例如：复习英语单词，并写下今天的学习收获。" /></label><Button onClick={add}><Plus data-icon="inline-start" />添加提醒</Button></div><div className="flex flex-col gap-2">{reminders.length ? reminders.map((reminder) => <div key={reminder.id} className="flex items-start gap-3 border rounded-lg px-3 py-3"><input className="mt-1" type="checkbox" checked={reminder.enabled} onChange={() => update(reminders.map((item) => item.id === reminder.id ? { ...item, enabled: !item.enabled } : item))} aria-label={`启用 ${reminder.time} 提醒`} /><Bell className="mt-0.5 text-primary" size={16} /><div className="min-w-0 flex-1"><p className="font-medium">{reminder.time}</p><p className="mt-1 text-sm leading-5 text-muted-foreground">{reminder.message}</p></div><Button variant="ghost" size="icon-sm" onClick={() => update(reminders.filter((item) => item.id !== reminder.id))} aria-label={`删除 ${reminder.time} 提醒`}><Trash2 /></Button></div>) : <p className="py-4 text-center text-sm text-muted-foreground">还没有提醒时间。</p>}</div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>完成</Button></DialogFooter></DialogContent></Dialog></div>;
}

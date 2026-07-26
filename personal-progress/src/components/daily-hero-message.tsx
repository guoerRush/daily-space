"use client";

import { useEffect, useState } from "react";

type DailyMessage = { title: string; description: string };

const messages: DailyMessage[] = [
  { title: "把今天，认真地留给自己", description: "先安排最重要的一件事，再用记录看见每一点真实的进步。" },
  { title: "慢一点，也是在向前走", description: "把注意力收回当下，完成眼前这一小步就很好。" },
  { title: "今天的行动，会回答明天", description: "不必等状态完美，先从最容易开始的事情做起。" },
  { title: "认真生活，也认真记录", description: "留下感受、收获和反思，让每一天都有来处。" },
  { title: "让重要的事，先发生", description: "清空杂念，选定优先级，把时间交给真正想成为的自己。" },
  { title: "把一点坚持，变成自己的力量", description: "习惯不是一次做到很多，而是每天都没有放弃。" },
  { title: "给今天一个清晰的开始", description: "写下计划，专注执行，也为意外留一点空间。" },
  { title: "生活值得被温柔地看见", description: "记录平常的小事，它们会成为未来回望时的光。" },
  { title: "今天也可以重新开始", description: "过去的安排可以调整，现在的一步依然算数。" },
  { title: "用专注，换来内心的笃定", description: "先完成一件小事，再慢慢找回属于自己的节奏。" },
  { title: "每一次复盘，都在靠近更好的自己", description: "看见经验，而不是责备自己，把收获带到明天。" },
  { title: "给努力留下一份证据", description: "写下完成的事和闪光的瞬间，成长会变得清晰可见。" },
  { title: "把今天过成自己的作品", description: "不追求满分，只把真正重要的事情做得更用心。" },
  { title: "今天的你，已经足够值得肯定", description: "从容安排，踏实完成，别忘了感谢认真生活的自己。" },
];

function messageForDate(date: Date) {
  const key = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
  return messages[key % messages.length];
}

export function DailyHeroMessage() {
  const [message, setMessage] = useState<DailyMessage>(messages[0]);

  useEffect(() => {
    const refresh = () => setMessage(messageForDate(new Date()));
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <>
      <h1 className="mt-2 text-3xl font-semibold leading-tight text-[#284b37] md:text-[2.5rem]">{message.title}</h1>
      <p className="mt-3 text-sm leading-6 text-[#5c7364]">{message.description}</p>
      <div className="clarity-art" role="note" tabIndex={0} aria-label="清晰提醒" aria-describedby="clarity-tip">
        <span id="clarity-tip" className="clarity-tip" role="tooltip">
          <span>1. 当你计划很多或脑子很乱时，请在随记中写下你的安排。</span>
          <span>2. 当你做一件事却不知道如何开始时，请务必留出一天主线时间的一部分，专门解决问题或看看别人怎么做。</span>
        </span>
        <span aria-hidden="true">清</span>
        <span aria-hidden="true">晰</span>
      </div>
      <span className="mt-4 inline-flex items-center border border-[#a9c7b1] bg-white/60 px-3 py-1 text-sm font-semibold text-[#2f6651]">清晰</span>
    </>
  );
}

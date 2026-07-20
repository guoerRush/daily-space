"use client";

const quotes = [
  "把注意力放回今天，微小的完成也会积成远方。",
  "不必等状态完美，先开始，状态会在路上出现。",
  "真正的自律，是在疲惫时仍对自己保持温柔。",
  "把复杂的事拆成下一步，行动就有了入口。",
  "记录不是为了证明什么，而是为了看见自己走过的路。",
  "允许计划调整，但别轻易放弃今天最重要的一件事。",
  "每一次认真复盘，都在为下一次更好的选择积累力量。",
  "慢一点没有关系，只要方向仍然是向前。",
  "把时间留给真正重要的人和事，生活会慢慢变得清晰。",
  "今天写下的一句话，也许会在未来某天给你答案。",
];

export function DailyQuote() {
  const now = new Date();
  const key = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  const quote = quotes[key % quotes.length];
  return <div className="border-b border-[#dfe5df] bg-[#eef5ef]"><div className="mx-auto max-w-[1500px] px-4 py-2 text-center text-sm text-[#45614f] md:px-8"><span className="mr-2 text-[#8ca994]">每日一句</span>{quote}</div></div>;
}

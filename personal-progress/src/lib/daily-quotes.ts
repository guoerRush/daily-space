export type DailyQuote = {
  source: "海贼王" | "银魂" | "毛选";
  quote: string;
};

// Keep the lines short enough for the narrow banner and rotate by local date.
// The date-based index keeps a refresh stable while changing automatically the
// next day. The three source groups are intentionally mixed in one pool.
const quotes: DailyQuote[] = [
  { source: "海贼王", quote: "我要成为海贼王！" },
  { source: "海贼王", quote: "人的梦想，是不会终结的。" },
  { source: "海贼王", quote: "只要活着，就还有机会。" },
  { source: "海贼王", quote: "这片海上最自由的人，就是海贼王。" },
  { source: "海贼王", quote: "如果连自己的船长都保护不了，就没有资格谈野心。" },
  { source: "海贼王", quote: "我不会死的，因为我有必须实现的梦想。" },
  { source: "海贼王", quote: "真正的伙伴，是可以把后背交出去的人。" },
  { source: "海贼王", quote: "弱小并不可怕，可怕的是失去继续前进的心。" },
  { source: "海贼王", quote: "想做的事就去做，别把遗憾留给明天。" },
  { source: "海贼王", quote: "大海不会因为害怕风浪，就停止向前。" },
  { source: "海贼王", quote: "总有一天，我会带着大家一起抵达终点。" },
  { source: "海贼王", quote: "真正的自由，是能选择自己要走的路。" },
  { source: "海贼王", quote: "梦想不是笑话，它值得用一生去追。" },
  { source: "海贼王", quote: "只要还有同伴，就没有到此为止。" },
  { source: "海贼王", quote: "船长的决定，要由船长自己承担。" },
  { source: "海贼王", quote: "活下去，然后把想做的事做完。" },
  { source: "海贼王", quote: "冒险的意义，是看见从未见过的风景。" },
  { source: "海贼王", quote: "不去试一次，永远不会知道自己能走多远。" },

  { source: "银魂", quote: "人生就像铅笔，用完了也可以削短一点。" },
  { source: "银魂", quote: "无论发生什么，都要笑着活下去。" },
  { source: "银魂", quote: "真正重要的东西，用眼睛是看不见的。" },
  { source: "银魂", quote: "规矩不是拿来束缚自己的，是拿来守护自己的。" },
  { source: "银魂", quote: "人只要活着，就会遇到想守护的东西。" },
  { source: "银魂", quote: "不用勉强自己成为别人，做自己就已经够难了。" },
  { source: "银魂", quote: "有些事现在不做，一辈子都不会做了。" },
  { source: "银魂", quote: "比起失去，什么都不曾拥有更让人难过。" },
  { source: "银魂", quote: "笨蛋也有笨蛋的坚持。" },
  { source: "银魂", quote: "想保护的东西，就算拼上性命也不能放手。" },
  { source: "银魂", quote: "真正的武士，不是不会倒下，而是倒下后还能站起来。" },
  { source: "银魂", quote: "人生没有撤回键，所以每一步都要自己负责。" },
  { source: "银魂", quote: "可以迷茫，但不要忘记自己想守护什么。" },
  { source: "银魂", quote: "平凡的日子，也值得认真过完。" },
  { source: "银魂", quote: "别让别人的期待，替你决定要成为什么人。" },
  { source: "银魂", quote: "真正的伙伴，会在你最狼狈的时候留下来。" },
  { source: "银魂", quote: "笑容不是软弱，是重新出发的力气。" },
  { source: "银魂", quote: "就算世界乱成一团，也要守住自己的节奏。" },

  { source: "毛选", quote: "没有调查，没有发言权。" },
  { source: "毛选", quote: "星星之火，可以燎原。" },
  { source: "毛选", quote: "一切反动派都是纸老虎。" },
  { source: "毛选", quote: "枪杆子里面出政权。" },
  { source: "毛选", quote: "为人民服务。" },
  { source: "毛选", quote: "人总是要有一点精神的。" },
  { source: "毛选", quote: "世上无难事，只要肯登攀。" },
  { source: "毛选", quote: "在战略上藐视敌人，在战术上重视敌人。" },
  { source: "毛选", quote: "谁是我们的敌人？谁是我们的朋友？这是革命的首要问题。" },
  { source: "毛选", quote: "实践是检验真理的标准。" },
  { source: "毛选", quote: "矛盾存在于一切事物的发展过程中。" },
  { source: "毛选", quote: "具体问题具体分析。" },
  { source: "毛选", quote: "一切从实际出发。" },
  { source: "毛选", quote: "有了正确的方针，事情就成功了一半。" },
  { source: "毛选", quote: "我们的同志在困难的时候，要看到成绩，要看到光明。" },
  { source: "毛选", quote: "敌进我退，敌驻我扰，敌疲我打，敌退我追。" },
  { source: "毛选", quote: "愚公移山，贵在坚持。" },
  { source: "毛选", quote: "凡事要分析，不能凭感觉办事。" },
];

function dayNumber(date: Date) {
  return Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000,
  );
}

export function dailyQuoteForDate(date = new Date(), slot = 0) {
  const index = (dayNumber(date) * 7 + slot * 13) % quotes.length;
  return quotes[(index + quotes.length) % quotes.length];
}

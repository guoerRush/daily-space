const keywords = ["完成", "收获", "学到", "发现", "感谢", "问题", "反思", "复习", "明天", "下一步", "重要", "满意"];

export function extractHighlights(content: string, limit = 5) {
  const candidates = content
    .replace(/\r/g, "")
    .split(/[\n。！？!?]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);
  const unique = [...new Set(candidates)];
  return unique
    .map((text, index) => ({ text, score: keywords.reduce((score, word) => score + (text.includes(word) ? 3 : 0), 0) + Math.min(text.length / 40, 1) - index * 0.01 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.text);
}

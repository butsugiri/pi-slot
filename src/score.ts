const criteria = [
  { name: "Purpose", pattern: /したい|目指|目的|目標|実現|改善|解決|want to|goal|implement|build|fix/i },
  { name: "Context", pattern: /現状|現在|いま|今は|背景|環境|使って|利用|既存|currently|existing|using|because/i },
  { name: "Constraints", pattern: /制約|条件|以内|以下|までに|使わず|なしで|避け|互換|予算|constraint|without|must|budget|within/i },
  { name: "Specificity", pattern: /`[^`]+`|https?:\/\/\S+|\b\d+(?:\.\d+)?\s*(?:ms|秒|分|件|MB|GB|%|fps)\b|エラー|再現|具体|例えば|たとえば|error|example|reproduce/i },
  { name: "Verification", pattern: /検証|確認|比較|テスト|成功|合格|期待|評価|どうすれば|なぜ|どう違|test|verify|compare|expected|why|how/i },
];

export function evaluateQuery(text: string) {
  const value = text.trim();
  const matched = criteria.filter(({ pattern }) => pattern.test(value)).map(({ name }) => name);
  // Each criterion contributes once; repeating phrases or padding text earns no bonus.
  const score = matched.length * 20;
  const tier = score >= 80 ? "jackpot" : score >= 60 ? "medium" : score >= 40 ? "small" : "miss";
  return { score, tier, criteria: matched };
}

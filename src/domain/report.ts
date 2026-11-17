import manifest from "../../contracts/plugin-manifest.json" with { type: "json" };
export const labels: Record<string, string> = {
  questions: "研究问题",
  observations: "来源观察",
  conclusions: "研究结论",
  characters: "人物侧写",
  hypotheses: "动机假设",
  interviews: "人物访谈",
  trials: "对白试演",
  arcs: "人物弧光",
  segments: "阅读分块",
  scenes: "场景拆解",
  signals: "叙事信号",
  reader_views: "读者视角",
  findings: "分析问题",
  scope_indices: "固定阅读范围",
  basis_refs: "专业依据",
  id: "标识",
  title: "标题",
  name: "姓名",
  question_id: "所属问题",
  purpose: "研究用途",
  status: "状态",
  kind: "类型",
  statement: "内容",
  polarity: "证据方向",
  source_role: "来源层级",
  observed_on: "采集日期",
  evidence: "固定证据",
  summary: "摘要",
  observation_ids: "引用观察",
  limitations: "适用限制",
  character_id: "人物",
  entity_ref: "正式人物引用",
  blueprint_source_index: "固定设定来源",
  aliases: "显式别名",
  desire: "欲望",
  fear: "恐惧",
  values: "价值观",
  voice: "声音",
  boundaries: "红线",
  interpretation: "解释",
  question: "问题",
  answer: "回答",
  mode: "访谈性质",
  participants: "参与人物",
  prompt: "试演情境",
  lines: "对白",
  text: "内容",
  candidate_source_index: "候选来源",
  from_state: "起点",
  to_state: "终点",
  catalyst: "变化诱因",
  stage: "阶段",
  source_index: "来源序号",
  byte_start: "起始字节",
  byte_end: "结束字节",
  quote: "原文引句",
  method_version: "阅读方法版本",
  goal: "目标",
  conflict: "冲突",
  turn: "转折",
  outcome: "结果",
  pov_character_ref: "视点人物",
  story_time: "故事时间",
  threads: "故事线",
  scene_id: "所属场景",
  dimension: "分析维度",
  label: "说明",
  level: "分析强度",
  origin: "判断来源",
  perspective: "阅读视角",
  scene_ids: "相关场景",
  reaction: "阅读反应",
  description: "问题说明",
  recheck_source_indices: "复核来源",
  resolution: "复核解释",
};
export const names: Record<string, string> = {
  open: "待处理",
  in_progress: "研究中",
  answered: "已回答",
  inconclusive: "无法判断",
  proposed: "待确认",
  supported: "有据",
  contested: "有争议",
  contradicted: "有反证",
  supports: "支持",
  contradicts: "反证",
  context: "背景",
  quotation: "引文",
  observation: "观察",
  inference: "推断",
  counterexample: "反例",
  primary: "一手来源",
  secondary: "二手来源",
  author_note: "作者笔记",
  unknown: "未知",
  market: "市场观察",
  fact: "考据",
  inspiration: "灵感",
  grounded: "有据访谈",
  exploratory: "探索性访谈",
  planned: "规划弧光",
  observed: "已发生弧光",
  unread: "未读",
  done: "已读",
  failed: "失败",
  stale: "待重读",
  low: "低",
  medium: "中",
  high: "高",
  addressed: "已复核",
  agent_analysis: "Agent分析",
  author_statement: "作者陈述",
  tension: "张力",
  pace: "节奏",
  emotion: "情绪",
  promise: "承诺",
  information: "信息",
  structure: "结构",
  pacing: "节奏",
  character: "人物",
  prose: "表达",
};
export function textValue(value: any): string {
  if (value === null) return "未指定";
  if (Array.isArray(value))
    return value
      .map((x) =>
        typeof x === "object"
          ? Object.entries(x)
              .map(([k, v]) => (labels[k] ?? k) + "：" + textValue(v))
              .join("；")
          : textValue(x),
      )
      .join("\n");
  if (typeof value === "object")
    return Object.entries(value)
      .map(([k, v]) => (labels[k] ?? k) + "：" + textValue(v))
      .join("\n");
  return names[value] ?? String(value);
}
export function reportMarkdown(r: any) {
  const lines = [
    "# " + r.project.title,
    "",
    manifest.display["zh-CN"] + " · 固定专业成果",
    "",
    "采纳、正式设定与定稿由作者另行决定。",
    "",
  ];
  for (const [key, value] of Object.entries(r.project)) {
    if (!Array.isArray(value) || key === "basis_refs") continue;
    lines.push("## " + (labels[key] ?? key), "");
    for (const v of value) {
      lines.push(
        typeof v === "object"
          ? "### " + (v.title ?? v.name ?? v.question ?? v.id)
          : String(v),
        "",
      );
      if (typeof v === "object")
        for (const [k, x] of Object.entries(v))
          if (!["id", "name", "title"].includes(k))
            lines.push("**" + (labels[k] ?? k) + "**：" + textValue(x), "");
    }
  }
  lines.push(
    "## 固定依据",
    "",
    ...r.source_refs.map(
      (x: any, i: number) => "- 来源 " + (i + 1) + "：" + JSON.stringify(x),
    ),
    ...r.project.basis_refs.map((x: any) => "- 专业依据：" + JSON.stringify(x)),
    "",
    "对象：" + JSON.stringify(r.project_ref),
    "作品：" + JSON.stringify(r.work_ref),
  );
  return lines.join("\n");
}
export function reportHTML(r: any) {
  const esc = (v: any) =>
    String(v)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  return (
    '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'"><title>' +
    esc(r.project.title) +
    "</title><style>body{font:16px/1.8 system-ui;max-width:960px;padding:32px;margin:auto;color:#202020}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style><main><h1>" +
    esc(r.project.title) +
    "</h1><pre>" +
    esc(reportMarkdown(r)) +
    "</pre></main></html>"
  );
}

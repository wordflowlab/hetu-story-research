import { KIND, newProject } from "../../src/domain/model.ts";
export const original = "雨港。林溪守着旧邮局。林溪说：等一等。🌿\r\n";
export function scenario() {
  const p = newProject("雨港来信 · 作者审阅"),
    evidence = [
      { source_index: 0, byte_start: 0, byte_end: 9, quote: "雨港。" },
    ];
  if (KIND === "story_research") {
    p.questions = [
      {
        id: "q1",
        title: "守信人为何继续等待",
        purpose: "fact",
        status: "in_progress",
      },
    ];
    p.observations = [
      {
        id: "o1",
        question_id: "q1",
        title: "旧邮局守候",
        kind: "observation",
        statement: "林溪仍守着旧邮局，等待原因尚未明确。",
        polarity: "supports",
        source_role: "primary",
        observed_on: "2026-11-17",
        evidence,
      },
    ];
    p.conclusions = [
      {
        id: "c1",
        question_id: "q1",
        title: "从等待进入下一章",
        summary: "可以围绕未到的信设置行动目标，但不能推断寄件人。",
        status: "supported",
        observation_ids: ["o1"],
        limitations: ["只读到当前固定章，后续动机尚未确认"],
      },
    ];
  }
  if (KIND === "character_lab") {
    p.characters = [
      {
        id: "lin",
        name: "林溪",
        entity_ref: null,
        blueprint_source_index: null,
        aliases: ["小林"],
        desire: "找到未到的来信",
        fear: "失去最后的线索",
        values: ["守信"],
        voice: ["短句，情绪留在停顿里"],
        boundaries: ["不替她猜测寄件人"],
        evidence,
      },
    ];
    p.hypotheses = [
      {
        id: "h1",
        character_id: "lin",
        title: "等待是一种承诺",
        interpretation: "可能在履行某次约定，原文尚未明确。",
        status: "proposed",
        evidence,
      },
    ];
    p.interviews = [
      {
        id: "i1",
        character_id: "lin",
        question: "如果今天仍没有来信，你会离开吗？",
        answer: "明天再说。",
        mode: "exploratory",
        evidence: [],
      },
    ];
    p.trials = [
      {
        id: "t1",
        title: "门关之前",
        participants: ["lin"],
        prompt: "邮局闭门时，她要决定是否留下。",
        lines: [{ character_id: "lin", text: "再等一会。" }],
        evidence,
        candidate_source_index: null,
      },
    ];
    p.arcs = [
      {
        id: "a1",
        character_id: "lin",
        title: "从等候到寻找",
        from_state: "被动等待",
        to_state: "主动寻找线索",
        catalyst: "收到一封没有署名的信",
        stage: "planned",
        evidence: [],
      },
    ];
  }
  if (KIND === "story_analysis") {
    const end = Buffer.byteLength(original);
    p.scope_indices = [0];
    p.segments = [
      {
        id: "seg1",
        source_index: 0,
        byte_start: 0,
        byte_end: end,
        status: "done",
        summary: "林溪守候旧邮局，等待的原因未明。",
        method_version: "codex-reading/1",
      },
    ];
    p.scenes = [
      {
        id: "s1",
        title: "旧邮局的等待",
        source_index: 0,
        byte_start: 0,
        byte_end: end,
        summary: "林溪在旧邮局等待。",
        goal: "收到来信",
        conflict: "来信没有出现",
        turn: "等待中保留线索",
        outcome: "继续等候",
        pov_character_ref: null,
        story_time: "雨夜",
        threads: ["失踪的来信"],
        evidence,
      },
    ];
    p.signals = [
      {
        id: "sig1",
        scene_id: "s1",
        dimension: "promise",
        label: "等待的承诺",
        interpretation: "读者可能期待信件的来源得到回应。",
        level: "medium",
        origin: "agent_analysis",
        evidence,
      },
    ];
    p.reader_views = [
      {
        id: "rv1",
        title: "第一次阅读",
        perspective: "不知人物前史的模拟读者",
        scene_ids: ["s1"],
        reaction: "等待建立悬念，但人物目标还需要下一章展开。",
        questions: ["她在等谁？"],
        evidence,
      },
    ];
    p.findings = [
      {
        id: "f1",
        title: "寄件人的来源留待复核",
        kind: "promise",
        scene_ids: ["s1"],
        description: "核对后文是否有意延迟兑现。",
        status: "open",
        evidence,
        recheck_source_indices: [],
        resolution: "",
      },
    ];
  }
  return p;
}
export const contextAction = (
  {
    story_research: "build_research_context",
    character_lab: "get_character_context",
    story_analysis: "build_analysis_context",
  } as Record<string, string>
)[KIND];
export const base = (r: any, key: string) => ({
  object_id: r.object.object_id,
  expected_revision: r.object.revision,
  expected_sha256: r.sha256,
  operation_key: key,
});
export const selection = (r: any) => ({
  object_id: r.object.object_id,
  revision: r.object.revision,
});

import { requireValue as need } from "../../vendor/project-store.ts";
import { span, sourceText, uniqueIds } from "./text.ts";
export const fields = {
  question: "questions",
  observation: "observations",
  conclusion: "conclusions",
};
export const defaults = () => ({
  questions: [],
  observations: [],
  conclusions: [],
});
export function validateDomain(p: any) {
  const questions = new Set(p.questions.map((x: any) => x.id)),
    observations = new Map<string, any>(
      p.observations.map((x: any) => [x.id, x]),
    );
  for (const o of p.observations) {
    need(questions.has(o.question_id), "观察引用的问题不存在。");
    need(
      !Number.isNaN(Date.parse(o.observed_on)) &&
        new Date(o.observed_on).toISOString().slice(0, 10) === o.observed_on,
      "采集日期不是真实日期。",
    );
    need(
      o.kind === "inference" || o.evidence.length > 0,
      "引文、观察及反例必须有固定原文证据。",
    );
    need(
      o.source_role !== "unknown" || o.kind === "inference",
      "未知来源只能作为推断。",
    );
  }
  for (const c of p.conclusions) {
    need(questions.has(c.question_id), "结论引用的问题不存在。");
    uniqueIds(c.observation_ids, "结论重复引用同一观察。");
    const refs = c.observation_ids.map((id: string) => {
      const o = observations.get(id);
      need(
        o && o.question_id === c.question_id,
        "结论不能跨问题或引用不存在的观察。",
      );
      return o;
    });
    const all = p.observations.filter(
      (o: any) => o.question_id === c.question_id,
    );
    if (c.status === "supported") {
      need(
        refs.some((o: any) => o.polarity === "supports" && o.evidence.length),
        "有据结论须包含真实支持证据。",
      );
      need(
        !all.some((o: any) => o.polarity === "contradicts"),
        "存在反证时请标为有争议或无法判断。",
      );
    }
    if (c.status === "contested")
      need(
        refs.some((o: any) => o.polarity === "contradicts"),
        "有争议结论须引用反证。",
      );
  }
  for (const q of p.questions)
    if (q.status === "answered")
      need(
        p.conclusions.some(
          (c: any) =>
            c.question_id === q.id &&
            ["supported", "contested"].includes(c.status),
        ),
        "已回答问题须有带依据的结论。",
      );
}
export function digest(p: any) {
  return {
    questions: p.questions.map((q: any) => ({
      ...q,
      supports: p.observations.filter(
        (o: any) => o.question_id === q.id && o.polarity === "supports",
      ),
      contradicts: p.observations.filter(
        (o: any) => o.question_id === q.id && o.polarity === "contradicts",
      ),
      context: p.observations.filter(
        (o: any) => o.question_id === q.id && o.polarity === "context",
      ),
      conclusions: p.conclusions.filter((c: any) => c.question_id === q.id),
    })),
    unresolved: p.questions
      .filter((q: any) => q.status !== "answered")
      .map((q: any) => q.id),
    note: "公开观察与推断不构成市场保证或原著授权。",
  };
}
export async function checkSources(_p: any, _sources: any[]) {}
export function readProfessional(
  action: string,
  p: any,
  _sources: any[],
  _i: any,
): any {
  if (action === "get_research_digest") return digest(p);
  if (action === "check_project")
    return {
      valid: true,
      unresolved: digest(p).unresolved,
      unsupported: p.conclusions
        .filter((c: any) => ["proposed", "inconclusive"].includes(c.status))
        .map((c: any) => c.id),
    };
}
export function contextProject(p: any, _i: any) {
  return digest(p);
}

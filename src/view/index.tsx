import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import manifest from "../../contracts/plugin-manifest.json" with { type: "json" };
import type { ObjectResult, PluginBridge } from "../../vendor/hetu-sdk.ts";
import { KIND, newProject } from "../domain/model.ts";
import "./style.css";
declare global {
  interface Window {
    hetu: PluginBridge;
  }
}
const api = window.hetu,
  title = manifest.display["zh-CN"];
import { labels, names, textValue } from "../domain/report.ts";
const tabsets: Record<string, [string, string][]> = {
  story_research: [
    ["questions", "研究问题"],
    ["observations", "来源观察"],
    ["conclusions", "研究结论"],
    ["digest", "依据与冲突"],
    ["context", "接续创作"],
  ],
};
const contextAction = "build_research_context";
async function invoke(action: string, input: any = {}) {
  const r: any = await api.invoke(action, input);
  if (r.status !== "succeeded")
    throw Object.assign(
      new Error(r.error?.message ?? "结果未知，请回读原操作。"),
      { code: r.error?.code ?? "unknown" },
    );
  return r.data;
}
function App() {
  const [list, setList] = useState<any[]>([]),
    [record, setRecord] = useState<ObjectResult>(),
    [tab, setTab] = useState(tabsets[KIND][0][0]),
    [error, setError] = useState(""),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false),
    [query, setQuery] = useState(""),
    [selected, setSelected] = useState<any>(),
    [source, setSource] = useState<any>(),
    [editor, setEditor] = useState(""),
    [editing, setEditing] = useState(false),
    [pending, setPending] = useState<any>();
  const p: any = record?.object.content;
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  async function refresh() {
    let cursor: string | undefined;
    const rows: any[] = [];
    do {
      const r = await invoke("list_projects", {
        limit: 100,
        ...(cursor ? { cursor } : {}),
      });
      rows.push(...r.objects);
      cursor = r.next_cursor ?? undefined;
    } while (cursor);
    setList(rows);
    return rows;
  }
  async function open(id: string, revision?: number) {
    const r = await invoke("get_project", {
      object_id: id,
      ...(revision ? { revision } : {}),
    });
    setRecord(r);
    setSelected(undefined);
    setSource(undefined);
  }
  useEffect(() => {
    void run(async () => {
      const pref: any = await api.host?.("preferences", {});
      if (pref?.theme)
        document.documentElement.style.colorScheme =
          pref.theme === "system" ? "light dark" : pref.theme;
      api.onPreferences?.((v) => {
        document.documentElement.style.colorScheme =
          v.theme === "system" ? "light dark" : v.theme;
      });
      const buffer: any = await api.buffer();
      if (buffer?.pending) setPending(buffer.pending);
      if (typeof buffer?.editor === "string") {
        setEditor(buffer.editor);
        setEditing(true);
      }
      const rows = await refresh();
      if (buffer?.object_id || buffer?.pending?.object_id || rows.length)
        await open(
          buffer?.object_id ?? buffer?.pending?.object_id ?? rows[0].object_id,
          buffer?.baseline?.revision,
        );
    });
  }, []);
  useEffect(() => {
    if (editing || pending)
      void api.buffer({
        editor,
        editing,
        pending,
        object_id: record?.object.object_id,
        baseline: record
          ? { revision: record.object.revision, sha256: record.sha256 }
          : undefined,
      });
  }, [editor, editing, pending, record]);
  async function handoff() {
    await api.host?.("handoff", {
      goal:
        "根据当前固定作品和已有" +
        title +
        "成果，" +
        (query || "完善本页并准备下一轮创作；先读依据，再提出具体方案。"),
      ...(record
        ? {
            object_ref: {
              object_id: record.object.object_id,
              revision: record.object.revision,
              sha256: record.sha256,
            },
          }
        : {}),
    });
    setStatus("已复制接续说明，可粘贴到当前Agent对话");
  }
  function evidence(v: any) {
    return (
      <>
        {(v.evidence ?? []).map((e: any, k: number) => (
          <button
            key={k}
            className="text"
            onClick={() =>
              void run(async () => {
                setSource(
                  await invoke("get_source", {
                    object_id: record!.object.object_id,
                    revision: record!.object.revision,
                    source_index: e.source_index,
                  }),
                );
                setSelected(v);
              })
            }
          >
            查看依据 {e.source_index + 1}
            {e.quote ? "，" + e.quote.slice(0, 24) : ""}
          </button>
        ))}
      </>
    );
  }
  function person(id: string) {
    return p.characters?.find((c: any) => c.id === id)?.name ?? id;
  }
  function display(k: string, v: any): string {
    if (k === "character_id") return person(v);
    if (k === "participants") return v.map(person).join("、");
    if (k === "question_id")
      return p.questions?.find((q: any) => q.id === v)?.title ?? "未找到问题";
    if (k === "observation_ids")
      return v
        .map(
          (id: string) =>
            p.observations?.find((o: any) => o.id === id)?.title ??
            "未找到观察",
        )
        .join("、");
    if (k === "scene_id")
      return (
        p.scenes?.find((scene: any) => scene.id === v)?.title ?? "未找到场景"
      );
    if (k === "scene_ids")
      return v
        .map(
          (id: string) =>
            p.scenes?.find((scene: any) => scene.id === id)?.title ??
            "未找到场景",
        )
        .join("、");
    if (k === "source_index") return "来源 " + (v + 1);
    if (k.endsWith("_source_indices") || k === "scope_indices")
      return v.map((i: number) => "来源 " + (i + 1)).join("、");
    if (k === "candidate_source_index")
      return "来源 " + (v + 1) + " · 独立候选";
    if (k === "lines")
      return v
        .map((l: any) => person(l.character_id) + "：" + l.text)
        .join("\n");
    return textValue(v);
  }
  function article(v: any) {
    const hidden = [
      "id",
      "name",
      "title",
      "evidence",
      "question",
      "status",
      "blueprint_source_index",
      "entity_ref",
      "mode",
      "stage",
      "origin",
      "from_state",
      "to_state",
    ];
    if (v.status === undefined) hidden.push("polarity");
    return (
      <article
        key={v.id}
        className={v.polarity === "contradicts" ? "counterevidence" : ""}
      >
        <div className="row">
          <h3>{v.title ?? v.name ?? v.label ?? v.question ?? labels[tab]}</h3>
          {names[v.status ?? v.mode ?? v.stage ?? v.polarity] && (
            <span className="tag">
              {names[v.status ?? v.mode ?? v.stage ?? v.polarity]}
            </span>
          )}
        </div>

        <dl className="facts">
          {Object.entries(v)
            .filter(
              ([k, x]) =>
                !hidden.includes(k) &&
                x !== null &&
                (!Array.isArray(x) || x.length > 0) &&
                x !== "",
            )
            .map(([k, x]) => (
              <div
                key={k}
                className={
                  [
                    "statement",
                    "summary",
                    "description",
                    "answer",
                    "interpretation",
                    "lines",
                    "reaction",
                    "resolution",
                    "limitations",
                    "prompt",
                  ].includes(k)
                    ? "wide"
                    : ""
                }
              >
                <dt>{labels[k] ?? k}</dt>
                <dd>{display(k, x)}</dd>
              </div>
            ))}
        </dl>
        {v.from_state && (
          <div className="arc">
            <span>{v.from_state}</span>
            <span aria-hidden="true">→</span>
            <span>{v.to_state}</span>
          </div>
        )}
        {v.mode === "exploratory" && (
          <p className="muted">探索性试探，回答不代表原文或正式设定。</p>
        )}
        {v.origin && (
          <p className="muted">这是{names[v.origin]}，不代表实际读者调研。</p>
        )}
        {evidence(v)}
      </article>
    );
  }
  async function professional(action: string, input: any = {}) {
    setSource(
      await invoke(action, {
        object_id: record!.object.object_id,
        revision: record!.object.revision,
        ...input,
      }),
    );
  }
  let content: React.ReactNode;
  if (p) {
    if (Array.isArray(p[tab]))
      content = (
        <>
          {p[tab].map(article)}
          {!p[tab].length && (
            <Empty text="让Agent读取固定原文与专业依据，准备具体成果。" />
          )}
        </>
      );
    else if (tab === "structure")
      content = (
        <section>
          <h3>叙事顺序与故事线</h3>
          <p className="muted">
            按固定阅读范围与原文字节排列；强度来自分析判断。
          </p>
          <div className="timeline">
            {[...p.scenes]
              .sort(
                (a: any, b: any) =>
                  p.scope_indices.indexOf(a.source_index) -
                    p.scope_indices.indexOf(b.source_index) ||
                  a.byte_start - b.byte_start,
              )
              .map((scene: any) => (
                <article key={scene.id}>
                  <h3>{scene.title}</h3>
                  <p>{scene.summary}</p>
                  <p className="muted">
                    {scene.story_time ?? "故事时间未指定"} ·{" "}
                    {scene.threads.join("、")}
                  </p>
                  <div className="signal-list">
                    {p.signals
                      .filter((s: any) => s.scene_id === scene.id)
                      .map((signal: any) => (
                        <div key={signal.id}>
                          <span>
                            {names[signal.dimension]} · {signal.label}
                          </span>
                          <meter
                            min="0"
                            max="3"
                            value={
                              (
                                {
                                  low: 1,
                                  medium: 2,
                                  high: 3,
                                  unknown: 0,
                                } as any
                              )[signal.level]
                            }
                            aria-label={
                              signal.label + "：" + names[signal.level]
                            }
                          />
                          <span>{names[signal.level]}</span>
                        </div>
                      ))}
                  </div>
                  {evidence(scene)}
                </article>
              ))}
          </div>
          {!p.scenes.length && (
            <Empty text="让Agent固定阅读范围并拆解场景，分析转折、情绪与承诺。" />
          )}
        </section>
      );
    else if (tab === "digest")
      content = (
        <section>
          <h3>支持与反证一起阅读</h3>
          {p.questions.map((q: any) => (
            <article key={q.id}>
              <h3>{q.title}</h3>
              <div className="compare">
                <section>
                  <h4>支持依据</h4>
                  {p.observations
                    .filter(
                      (o: any) =>
                        o.question_id === q.id && o.polarity === "supports",
                    )
                    .map(article)}
                </section>
                <section>
                  <h4>反证与限制</h4>
                  {!p.observations.some(
                    (o: any) =>
                      o.question_id === q.id && o.polarity === "contradicts",
                  ) && (
                    <p className="muted">
                      当前未登记反证，不代表不存在反证；结论的适用限制仍须保留。
                    </p>
                  )}
                  {p.observations
                    .filter(
                      (o: any) =>
                        o.question_id === q.id && o.polarity === "contradicts",
                    )
                    .map(article)}
                </section>
              </div>
              {p.conclusions
                .filter((c: any) => c.question_id === q.id)
                .map(article)}
            </article>
          ))}
        </section>
      );
    else if (tab === "mentions")
      content = (
        <section>
          <h3>显式姓名与别名提及</h3>
          <p>
            仅统计固定原文的字面提及。歧义命中单列，不推断实际出场或人物重要性。
          </p>
          <button
            onClick={() =>
              void run(() =>
                professional("measure_mentions", {
                  source_indices: (record!.object.source_refs ?? [])
                    .map((r: any, i: number) =>
                      r.kind === "document" || r.kind === "resource" ? i : null,
                    )
                    .filter((i: any) => i !== null),
                }),
              )
            }
          >
            计算提及
          </button>
        </section>
      );
    else if (tab === "coverage")
      content = (
        <section>
          <h3>固定范围阅读覆盖</h3>
          <p>
            按已读字节区间的并集计算，重叠不会重复计数。未读、失败与待重读范围保留。
          </p>
          <p>
            已记录 {p.segments.filter((s: any) => s.status === "done").length}{" "}
            个已读分块，阅读范围 {p.scope_indices.length} 份。
          </p>
          <button onClick={() => void run(() => professional("get_coverage"))}>
            查看覆盖与缺口
          </button>
          {p.segments.map(article)}
        </section>
      );
    else
      content = (
        <section>
          <h3>准备下一轮创作</h3>
          <p>
            固定当前专业成果与创作目标，由Agent接续到规划或候选；作者决定采纳与定稿。
          </p>
          <button
            onClick={() =>
              void run(() =>
                professional(contextAction, {
                  goal: query || "依据本方案继续创作",
                  max_chars: 12000,
                }),
              )
            }
          >
            预览接续上下文
          </button>
        </section>
      );
  }
  return (
    <div className="app">
      <header>
        <button
          aria-label="返回作品"
          onClick={() =>
            void run(async () => {
              await api.host?.("close_view", {});
            })
          }
        >
          ← 返回
        </button>
        <h1>{title}</h1>
        <select
          aria-label="选择方案"
          disabled={editing || !!pending}
          value={record?.object.object_id ?? ""}
          onChange={(e) => void run(() => open(e.target.value))}
        >
          <option value="">选择方案</option>
          {list.map((x) => (
            <option key={x.object_id} value={x.object_id}>
              {x.title}
            </option>
          ))}
        </select>
        <span className="revision">
          {record ? "修订 " + record.object.revision : ""}
        </span>
        <button
          disabled={busy || editing || !!pending}
          onClick={() =>
            void run(async () => {
              const rows = await refresh();
              if (record) await open(record.object.object_id);
              else if (rows.length) await open(rows[0].object_id);
            })
          }
        >
          刷新
        </button>
        <button
          className="primary"
          disabled={busy}
          onClick={() => void run(handoff)}
        >
          让AI处理
        </button>
      </header>
      <div className="toolbar">
        <nav aria-label="专业视图">
          {tabsets[KIND].map(([id, label]) => (
            <button
              aria-current={tab === id ? "page" : undefined}
              key={id}
              onClick={() => {
                setTab(id);
                setSource(undefined);
              }}
            >
              {label}
            </button>
          ))}
        </nav>
        <input
          aria-label="创作目标"
          placeholder="说明创作目标"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {error && (
        <div role="alert" className="error">
          {error} <button onClick={() => setError("")}>收起</button>
        </div>
      )}
      {status && (
        <p role="status" className="status">
          {status}
        </p>
      )}
      {pending && (
        <div className="notice">
          上次保存结果待确认。
          <button
            onClick={() =>
              void run(async () => {
                let r: any;
                try {
                  r = await invoke("get_operation", {
                    operation_key: pending.operation_key,
                  });
                } catch (e) {
                  if ((e as any).code !== "not_found") throw e;
                  r = await invoke("save_project", pending);
                }
                setRecord(r);
                setPending(undefined);
                setEditing(false);
                await api.buffer(null);
                setStatus("原操作已回读");
              })
            }
          >
            回读原操作
          </button>
        </div>
      )}
      <main>
        {busy && <p role="status">正在读取…</p>}
        {!p ? (
          <Empty
            text={
              "尚无" +
              title +
              "方案。向Agent说明创作目标，由Agent读取作品并建立；你可以回来阅读和提出意见。"
            }
          />
        ) : (
          <>
            <div className="heading">
              <h2>{p.title}</h2>
              <span className="muted">
                固定来源 {(record?.object.source_refs ?? []).length} 份
              </span>
            </div>
            {content}
          </>
        )}
        {source && (
          <aside aria-label="固定依据">
            <div className="row">
              <h2>{selected?.title ?? "固定依据"}</h2>
              <button
                onClick={() => {
                  setSource(undefined);
                  setSelected(undefined);
                }}
              >
                关闭依据
              </button>
            </div>
            {source.source ? (
              <pre>
                {source.source.content ??
                  source.source.resource?.body ??
                  textValue(source.source)}
              </pre>
            ) : source.metric === "literal_mentions" ? (
              <section>
                <p>{source.note}</p>
                {Object.entries(source.counts).map(([id, n]) => (
                  <p key={id}>
                    {person(id)}：{String(n)} 次
                  </p>
                ))}
                <p>歧义提及：{source.unassigned.length} 次</p>
                {source.hits.map((h: any, k: number) => (
                  <p key={k}>
                    {h.text} · 来源 {h.source_index + 1} · 字节 {h.byte_start}–
                    {h.byte_end}
                    {h.character_id === null ? " · 歧义，未计入人物" : ""}
                  </p>
                ))}
              </section>
            ) : source.read_bytes !== undefined ? (
              <section>
                <p>
                  已读 {source.read_bytes} / {source.total_bytes} 字节 ·{" "}
                  {source.coverage === null
                    ? "无可读文字"
                    : Math.round(source.coverage * 100) + "%"}
                </p>
                <p>{source.note}</p>
                {source.sources.map((r: any) => (
                  <article key={r.source_index}>
                    <h3>来源 {r.source_index + 1}</h3>
                    <p>
                      未读区间：
                      {r.gaps.length
                        ? r.gaps.map((g: any) => g.join("–")).join("，")
                        : "无"}
                    </p>
                    <p>
                      失败分块：{r.failed.length ? r.failed.join("、") : "无"}
                    </p>
                  </article>
                ))}
              </section>
            ) : (
              <section>
                {source.omitted_fields?.length > 0 && (
                  <p className="notice">
                    预算内未包含：
                    {source.omitted_fields
                      .map((k: string) => labels[k] ?? k)
                      .join("、")}
                    ；可由Agent按需回读。
                  </p>
                )}
                <pre>{textValue(source.content ?? source)}</pre>
              </section>
            )}
          </aside>
        )}
        <details className="advanced">
          <summary>版本与高级操作</summary>
          <div className="row">
            <button
              onClick={() => {
                setEditor(JSON.stringify(p ?? newProject(), null, 2));
                setEditing(true);
              }}
            >
              编辑专业数据
            </button>
            {record && (
              <>
                <button
                  onClick={() =>
                    void run(async () => {
                      const r = await invoke("compare_versions", {
                        object_id: record.object.object_id,
                        from_revision: 1,
                        to_revision: record.object.revision,
                      });
                      setSource({ content: JSON.stringify(r, null, 2) });
                    })
                  }
                >
                  比较最初修订
                </button>
                <button
                  onClick={() =>
                    void run(async () => {
                      const result: any = await api.host?.("export_file", {
                        action: "export_project",
                        input: {
                          object_id: record.object.object_id,
                          revision: record.object.revision,
                          format: "html",
                        },
                        suggested_name: title + ".html",
                      });
                      if (result?.cancelled) {
                        setStatus("已取消交付");
                        return;
                      }
                      setStatus("已准备固定版本交付");
                    })
                  }
                >
                  导出报告
                </button>
              </>
            )}
          </div>
          {editing && (
            <>
              <label>
                高级专业数据
                <textarea
                  aria-label="专业数据"
                  value={editor}
                  onChange={(e) => setEditor(e.target.value)}
                />
              </label>
              <p className="muted">
                仅维护本插件结构；正文与正式设定沿宿主决定。冲突时保留输入。
              </p>
              <button
                disabled={busy || !!pending}
                onClick={() =>
                  void run(async () => {
                    const input = {
                      ...(record ? { object_id: record.object.object_id } : {}),
                      expected_revision: record?.object.revision ?? 0,
                      expected_sha256: record?.sha256 ?? "",
                      source_refs: record?.object.source_refs ?? [],
                      content: JSON.parse(editor),
                      operation_key: crypto.randomUUID(),
                    };
                    setPending(input);
                    await api.buffer({
                      editor,
                      pending: input,
                      object_id: record?.object.object_id,
                      baseline: record
                        ? {
                            revision: record.object.revision,
                            sha256: record.sha256,
                          }
                        : undefined,
                    });
                    let r: any;
                    try {
                      r = await invoke("save_project", input);
                    } catch (e) {
                      const code = (e as any).code;
                      if (
                        code &&
                        code !== "unknown" &&
                        code !== "plugin.failure"
                      ) {
                        setPending(undefined);
                        await api.buffer({
                          editor,
                          editing: true,
                          object_id: record?.object.object_id,
                          baseline: record
                            ? {
                                revision: record.object.revision,
                                sha256: record.sha256,
                              }
                            : undefined,
                        });
                      }
                      throw e;
                    }
                    setRecord(r);
                    setPending(undefined);
                    setEditing(false);
                    await api.buffer(null);
                    await refresh();
                    setStatus("专业修订已保存");
                  })
                }
              >
                保存专业修订
              </button>
              <button
                disabled={!!pending}
                onClick={() => {
                  setEditing(false);
                  void api.buffer(null);
                }}
              >
                取消编辑
              </button>
            </>
          )}
        </details>
      </main>
      <footer>作者决定取舍，Agent维护结构，正文采纳与定稿独立处理</footer>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <section className="empty">
      <h2>从作品出发</h2>
      <p>{text}</p>
    </section>
  );
}
createRoot(document.getElementById("root")!).render(<App />);

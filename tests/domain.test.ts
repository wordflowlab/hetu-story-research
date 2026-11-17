import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import manifest from "../contracts/plugin-manifest.json" with { type: "json" };
import {
  KIND,
  PLUGIN_ID,
  canonical,
  clone,
  newProject,
  validate,
} from "../src/domain/model.ts";
import * as professional from "../src/domain/professional.ts";
import { memoryCore } from "./support/memory-core.ts";
import {
  scenario,
  original,
  base,
  selection,
  contextAction,
} from "./support/scenario.ts";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
function fixture() {
  const c = memoryCore(),
    ref = {
      kind: "document",
      work_ref: c.work,
      document_id: "doc",
      revision_id: "rev1",
      sha256: sha(original),
    };
  c.sources.set(canonical(ref), { content: original });
  return { c, ref };
}
function value(r: any) {
  assert.equal(r.status, "succeeded", JSON.stringify(r));
  return r.data;
}
function bad(r: any, code?: string) {
  assert.equal(r.status, "failed", JSON.stringify(r));
  if (code) assert.equal(r.error.code, code);
}
async function create(c: any, ref: any, p = scenario()) {
  return value(
    await c.invoke("save_project", {
      content: p,
      source_refs: [ref],
      expected_revision: 0,
      expected_sha256: "",
      operation_key: "create",
    }),
  );
}
test("专业方案完整保存、全部实体动作与依赖删除", async () => {
  const { c, ref } = fixture(),
    p = scenario();
  let r = await create(c, ref, newProject(p.title));
  if (KIND === "story_analysis")
    r = value(
      await c.invoke("save_project", {
        ...base(r, "scope"),
        content: { ...r.object.content, scope_indices: [0] },
      }),
    );
  for (const [item, field] of Object.entries(professional.fields)) {
    for (const row of p[field])
      r = value(
        await c.invoke("put_" + item, {
          ...base(r, "put-" + row.id),
          [item]: row,
        }),
      );
  }
  assert.deepEqual(r.object.content, p);
  const first = Object.keys(professional.fields)[0],
    row = p[Object.values(professional.fields)[0]][0];
  if (KIND !== "story_analysis")
    bad(
      await c.invoke("remove_" + first, {
        ...base(r, "dependency"),
        [first + "_id"]: row.id,
      }),
    );
  for (const [item, field] of Object.entries(professional.fields).reverse())
    for (const row of p[field])
      r = value(
        await c.invoke("remove_" + item, {
          ...base(r, "remove-" + row.id),
          [item + "_id"]: row.id,
        }),
      );
  for (const field of Object.values(professional.fields))
    assert.deepEqual(r.object.content[field], []);
});
test("Schema、重复ID、悬空依赖和错误引文均拒绝", async () => {
  const { c, ref } = fixture();
  const p = scenario(),
    field = Object.values(professional.fields)[0];
  assert.throws(() => validate({ ...p, extra: true }));
  const duplicate = clone(p);
  duplicate[field].push(clone(duplicate[field][0]));
  assert.throws(() => validate(duplicate));
  const wrong = clone(p);
  function change(v: any) {
    if (v && typeof v === "object") {
      if ("quote" in v) v.quote = "伪造";
      Object.values(v).forEach(change);
    }
  }
  change(wrong);
  bad(
    await c.invoke("save_project", {
      content: wrong,
      source_refs: [ref],
      expected_revision: 0,
      expected_sha256: "",
      operation_key: "badquote",
    }),
  );
  assert.equal(c.writes, 0);
  const invalid = clone(p);
  function bound(v: any) {
    if (v && typeof v === "object") {
      if ("quote" in v) v.byte_start = 1;
      Object.values(v).forEach(bound);
    }
  }
  bound(invalid);
  bad(
    await c.invoke("save_project", {
      content: invalid,
      source_refs: [ref],
      expected_revision: 0,
      expected_sha256: "",
      operation_key: "badbound",
    }),
  );
});
test("CAS、同键异参、未知先查、提交后断连仅落盘一次", async () => {
  const { c, ref } = fixture();
  let r = await create(c, ref);
  const i = {
    ...base(r, "advance"),
    content: { ...r.object.content, title: "新版" },
  };
  const next = value(await c.invoke("save_project", i));
  assert.equal(value(await c.invoke("save_project", i)).sha256, next.sha256);
  bad(
    await c.invoke("save_project", {
      ...i,
      content: { ...i.content, title: "另一个" },
    }),
    "idempotency_conflict",
  );
  bad(
    await c.invoke("save_project", { ...i, operation_key: "stale" }),
    "revision_conflict",
  );
  c.unknown = true;
  bad(
    await c.invoke("save_project", {
      ...base(next, "unknown"),
      content: next.object.content,
    }),
    "unknown",
  );
  assert.equal(c.writes, 2);
  c.unknown = false;
  c.failAfterWrite = true;
  const lost = {
    ...base(next, "lost"),
    content: { ...next.object.content, title: "已提交" },
  };
  bad(await c.invoke("save_project", lost));
  assert.equal(c.writes, 3);
  assert.equal(
    value(await c.invoke("save_project", lost)).object.title,
    "已提交",
  );
  assert.equal(c.writes, 3);
});
test("来源只追加、索引和读取预算", async () => {
  const { c, ref } = fixture();
  const r = await create(c, ref);
  bad(
    await c.invoke("save_project", {
      ...base(r, "remove-source"),
      source_refs: [],
      content: r.object.content,
    }),
  );
  bad(await c.invoke("get_source", { ...selection(r), source_index: 1 }));
  assert.equal(
    value(await c.invoke("get_source", { ...selection(r), source_index: 0 }))
      .source.content,
    original,
  );
  const empty = newProject();
  bad(
    await c.invoke("save_project", {
      ...base(r, "rewrite"),
      source_refs: [{ ...ref, revision_id: "fake" }],
      content: empty,
    }),
    "not_found",
  );
  c.sources.set(canonical(ref), { content: "a".repeat(2 * 1024 * 1024 + 1) });
  bad(
    await c.invoke("save_project", {
      content: newProject(),
      source_refs: [ref],
      expected_revision: 0,
      expected_sha256: "",
      operation_key: "large",
    }),
    "hetu.budget_exceeded",
  );
});
test("固定专业依据核验Owner、作品、修订、摘要与历史", async () => {
  const { c, ref } = fixture();
  const id = "ext_11111111-1111-4111-8111-111111111111",
    up = {
      object: {
        owner_plugin_id: "org.test.research",
        object_id: id,
        revision: 1,
        work_ref: c.work,
        content: { title: "上游" },
      },
      sha256: "a".repeat(64),
    };
  c.records.set(id, [up]);
  const basis = {
    owner_plugin_id: up.object.owner_plugin_id,
    object_id: id,
    revision: 1,
    sha256: up.sha256,
  };
  const p = { ...scenario(), basis_refs: [basis] },
    r = await create(c, ref, p);
  assert.equal(
    value(await c.invoke("get_basis", { ...selection(r), basis_index: 0 }))
      .basis.sha256,
    up.sha256,
  );
  for (const change of [
    { sha256: "b".repeat(64) },
    { owner_plugin_id: "org.test.other" },
    { revision: 2 },
  ])
    bad(
      await c.invoke("save_project", {
        content: { ...p, basis_refs: [{ ...basis, ...change }] },
        source_refs: [ref],
        expected_revision: 0,
        expected_sha256: "",
        operation_key: canonical(change),
      }),
    );
  const wrong = clone(up);
  wrong.object.work_ref.object_id = "other";
  c.records.set(id, [wrong]);
  bad(
    await c.invoke("get_basis", { ...selection(r), basis_index: 0 }),
    "hetu.stale_evidence",
  );
});
test("固定分块导出、HTML无执行代码、上下文省略可见", async () => {
  const { c, ref } = fixture();
  const r = await create(c, ref),
    select = selection(r);
  assert.equal(
    value(await c.invoke("list_projects", { query: "雨港" })).objects.length,
    1,
  );
  for (const format of ["json", "markdown", "html"]) {
    let out = "",
      offset = 0,
      full = "";
    do {
      const x = value(
        await c.invoke("export_project", {
          ...select,
          format,
          max_bytes: 97,
          offset,
        }),
      );
      assert.equal(sha(x.content), x.chunk_sha256);
      assert.equal(sha(x.content), x.content_sha256);
      full = x.report_sha256;
      out += x.content;
      if (x.next_offset === null) break;
      assert.ok(x.next_offset > offset);
      offset = x.next_offset;
    } while (true);
    assert.equal(sha(out), full);
    assert.ok(out.includes("雨港"));
    if (format === "html") assert.ok(!out.includes("<script"));
  }
  const x = value(
    await c.invoke(contextAction, { ...select, goal: "接续", max_chars: 100 }),
  );
  assert.ok(x.used_chars <= 100);
  assert.equal(x.truncated, true);
  assert.ok(x.omitted_fields.length);
  bad(
    await c.invoke(contextAction, {
      ...select,
      goal: "雨".repeat(150),
      max_chars: 100,
    }),
    "hetu.budget_exceeded",
  );
  assert.equal(
    value(await c.invoke("create_handoff", { ...select, goal: "准备下一章" }))
      .basis_ref.owner_plugin_id,
    PLUGIN_ID,
  );
  const updated = value(
    await c.invoke("save_project", {
      ...base(r, "v2"),
      content: { ...r.object.content, title: "新标题" },
    }),
  );
  assert.deepEqual(
    value(
      await c.invoke("compare_versions", {
        object_id: r.object.object_id,
        from_revision: 1,
        to_revision: 2,
      }),
    ).changes,
    ["title"],
  );
  assert.equal(value(await c.invoke("get_project", select)).sha256, r.sha256);
  assert.notEqual(updated.sha256, r.sha256);
});
if (KIND === "story_research") {
  test("反证不被已证实结论隐藏；日期与跨问题引用核验", () => {
    const p = scenario();
    const o = {
      ...p.observations[0],
      id: "counter",
      kind: "counterexample",
      polarity: "contradicts",
      statement: "后文可能反驳当前动机",
    };
    p.observations.push(o);
    assert.throws(() => validate(p));
    p.conclusions[0].status = "contested";
    p.conclusions[0].observation_ids.push("counter");
    validate(p);
    const digest = (professional as any).digest(p);
    assert.equal(digest.questions[0].contradicts.length, 1);
    p.observations[0].observed_on = "2026-02-30";
    assert.throws(() => validate(p));
  });
  test("无来源灵感只作推断，已回答问题必须有结论", () => {
    const p = scenario();
    p.observations[0].evidence = [];
    assert.throws(() => validate(p));
    p.observations[0].kind = "inference";
    p.conclusions[0].status = "proposed";
    validate(p);
    p.questions[0].status = "answered";
    assert.throws(() => validate(p));
  });
}
if (KIND === "character_lab") {
  test("字面最长姓名匹配、歧义别名和UTF8位置", () => {
    const p = scenario();
    p.characters[0].aliases = ["林", "A+B", "小陈"];
    p.characters.push({
      ...p.characters[0],
      id: "chen",
      name: "陈舟",
      aliases: ["小陈"],
    });
    const text = "🌿林溪林 A+B 小陈 陈舟",
      m = (professional as any).mentions(p, [{ content: text }], [0]);
    assert.equal(m.counts.lin, 3);
    assert.equal(m.counts.chen, 1);
    assert.equal(m.unassigned.length, 1);
    assert.equal(m.hits[0].byte_start, 4);
    for (const h of m.hits)
      assert.equal(
        Buffer.from(text).subarray(h.byte_start, h.byte_end).toString(),
        h.text,
      );
  });
  test("人物正式引用、访谈、弧光、试演参与者和筛选", async () => {
    const p = scenario();
    p.interviews[0].mode = "grounded";
    assert.throws(() => validate(p));
    p.interviews[0].evidence = p.characters[0].evidence;
    p.arcs[0].stage = "observed";
    assert.throws(() => validate(p));
    p.arcs[0].evidence = p.characters[0].evidence;
    validate(p);
    p.trials[0].lines[0].character_id = "missing";
    assert.throws(() => validate(p));
    const { c, ref } = fixture();
    p.trials = [];
    p.characters[0].entity_ref = "character_formal";
    p.characters[0].blueprint_source_index = 0;
    bad(
      await c.invoke("save_project", {
        content: p,
        source_refs: [ref],
        expected_revision: 0,
        expected_sha256: "",
        operation_key: "not-blueprint",
      }),
    );
    assert.throws(() =>
      (professional as any).contextProject(p, { character_id: "missing" }),
    );
  });
}
if (KIND === "story_analysis") {
  test("覆盖按UTF8区间并集，未读失败和空文本不造假", () => {
    const p = scenario();
    p.segments = [
      { ...p.segments[0], byte_end: 9 },
      { ...p.segments[0], id: "seg2", byte_start: 6, byte_end: 15 },
      { ...p.segments[0], id: "failed", byte_start: 15, status: "failed" },
    ];
    const cov = (professional as any).coverage(p, [{ content: original }]);
    assert.equal(cov.read_bytes, 15);
    assert.equal(cov.complete, false);
    assert.deepEqual(cov.sources[0].gaps, [[15, Buffer.byteLength(original)]]);
    assert.deepEqual(cov.sources[0].failed, ["failed"]);
    assert.equal(
      (professional as any).coverage({ ...p, segments: [] }, [{ content: "" }])
        .coverage,
      null,
    );
  });
  test("新稿影响递推到信号/读者/问题且不修改旧投影", () => {
    const p = scenario(),
      old = canonical(p),
      u = (professional as any).update(
        p,
        [{ content: original }, { content: "新稿" }],
        [{ old_source_index: 0, new_source_index: 1 }],
      );
    assert.equal(u.applied, false);
    assert.deepEqual(u.replacements[0].signals, ["sig1"]);
    assert.deepEqual(u.replacements[0].reader_views, ["rv1"]);
    assert.deepEqual(u.replacements[0].findings, ["f1"]);
    assert.equal(canonical(p), old);
    p.findings[0].status = "addressed";
    assert.throws(() => validate(p));
    p.findings[0].resolution = "新稿明确了动机";
    p.findings[0].recheck_source_indices = [1];
    validate(p);
    p.scenes[0].byte_start = 9;
    assert.throws(() => validate(p));
  });
}
test("包内Skill入口与完整动作地图可发现", async () => {
  for (const file of [
    manifest.contributions.skills[0].entry,
    "skills/" +
      manifest.contributions.skills[0].name +
      "/references/workflows.md",
    "CAPABILITIES.md",
  ])
    assert.ok((await readFile(file, "utf8")).length > 100);
  for (const a of manifest.contributions.actions) {
    assert.equal(a.input_schema.additionalProperties, false);
    if (a.effect !== "read") assert.ok(a.input_schema.properties.operation_key);
  }
});

test("离线报告转义脚本、事件属性和HTML标签", async () => {
  const { reportHTML } = await import("../src/domain/report.ts");
  const p = scenario();
  p.title = "雨港<script>alert(1)</script><img src=x onerror=alert(1)>";
  const html = reportHTML({
    project: p,
    project_ref: { object_id: "id", revision: 1, sha256: "a".repeat(64) },
    work_ref: { kind: "novel" },
    source_refs: [],
  });
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("<img "));
  assert.ok(html.includes("default-src"));
});

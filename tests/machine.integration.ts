import assert from "node:assert/strict";
import { test } from "node:test";
import { writeFile, readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";
import manifest from "../contracts/plugin-manifest.json" with { type: "json" };
import { KIND, newProject } from "../src/domain/model.ts";
import { fields } from "../src/domain/professional.ts";
import { importText, sha } from "./support/import.ts";
import { candidate, blueprint } from "./support/creative.ts";
import { start } from "./support/machine.ts";
import {
  scenario,
  original,
  base,
  selection,
  contextAction,
} from "./support/scenario.ts";
const error = (r: any) => r.error?.code ?? r.data?.result?.error?.code;
let n = 0;
const change = (r: any) => base(r, "machine-" + ++n);
test(
  "稳定MCP/CLI全动作、Skill、专业闭环、固定导出与热插拔",
  { timeout: 600000 },
  async (t) => {
    const c = await start();
    t.diagnostic(c.directory);
    try {
      assert.equal(c.cap.access_mode, "open");
      assert.equal(c.cap.actions.length, manifest.contributions.actions.length);
      for (const resource of [
        undefined,
        "references/workflows.md",
        "references/operations.md",
      ]) {
        const s = await c.invoke("skills.read", {
          skill_id: manifest.contributions.skills[0].id,
          ...(resource ? { resource } : {}),
        });
        assert.ok(s.content.length > 100);
      }
      const refs = await importText(c, [original]);
      let p = scenario();
      let r = await c.invoke("save_project", {
        content: newProject(p.title),
        source_refs: refs,
        expected_revision: 0,
        expected_sha256: "",
        operation_key: "first",
      });
      const initial = r;
      if (KIND === "story_analysis")
        r = await c.invoke("save_project", {
          ...change(r),
          content: { ...r.object.content, scope_indices: [0] },
        });
      for (const [item, field] of Object.entries(fields))
        for (const row of p[field])
          r = await c.invoke("put_" + item, { ...change(r), [item]: row });
      assert.deepEqual(r.object.content, p);
      assert.equal(
        (await c.invoke("list_projects", { query: "雨港" })).objects.length,
        1,
      );
      assert.equal(
        (await c.invoke("get_source", { ...selection(r), source_index: 0 }))
          .source.content,
        original,
      );
      const update = {
          ...change(r),
          content: { ...r.object.content, title: "雨港来信 · 第二版" },
        },
        previous = r;
      r = await c.invoke("save_project", update);
      assert.equal((await c.invoke("save_project", update)).sha256, r.sha256);
      assert.equal(
        error(
          await c.raw("save_project", {
            ...update,
            content: { ...update.content, title: "异参" },
          }),
        ),
        "idempotency_conflict",
      );
      assert.equal(
        error(
          await c.raw("save_project", { ...update, operation_key: "stale" }),
        ),
        "revision_conflict",
      );
      assert.equal(
        (
          await c.invoke("get_operation", {
            operation_key: update.operation_key,
          })
        ).sha256,
        r.sha256,
      );
      const basis = {
        owner_plugin_id: manifest.id,
        object_id: initial.object.object_id,
        revision: 1,
        sha256: initial.sha256,
      };
      r = await c.invoke("save_project", {
        ...change(r),
        content: { ...r.object.content, basis_refs: [basis] },
      });
      assert.equal(
        (await c.invoke("get_basis", { ...selection(r), basis_index: 0 })).basis
          .sha256,
        initial.sha256,
      );
      let lastHandoff: any;
      if (KIND === "story_research") {
        const digest = await c.invoke("get_research_digest", selection(r));
        assert.equal(digest.questions[0].supports.length, 1);
        await c.invoke("check_project", selection(r));
        const o = {
          ...p.observations[0],
          id: "counter",
          kind: "counterexample",
          polarity: "contradicts",
          statement: "反证：守候不能证明存在约定",
        };
        assert.ok(
          error(
            await c.raw("put_observation", { ...change(r), observation: o }),
          ),
        ); // 不准隐藏反证继续称supported
        r = await c.invoke("put_conclusion", {
          ...change(r),
          conclusion: { ...p.conclusions[0], status: "inconclusive" },
        });
        r = await c.invoke("put_observation", { ...change(r), observation: o });
        r = await c.invoke("put_conclusion", {
          ...change(r),
          conclusion: {
            ...p.conclusions[0],
            status: "contested",
            observation_ids: ["o1", "counter"],
          },
        });
        assert.equal(
          (await c.invoke("get_research_digest", selection(r))).questions[0]
            .contradicts.length,
          1,
        );
        r = await c.invoke("put_conclusion", {
          ...change(r),
          conclusion: { ...p.conclusions[0], status: "inconclusive" },
        });
        r = await c.invoke("remove_observation", {
          ...change(r),
          observation_id: "counter",
        });
      }
      if (KIND === "character_lab") {
        const bp = await blueprint(c);
        refs.push(bp);
        r = await c.invoke("save_project", {
          ...change(r),
          content: {
            ...r.object.content,
            characters: [
              {
                ...p.characters[0],
                entity_ref: "character_11111111-1111-4111-8111-111111111111",
                blueprint_source_index: 1,
              },
            ],
          },
          source_refs: refs,
        });
        const counts = await c.invoke("measure_mentions", {
          ...selection(r),
          source_indices: [0],
        });
        assert.equal(counts.counts.lin, 2);
        assert.equal(counts.metric, "literal_mentions");
        await c.invoke("check_development", selection(r));
      }
      await c.invoke(contextAction, {
        ...selection(r),
        goal: "依据当前成果准备下一章",
        max_chars: 12000,
      });
      lastHandoff = await c.invoke("create_handoff", {
        ...selection(r),
        goal: "把等待转为行动，保持未知寄件人悬念",
      });
      const generated = await candidate(
        c,
        "林溪把邮袋放在桌上，决定循着没有署名的来信去找寄件人。\n",
        "batch-b-next",
      );
      refs.push(generated.source_ref);
      r = await c.invoke("save_project", {
        ...change(r),
        source_refs: refs,
        content: r.object.content,
      });
      const taskRead = await c.ok("hetu_read_creative_task", {
        task_ref: generated.task.task_ref,
      });
      assert.ok(taskRead.request);
      if (KIND === "character_lab")
        r = await c.invoke("put_trial", {
          ...change(r),
          trial: { ...p.trials[0], candidate_source_index: refs.length - 1 },
        });
      if (KIND === "story_analysis") {
        const cov = await c.invoke("get_coverage", selection(r));
        assert.equal(cov.complete, true);
        await c.invoke("get_structure", selection(r));
        const impact = await c.invoke("preview_update", {
          ...selection(r),
          replacements: [{ old_source_index: 0, new_source_index: 1 }],
        });
        assert.equal(impact.applied, false);
        assert.deepEqual(impact.replacements[0].signals, ["sig1"]);
        r = await c.invoke("put_finding", {
          ...change(r),
          finding: {
            ...p.findings[0],
            status: "addressed",
            recheck_source_indices: [1],
            resolution: "新候选将等待转为寻找；仍需作者审阅。",
          },
        });
      }
      const preRemove = r;
      for (const [item, field] of Object.entries(fields).reverse())
        for (const row of p[field])
          r = await c.invoke("remove_" + item, {
            ...change(r),
            [item + "_id"]: row.id,
          });
      const comp = await c.invoke("compare_versions", {
        object_id: r.object.object_id,
        from_revision: 1,
        to_revision: r.object.revision,
      });
      assert.equal(comp.from_ref.sha256, initial.sha256);
      for (const format of ["json", "markdown", "html"]) {
        let offset = 0,
          body = "",
          hash = "";
        do {
          const out = await c.invoke("export_project", {
            ...selection(preRemove),
            format,
            offset,
            max_bytes: 4096,
          });
          assert.equal(sha(out.content), out.chunk_sha256);
          assert.equal(sha(out.content), out.content_sha256);
          hash = out.report_sha256;
          body += out.content;
          if (out.next_offset === null) break;
          offset = out.next_offset;
        } while (true);
        assert.equal(sha(body), hash);
      }
      const fixed = await c.invoke("get_project", selection(preRemove));
      assert.equal(fixed.sha256, preRemove.sha256);
      const cli = c.cli("hetu.plugins.invoke", {
        ...c.binding,
        capabilities_sha256: c.cap.capabilities_sha256,
        action: "get_project",
        arguments: selection(preRemove),
      });
      assert.equal(cli.data.result.data.sha256, preRemove.sha256);
      await c.apply("disable");
      assert.notEqual(
        (await c.raw("get_project", selection(r))).status,
        "succeeded",
      );
      await c.apply("enable");
      await c.discover();
      assert.equal(
        (await c.invoke("get_project", selection(r))).sha256,
        r.sha256,
      );
      await c.apply("uninstall");
      assert.notEqual(
        (await c.call("hetu_plugins_capabilities", c.binding)).status,
        "succeeded",
      );
      await c.apply("install");
      await c.discover();
      assert.equal(
        (await c.invoke("get_project", selection(preRemove))).sha256,
        preRemove.sha256,
      );
      assert.deepEqual(
        (await c.client.listTools()).tools.map((t: any) => t.name),
        c.tools,
      );
      const missed = manifest.contributions.actions
        .filter((a) => !c.actions.has(a.id))
        .map((a) => a.id);
      assert.deepEqual(missed, []);
      await writeFile(
      path.join(process.env.HETU_RECEIPT_DIRECTORY ?? "docs/research", "runtime-acceptance.json"),
        JSON.stringify(
          {
            date: new Date().toISOString(),
            platform: process.platform + " " + process.arch,
            package_sha256: c.pkg.package_sha256,
            actions: [...c.actions],
            core_version: c.coreVersion,
            host_source_commit: process.env.HETU_TEST_HOST_COMMIT ?? null,
            source_build: true,
            directory: c.directory,
            cli_mcp: true,
            skill_resources: true,
            hotplug: true,
            uninstall_reinstall: true,
            candidate_fixed_ref: generated.source_ref,
            handoff: lastHandoff.basis_ref,
            windows: false,
          },
          null,
          2,
        ) + "\n",
      );
    } finally {
      await c.client.close();
    }
  },
);

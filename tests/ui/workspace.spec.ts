import { scenario, original } from "../support/scenario.ts";
import { candidate } from "../support/creative.ts";
import { _electron as electron, expect, test } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import manifest from "../../contracts/plugin-manifest.json" with { type: "json" };
import { KIND, newProject } from "../../src/domain/model.ts";
import { importText } from "../support/import.ts";
import { host, start } from "../support/machine.ts";
test("真实Electron专业工作面、AI交接、固定导出、冲突与重开", async ({}, info) => {
  const c = await start();
  let app: any;
  try {
    const refs = await importText(c, [original]);
    const p = scenario();
    let record: any;
    app = await electron.launch({
      executablePath:
        process.env.HETU_PACKAGED_APP ??
        createRequire(path.join(host, "package.json"))("electron"),
      args: process.env.HETU_PACKAGED_APP
        ? []
        : [path.join(host, "apps/desktop")],
      env: c.env,
    });
    const exportPath = path.join(c.directory, "报告.html");
    await app.evaluate(
      ({ dialog }: any, { workspace, exportPath }: any) => {
        dialog.showOpenDialog = async () => ({
          canceled: false,
          filePaths: [workspace],
        });
        dialog.showSaveDialog = async () => ({
          canceled: false,
          filePath: exportPath,
        });
        dialog.showMessageBox = async () => ({
          response: 1,
          checkboxChecked: false,
        });
      },
      { workspace: c.workspace, exportPath },
    );
    const shell = await app.firstWindow();
    await shell
      .getByRole("button", { name: "打开作品", exact: true })
      .first()
      .click();
    await shell
      .getByRole("button", { name: "雨港来信", exact: false })
      .first()
      .click();
    const open = async () => {
      await shell
        .getByRole("button", { name: manifest.display["zh-CN"], exact: true })
        .click();
      await expect
        .poll(() =>
          app
            .context()
            .pages()
            .some((p: any) => p.url().startsWith("hetu-plugin:")),
        )
        .toBe(true);
      return app
        .context()
        .pages()
        .find((p: any) => p.url().startsWith("hetu-plugin:"));
    };
    let page: any = await open();
    await expect(
      page.getByRole("heading", { name: "从作品出发", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: info.outputPath("empty.png"),
      fullPage: true,
    });
    record = await c.invoke("save_project", {
      content: p,
      source_refs: refs,
      expected_revision: 0,
      expected_sha256: "",
      operation_key: "ui-seed",
    });

    await page.getByRole("button", { name: "刷新", exact: true }).click();

    const errors: string[] = [];
    page.on("pageerror", (e: Error) => errors.push(e.message));
    await page.setViewportSize({ width: 1360, height: 900 });
    await expect(
      page.getByRole("heading", { name: "雨港来信 · 作者审阅", exact: true }),
    ).toBeVisible();
    const buttons = await page
      .getByRole("navigation", { name: "专业视图" })
      .getByRole("button")
      .all();
    for (const [index, b] of buttons.entries()) {
      await b.click();
      await expect(b).toHaveAttribute("aria-current", "page");
      await expect(page.getByRole("alert")).toHaveCount(0);
      await page.screenshot({
        path: info.outputPath(`view-${index}.png`),
        fullPage: true,
      });
    }
    if (KIND === "story_research") {
      await page.getByRole("button", { name: "来源观察", exact: true }).click();
      await page
        .getByRole("button", { name: /查看依据 1/ })
        .first()
        .click();
      await expect(page.getByLabel("固定依据")).toContainText("林溪");
      await page.getByRole("button", { name: "关闭依据", exact: true }).click();
    }
    if (KIND === "character_lab") {
      await page.getByRole("button", { name: "提及测量", exact: true }).click();
      await page.getByRole("button", { name: "计算提及", exact: true }).click();
      await expect(page.getByLabel("固定依据")).toContainText("林溪：2 次");
      await page.getByRole("button", { name: "关闭依据", exact: true }).click();
    }
    if (KIND === "story_analysis") {
      await page.getByRole("button", { name: "阅读覆盖", exact: true }).click();
      await page
        .getByRole("button", { name: "查看覆盖与缺口", exact: true })
        .click();
      await expect(page.getByLabel("固定依据")).toContainText("100%");
      await page.getByRole("button", { name: "关闭依据", exact: true }).click();
      await page.getByRole("button", { name: "结构总览", exact: true }).click();
      await expect(page.locator("meter")).toHaveCount(1);
    }
    await buttons[0].click();
    expect(
      await page.evaluate(
        () => getComputedStyle(document.body).backgroundImage,
      ),
    ).toContain("gradient");
    await page.getByRole("button", { name: "让AI处理", exact: true }).focus();
    await expect(
      page.getByRole("button", { name: "让AI处理", exact: true }),
    ).toBeFocused();
    await page.getByLabel("创作目标").fill("依据当前方案，准备下一轮创作");
    await page.getByRole("button", { name: "让AI处理", exact: true }).click();
    await expect(page.locator(".status")).toContainText("已复制接续说明");
    const copied = await app.evaluate(({ clipboard }: any) =>
      clipboard.readText(),
    );
    expect(copied).toContain(record.object.object_id);
    expect(copied).toContain("准备下一轮");
    await page.getByLabel("创作目标").fill("");
    await page.getByText("版本与高级操作", { exact: true }).click();
    await page.getByRole("button", { name: "导出报告", exact: true }).click();
    await expect(page.locator(".status")).toContainText("已准备固定版本交付");
    expect((await readFile(exportPath, "utf8")).length).toBeGreaterThan(100);
    await page.screenshot({
      path: info.outputPath("workspace-light.png"),
      fullPage: true,
    });
    await page.evaluate(() => {
      document.documentElement.style.colorScheme = "dark";
    });
    await page.screenshot({
      path: info.outputPath("workspace-dark.png"),
      fullPage: true,
    });

    for (const [index, b] of buttons.entries()) {
      await b.click();
      await expect(page.getByRole("alert")).toHaveCount(0);
      await page.screenshot({
        path: info.outputPath("dark-view-" + index + ".png"),
        fullPage: true,
      });
    }
    await buttons[0].click();
    await page.setViewportSize({ width: 760, height: 860 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    await page.screenshot({
      path: info.outputPath("workspace-narrow.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "编辑专业数据", exact: true })
      .click();
    const editor = page.getByRole("textbox", { name: "专业数据", exact: true });
    const edited = { ...p, title: "保留作者的本地编辑" };
    await editor.fill(JSON.stringify(edited, null, 2));
    record = await c.invoke("save_project", {
      object_id: record.object.object_id,
      expected_revision: record.object.revision,
      expected_sha256: record.sha256,
      source_refs: refs,
      content: { ...p, title: "Agent已更新的版本" },
      operation_key: "concurrent",
    });
    await page
      .getByRole("button", { name: "保存专业修订", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText(/变化|冲突|基线/);
    await expect(editor).toHaveValue(JSON.stringify(edited, null, 2));
    await expect(
      page.getByRole("button", { name: "回读原操作", exact: true }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "返回作品", exact: true }).click();
    await expect
      .poll(
        () =>
          app
            .context()
            .pages()
            .filter((p: any) => p.url().startsWith("hetu-plugin:")).length,
      )
      .toBe(0);
    page = await open();
    await page.getByText("版本与高级操作", { exact: true }).click();
    await expect(
      page.getByRole("textbox", { name: "专业数据", exact: true }),
    ).toHaveValue(JSON.stringify(edited, null, 2));
    await page
      .getByRole("button", { name: "保存专业修订", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText(/变化|冲突|基线/);
    await expect(
      page.getByRole("textbox", { name: "专业数据", exact: true }),
    ).toHaveValue(JSON.stringify(edited, null, 2));
    expect(errors).toEqual([]);
    const metrics = await page.evaluate(() => ({
      font: getComputedStyle(document.body).fontSize,
      header: document.querySelector("header")!.getBoundingClientRect().height,
      overflow: document.documentElement.scrollWidth > innerWidth,
    }));
    expect(metrics.font).toBe("14px");
    expect(metrics.overflow).toBe(false);

    expect(
      (await c.invoke("get_project", { object_id: record.object.object_id }))
        .sha256,
    ).toBe(record.sha256);
    await writeFile(
      path.join(process.env.HETU_RECEIPT_DIRECTORY ?? "docs/research", "ui-acceptance.json"),
      JSON.stringify(
        {
          date: new Date().toISOString(),
          platform: process.platform + " " + process.arch,
          package_sha256: c.pkg.package_sha256,
          source_build: true,
          host: host,
          evidence_directory: info.outputDir,
          checks: [
            "empty-to-agent-result-refresh",
            "all-tabs-light-dark",
            "fixed-evidence",
            "professional-calculation",
            "keyboard",
            "ai-handoff",
            "fixed-html-export",
            "narrow-no-overflow",
            "cas-retains-input",
            "close-reopen-retains-baseline",
          ],
          viewport: [1360, 900],
          narrow_viewport: [760, 860],
          page_errors: errors,
        },
        null,
        2,
      ) + "\n",
    );
  } finally {
    await app?.close();
    await c.client.close();
  }
});

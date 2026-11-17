# 专业流程

提出问题 → 固定资料 → 区分引文、观察与推断 → 比较支持与反证 → 形成带限制的结论 → 固定交接给规划或写作。

采用来源分层、采集时间与交叉核对；不抓取付费正文，不以转载代替权利，不把排行等同于创作质量，不从章节标题推断已读剧情。

## 执行与交接

新建`save_project`使用expected_revision=0、expected_sha256=""；更新固定旧修订与摘要。专业内容格式见包内`contracts/plugin-manifest.json`。`put_*`／`remove_*`维护单条记录，依赖存在时先处理依赖，不自动级联删除。

来源用宿主固定的document/resource/blueprint引用；证据包含source_index、UTF-8 byte_start/byte_end、逐字一致quote。引用外部资料时先由已获文件/网络访问权的Agent取证并经宿主归档，插件不抓网、不读取任意本机文件。

跨插件以`create_handoff`返回的basis_ref保存为下游basis_refs，同作品固定Owner/object/revision/sha256。只读引用不转移写Owner；旧结论不随上游新版漂移。将专业成果用于规划、候选、意见或返工，使用宿主及对应插件的实际能力；不直接操作其内部文件。

有界上下文明确max_chars，阅读返回的omitted_fields并按需补读；字符不是token费用。整书超出预算时按固定卷章分拆方案，记录未覆盖部分。正文/设定/采纳不由本插件决定。

---
name: hetu-story-research
description: 在河图小说中使用创作研究台，把灵感、考据和公开观察整理为有据、可争论、可供规划引用的研究成果。；通过已安装的河图插件能力工作。
---

# 创作研究台

河图插件由河图安装和发现，不把本包安装成Codex插件。外部Agent负责理解和专业分析，插件保存可持续接续的成果。

1. 沿作者给出的客户端、management_ref、WorkRef接续。先发现`hetu_plugins_inspect`、`hetu_plugins_capabilities`及实际动作Schema，核对本包ID和包摘要；没有安装时先说明具体缺口。
2. 读取本包`list_projects`、`get_project`及既有固定来源；使用`get_source`读实际文字，用`get_basis`读已声明的上游固定专业成果，不能从标题声称已读。
3. 按[专业流程](references/workflows.md)组织工作，以[操作地图](references/operations.md)定位动作；实际参数以当前发现为准。通过稳定`hetu_plugins_invoke`或对应CLI封装调用，无需新增客户端工具名。
4. 每次写入固定基线revision/sha256和operation_key，保留确切输入。结果未知先`get_operation`回读；未查清不换键、不猜成功。冲突保留本地稿、旧基线与当前修订，显式合并后使用新键。
5. 回读真实保存结果，交付专业成果和下一步。要进入正文或正式设定，调用宿主已发现的管理/创作能力准备候选，采纳、定稿及外部副作用另行决定。

不内置模型或评分裁决；引句须匹配固定UTF-8字节；新增来源只追加。接收候选不代表作者认可。导出逐块校验摘要和固定对象修订，不能混读新版。

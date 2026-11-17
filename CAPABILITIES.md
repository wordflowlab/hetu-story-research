# 创作研究台功能清单

本包拥有专业能力；宿主拥有正文、来源与作者决定。

| 动作 | 用途 | 必填参数 | 效果 |
| --- | --- | --- | --- |
| list_projects | 查找方案 |  | read |
| get_project | 读取固定方案 | object_id | read |
| save_project | 保存完整方案 | expected_revision, expected_sha256, operation_key, content | managed_write |
| put_question | 维护问题 | object_id, expected_revision, expected_sha256, operation_key, question | managed_write |
| remove_question | 移除无依赖问题 | object_id, expected_revision, expected_sha256, operation_key, question_id | managed_write |
| put_observation | 维护观察 | object_id, expected_revision, expected_sha256, operation_key, observation | managed_write |
| remove_observation | 移除无依赖观察 | object_id, expected_revision, expected_sha256, operation_key, observation_id | managed_write |
| put_conclusion | 维护结论 | object_id, expected_revision, expected_sha256, operation_key, conclusion | managed_write |
| remove_conclusion | 移除结论 | object_id, expected_revision, expected_sha256, operation_key, conclusion_id | managed_write |
| get_research_digest | 读取问题、证据与冲突摘要 | object_id | read |
| check_project | 检查研究引用和缺口 | object_id | read |
| build_research_context | 准备有界研究上下文 | object_id, goal, max_chars | read |
| create_handoff | 生成固定专业交接 | object_id, goal | read |
| get_source | 读取固定依据 | object_id, source_index | read |
| get_basis | 读取固定上游成果 | object_id, basis_index | read |
| compare_versions | 比较专业修订 | object_id, from_revision, to_revision | read |
| export_project | 导出固定成果 | object_id, format | read |
| get_operation | 回读原操作 | operation_key | read |

默认流程、边界及验收见 [docs](docs/README.md)。

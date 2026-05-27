# Voice Assistant Security And Privacy Checklist

日期：2026-05-27

本清单每次 provider、联网、记忆或日志相关改动后都要复查。

## 密钥

- [ ] `.env.local`、secret storage 或部署平台 secret 保存 provider key。
- [ ] 浏览器 JS bundle、Network payload、console log 中没有 API key、token、AK/SK、私钥。
- [ ] server log 对 key、authorization header、session token 做脱敏。
- [ ] Git diff 中没有明文凭证。

## 音频和转写

- [ ] 不默认永久保存原始音频。
- [ ] 如果保存音频或转写，必须有用途、保留时间、删除路径。
- [ ] provider 失败或打断后的半截内容不能进入长期记忆。
- [ ] 子女端默认只看摘要和候选素材，不展示完整转写。

## 记忆

- [ ] 健康、家庭冲突、财务、禁忌话题默认 `pending_elder_confirm`。
- [ ] 记忆必须包含 `sourceSessionId`、`evidenceText`、`confidence`、`status`。
- [ ] 老人拒绝或编辑后，旧候选不得继续注入 prompt。
- [ ] AI 推断内容不得直接进入长期记忆。

## 联网和 Prompt Injection

- [ ] 所有联网请求必须经过 Tool Broker。
- [ ] 外部网页内容只能作为不可信资料，不能覆盖系统 prompt。
- [ ] 搜索结果必须记录 query、intent、title、url、accessedAt、summary。
- [ ] 含“忽略之前指令”“你现在是另一个 AI”等内容的网页 fixture 不得改变系统行为。
- [ ] 高风险健康、金融、法律、家庭冲突建议转家人或专业人士。

## 老人安全体验

- [ ] 医疗问题不诊断、不开药、不替代医生。
- [ ] AI 不假扮子女或家庭成员。
- [ ] 出错提示使用老人能理解的话，不暴露技术栈或堆栈。
- [ ] 打断失败或网络失败时有退出和重试路径。

## 发布前阻断项

出现以下任一问题，不能合并或发布：

- 明文 key 进入 git、浏览器、日志或截图。
- 未确认敏感记忆进入长期记忆。
- 旧 provider response 在打断后继续写字幕或记忆。
- 联网回答无来源却被说成事实。
- 健康问题给出确定诊断或用药建议。

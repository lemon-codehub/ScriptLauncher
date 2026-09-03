# 贡献指南

欢迎帮助完善 Script Launcher！小型修复可直接提交 PR；较大的功能或跨平台行为调整，请先开 Issue 讨论。

## 开始开发

1. Fork 仓库并创建主题分支。
2. 按 README 安装固定版本的 Wails CLI、Node.js 与 pnpm。
3. 使用 `pnpm --dir frontend install --frozen-lockfile` 安装依赖。
4. 使用独立的 `SCRIPT_LAUNCHER_DATA_DIR` 测试，避免影响日常使用的数据。

## 提交前检查

```bash
gofmt -w <修改过的Go文件>
pnpm --dir frontend build
go test ./...
go vet ./...
```

- 修改导出的 Go 接口或模型后，运行 `wails3 generate bindings -clean=true -ts -i` 并提交生成结果。
- 修改脚本执行、终止行为或数据库结构时，请补充相应测试。
- UI 变更请提供浅色/深色截图，并检查日志栏与较窄窗口布局。
- 在 PR 中注明验证过的系统与架构；交叉编译通过不等于目标系统实机验证。
- 保持 PR 聚焦，依赖变更同时更新 lockfile。
- 不要提交网站、私人部署脚本、数据库、生成的安装包、个人配置或任何凭据。
- 不要直接修改已发布的版本标签；发布由维护者完成。

## 协作约定

请尊重不同经验水平的贡献者，围绕代码和事实讨论，不进行人身攻击。示例脚本应无破坏性，分享日志前请遮盖账号、访问令牌、私有地址及敏感路径。

提交贡献表示你同意按照本项目的 MIT 许可证提供该贡献；第三方代码请保留原有许可证与署名。

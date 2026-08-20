# Astria Transcript Exporter Skill

一个供 Codex 使用的个人技能：粘贴 Astria（`astria.lonelyreader.com`）课程视频链接，导出带章节和时间戳的 Markdown 视频文稿。

## 适用范围

- 支持形如 `https://astria.lonelyreader.com/learningv2/C009/vod?unitId=...&activityKeyId=...` 的链接。
- 只能读取使用者自己的 Astria 账号有权访问的内容。
- 依赖 Astria 当前的内部文稿接口；站点接口变化后可能需要更新。
- 不支持其他视频或课程网站，也不提供登录、付费墙或访问控制绕过。

## 安装

将整个 `astria-transcript-exporter` 文件夹复制到个人 Codex 技能目录：

```text
~/.codex/skills/astria-transcript-exporter/
```

重新打开 Codex 任务后，可以直接提供 Astria 视频链接并要求导出文稿，也可以显式调用 `$astria-transcript-exporter`。

## 登录凭据

在运行任务的工作目录创建 `cookie.txt`，写入你自己的 Astria 请求 Cookie。该文件包含敏感登录信息：不要提交到 Git、发送给他人或写入技能目录。

脚本按以下顺序寻找 Cookie：

1. `--cookie-file <path>`
2. 环境变量 `ASTRIA_COOKIE_FILE`
3. 当前工作目录的 `cookie.txt`

Cookie 过期后，接口会返回 401 或 403；此时需要从自己已登录的 Astria 会话中重新获取。

## 直接运行脚本

需要 Node.js 18 或更高版本：

```powershell
node scripts/export-transcript.mjs "<Astria 视频链接>" --output-dir "<输出文件夹>"
```

输出 Markdown 包含课程、单元、视频标题、来源链接、时长、章节标题、段落时间戳和完整文稿。脚本不会把 Cookie、授权令牌或原始接口数据写入输出。

## 隐私与版权

请只导出你有权访问和使用的内容，并遵守 Astria 的服务条款及适用的版权规则。本仓库不包含任何 Cookie、账号标识、课程接口响应或课程文稿。

## 许可证

代码采用 [MIT License](LICENSE) 发布。课程内容及 Astria 平台本身不属于本许可证授权范围。

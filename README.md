# 牛马冲冲冲

一个 macOS 菜单栏应用。填好月薪和作息，桌面悬浮窗就会按计划工时实时显示今天已赚多少、每秒赚多少。午休暂停累计，下班后保留当天的成果。

[下载 v0.1.8 安装包](https://github.com/Bznzn/moumoumou/releases/download/v0.1.8/SalaryFloat-0.1.8-arm64.dmg) · [查看版本发布](https://github.com/Bznzn/moumoumou/releases/tag/v0.1.8)

适用于 Apple 芯片 Mac，要求 macOS 13 或更高版本。安装包使用临时签名，尚未经过 Apple 公证。

## 应用预览

| 实时收入悬浮窗 | 月度收入概览 |
| :---: | :---: |
| <img src="docs/screenshots/overlay.png" alt="桌面悬浮窗显示今日已赚和每秒收入" width="300"> | <img src="docs/screenshots/overview.png" alt="收入概览显示本月累计和每日明细" width="320"> |

<img src="docs/screenshots/overlay-adjustments.png" alt="设置中的浮窗移动和缩放控件" width="560">

截图中的金额和排班为演示数据。

## 主要功能

- **桌面实时收入**。随工作时间滚动显示今日收入，支持悬停变淡和点击穿透。
- **灵活排班**。支持固定工作日、大小周和午休，也可以在日历上单独调整休息或补班。
- **月度概览**。查看本月累计、进度和每日收入明细，调薪和作息可按月份生效。
- **浮窗调整**。可设置位置、大小和登录时自动显示。开启原生交互并授予辅助功能权限后，还可以从金额区直接拖动、拖边缘缩放和设置全屏时的不透明度。

## 开始使用

1. 打开下载的 DMG，把「牛马冲冲冲」拖到「应用程序」。
2. 启动应用，输入月薪，设置工作日、上下班和午休时间，保存后悬浮窗开始按作息累计。
3. 点击菜单栏「¥」，可以打开设置、查看收入概览，或随时显示和隐藏悬浮窗。

收入以人民币显示，根据输入的月薪与计划工时估算。月薪和排班保存在本机，无需注册账号。

<details>
<summary>从源码构建</summary>

需要 Apple 芯片 Mac、macOS 13+、Node.js 22.12+ 和 Xcode 命令行工具。

```sh
npm ci
node node_modules/electron/install.js
npm --prefix prototypes/window-interactions ci
node prototypes/window-interactions/node_modules/electron/install.js
npm --prefix prototypes/window-interactions run build:native
npm test
npm run typecheck
npm run dev
```

运行 `npm run dist:mac` 生成安装包。运行 `npm run test:e2e` 检查已构建的 macOS 应用。

</details>

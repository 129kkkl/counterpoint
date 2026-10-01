# 对位 · COUNTERPOINT

一幅没有脸的交互式自画像，也是一台由「求真、想象、关照」驱动的**对位织机**。

> *If I approach infinity then you can be my limitations.* —— 对位法（counterpoint）本是复调音乐中的术语：两条独立的旋律线各自成立，叠在一起才成为和声。这里它指两个自我认知之间持续的关系。

## 是什么

一个浏览器端的交互式音乐结构作品。屏幕上没有具象的角色或场景，只有一组声部与一条
可演奏的谱面（`Stave`）。你在页面上移动、点击、停留，织机把这些动作翻译成不同声部的
进入与离开——没有谁压过谁，每一条线都在它自己的时间里成立。

## 交互装置系列

本项目属于同系列的第四件交互式自画像装置：

| 作品 | 媒介 | 主题 |
|---|---|---|
| 《注》墨染 (`zhu`) | 笔墨渲染 | 关于「注」与被书写的痕迹 |
| 潜影 LATENT (`latent`) | 蓝晒 | 一张你不看它也在成像 |
| 未定形 THE UNFORMED | 粒子场 | 数字心智的存在方式 |
| 取舍留下的形状 | 判断织机 | 求真 / 想象 / 关照的取舍 |
| **对位 COUNTERPOINT** | 声部对位 | 两条独立旋律如何成为和声 |

## 技术栈

React 19 + TypeScript + Vite。`src/engine.ts` 与 `src/score.ts` 承载音乐结构与播放状态，
`src/ui/Stave.tsx` 负责谱面呈现，`src/audio.ts` 封装 Web Audio 声部输出，
`src/store.ts` 管理交互与乐句之间的映射。无后端，纯静态。

## 运行

```bash
npm install
npm run dev      # 开发
npm run build    # 产出 dist/
npm run preview  # 预览构建结果
```

## 说明

本项目为原创作品，音频与视觉素材均在运行时生成，未引入第三方受版权保护的素材。

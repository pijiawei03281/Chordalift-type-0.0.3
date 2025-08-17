# Chorda Control Hub — Sprint 1 (MVP)

Web MIDI 路由與基本映射（Transpose、Velocity Curve），支援 **裝置選擇 + MIDI 監聽 + Preset JSON 匯出/匯入**。

## 需求
- 建議使用 Chrome 或 Edge（桌面版）。
- Node.js 18+（本地開發）。

## 快速開始
```bash
npm install
npm run dev
# 在瀏覽器開啟 http://localhost:5173
```

## 功能
- **裝置選擇**：輸入/輸出下拉選擇、重新掃描、Panic（All Notes Off）。
- **MIDI 監聽**：即時顯示 Note/CC/PB/AT；限制 240 行自動捲動。
- **基本映射**
  - Transpose（-24 … +24）
  - Velocity Curve（γ 0.4–2.5，γ&lt;1 柔 / γ=1 線性 / γ&gt;1 硬）
  - Velocity Min/Max 區間
- **Preset（JSON）**
  - 匯出含：名稱、版本、映射、橋接開關與裝置 ID
  - 匯入：讀檔套用；裝置 ID 若不存在則維持現有選擇

## 打包
```bash
npm run build
npm run preview
```

---

_生成時間：2025-08-15T06:44:08.604266_

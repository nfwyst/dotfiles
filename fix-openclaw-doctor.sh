#!/usr/bin/env bash
# fix-openclaw-doctor.sh — 修复 openclaw doctor 报告的所有问题
# 用法: bash fix-openclaw-doctor.sh
set -euo pipefail

echo "=== 1/4 修复 doctor 自动迁移项 ==="
openclaw doctor --fix

echo ""
echo "=== 2/4 清理缺失 transcript 的 session ==="
openclaw sessions cleanup \
  --store "/Users/malisheng/.openclaw/agents/main/sessions/sessions.json" \
  --enforce --fix-missing

echo ""
echo "=== 3/4 重建 shell completion 缓存 ==="
openclaw completion --write-state

echo ""
echo "=== 4/4 验证环境变量 ==="
if grep -q "KIMI_API_KEY" ~/.openclaw/.env 2>/dev/null; then
  echo "✅ KIMI_API_KEY 已设置"
else
  echo "⚠️  KIMI_API_KEY 未在 ~/.openclaw/.env 中找到"
  echo "   请添加: KIMI_API_KEY=sk-kimi-你的密钥"
fi

echo ""
echo "=== 完成! 请重启 OpenClaw ==="
echo "运行: openclaw restart"
echo "然后在 Telegram 中发送 /new 开始新会话测试"

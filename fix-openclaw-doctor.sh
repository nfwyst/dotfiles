#!/usr/bin/env bash
# fix-openclaw-doctor.sh — 修复 openclaw doctor 报告的所有问题
# 用法: bash fix-openclaw-doctor.sh
set -euo pipefail

echo "=== 1/5 修复 doctor 自动迁移项 ==="
openclaw doctor --fix

echo ""
echo "=== 2/5 清理缺失 transcript 的 session ==="
openclaw sessions cleanup \
  --store "/Users/malisheng/.openclaw/agents/main/sessions/sessions.json" \
  --enforce --fix-missing

echo ""
echo "=== 3/5 重建 shell completion 缓存 ==="
openclaw completion --write-state

echo ""
echo "=== 4/5 设置 MOONSHOT_API_KEY（复用 Kimi Coding 密钥） ==="
ENV_FILE="$HOME/.openclaw/.env"
if grep -q "^MOONSHOT_API_KEY=" "$ENV_FILE" 2>/dev/null; then
  echo "✅ MOONSHOT_API_KEY 已设置"
elif grep -q "^KIMI_API_KEY=" "$ENV_FILE" 2>/dev/null; then
  KIMI_KEY=$(grep "^KIMI_API_KEY=" "$ENV_FILE" | head -1 | cut -d= -f2-)
  echo "MOONSHOT_API_KEY=$KIMI_KEY" >> "$ENV_FILE"
  echo "✅ 已将 KIMI_API_KEY 的值复制为 MOONSHOT_API_KEY"
else
  echo "⚠️  未找到 KIMI_API_KEY，请手动添加到 $ENV_FILE:"
  echo "   MOONSHOT_API_KEY=sk-kimi-你的密钥"
fi

echo ""
echo "=== 5/5 重启 OpenClaw ==="
openclaw restart
echo ""
echo "✅ 完成！请在 Telegram 中发送 /new 开始新会话测试"

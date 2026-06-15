const handler = async (event: any) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.OPENCLAW_NOTIFY_CHAT_ID;

  if (!token || !chatId) {
    console.error(
      "[startup-notify] Missing TELEGRAM_BOT_TOKEN or OPENCLAW_NOTIFY_CHAT_ID",
    );
    return;
  }

  const text = `✅ OpenClaw Gateway started\n🕐 ${new Date().toISOString()}`;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (err) {
    console.error("[startup-notify]", err);
  }
};

export default handler;

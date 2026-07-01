// ═══════════════════════════════════════════
//  GHOST — AI Chat
//  "I'm smarter than you. But I'll pretend otherwise."
// ═══════════════════════════════════════════

const fetch = require('node-fetch');

module.exports = {
  name: 'ai',
  alias: ['gpt', 'ask', 'ghost'],
  desc: 'Ask Ghost anything — AI-powered responses',
  execute: async ({ client, m, args, cmdText }) => {
    const question = cmdText;
    if (!question) return m.reply('Ask me something.\n\nUsage: .ai <question>');

    await client.sendPresenceUpdate('composing', m.chat);
    await m.reply('Thinking...');

    const apis = [
      `https://api.bk9.dev/ai/llama?q=${encodeURIComponent(question)}`,
    ];

    let reply = '';
    for (const url of apis) {
      try {
        const r = await fetch(url, { timeout: 15000 });
        const d = await r.json();
        reply = d?.BK9 || d?.reply || d?.result || d?.response || d?.message || d?.answer || '';
        if (reply.trim()) break;
      } catch { continue; }
    }

    if (!reply.trim()) return m.reply('My brain is lagging. Try again.');

    await client.sendPresenceUpdate('paused', m.chat);
    await client.sendMessage(m.chat, { text: reply.trim() }, { quoted: m.key });
  },
};
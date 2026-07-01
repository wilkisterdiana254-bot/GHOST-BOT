// ═══════════════════════════════════════════
//  GHOST — Ping Command
//  "Yes, I'm alive. Shocking, I know."
// ═══════════════════════════════════════════

module.exports = {
  name:  'ping',
  alias: ['p', 'alive'],
  execute: async ({ client, m }) => {
    const start = Date.now();
    await m.reply('Loading...');
    const ms = Date.now() - start;
    await m.reply(`*GHOST-MD is alive*\n\nResponse: ${ms}ms\nUptime: ${formatUptime(process.uptime())}\nMode: ${client.public ? 'public' : 'private'}`);
  },
};

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const min = Math.floor((seconds % 3600) / 60);
  return `${d}d ${h}h ${min}m`;
}
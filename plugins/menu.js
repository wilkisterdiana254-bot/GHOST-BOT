// ═══════════════════════════════════════════
//  GHOST — Menu Command
//  "Here's everything I can do. Try not to be impressed."
// ═══════════════════════════════════════════

const { loadPlugins } = require('./loader');

module.exports = {
  name:  'menu',
  alias: ['help', 'commands'],
  execute: async ({ client, m, isOwner }) => {
    const plugins = loadPlugins();
    const prefix = client.prefix || '.';

    let menu = `*╔═══════════════════╗*\n`;
    menu +=    `*║    ${client.botname}     ║*\n`;
    menu +=    `*╚═══════════════════╝*\n\n`;
    menu += `*Prefix:* ${prefix}\n`;
    menu += `*Mode:* ${client.public ? 'Public' : 'Private'}\n\n`;
    menu += `*── COMMANDS ──*\n\n`;

    for (const p of plugins) {
      if (p.owner && !isOwner && !m.key.fromMe) continue;
      if (p.hidden) continue;
      const aliases = Array.isArray(p.alias) ? p.alias : [];
      const tag = p.owner ? ' [owner]' : '';
      menu += `  *${prefix}${p.name}*${aliases.length ? ` (${aliases.join(', ')})` : ''} — ${p.desc || 'No description'}${tag}\n`;
    }

    menu += `\n_Send "${prefix}menu" anytime to see this._`;
    await m.reply(menu);
  },
};
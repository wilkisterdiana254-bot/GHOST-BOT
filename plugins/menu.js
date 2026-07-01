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
    const p = client.prefix || '.';

    let menu = `╔══════════════════════════╗\n`;
    menu +=    `║   *${client.botname || 'GHOST-MD'}*        ║\n`;
    menu +=    `║   v2.0 — BLACK-MD Fork  ║\n`;
    menu +=    `╚══════════════════════════╝\n\n`;
    menu += `*Prefix:* ${p}\n`;
    menu += `*Mode:* ${client.public ? 'Public' : 'Private'}\n\n`;

    const categories = {
      'Core': [],
      'Owner': [],
      'Group': [],
      'Media': [],
      'Utilities': [],
    };

    for (const plugin of plugins) {
      if (plugin.owner && !isOwner && !m.key.fromMe) continue;
      if (plugin.hidden) continue;

      const aliases = Array.isArray(plugin.alias) ? plugin.alias : [];
      const tag = plugin.owner ? ' [owner]' : plugin.group ? ' [group]' : '';
      const line = `  *${p}${plugin.name}*${aliases.length ? ` (${aliases.join(', ')})` : ''} — ${plugin.desc || 'No description'}${tag}`;

      if (plugin.owner) categories['Owner'].push(line);
      else if (plugin.group) categories['Group'].push(line);
      else if (['play', 'video', 'ig', 'tiktok', 'sticker'].some(n => plugin.name === n || aliases.includes(n))) categories['Media'].push(line);
      else if (['ping', 'menu', 'jid'].some(n => plugin.name === n || aliases.includes(n))) categories['Core'].push(line);
      else categories['Utilities'].push(line);
    }

    for (const [cat, cmds] of Object.entries(categories)) {
      if (cmds.length === 0) continue;
      menu += `*── ${cat} ──*\n`;
      menu += cmds.join('\n') + '\n\n';
    }

    menu += `_Powered by Ghost 🖤_`;
    await m.reply(menu);
  },
};
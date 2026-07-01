// ═══════════════════════════════════════════
//  GHOST — Owner Commands
//  "With great power comes... well, me."
//  Exports an array of plugins.
// ═══════════════════════════════════════════

module.exports = [
  {
    name:  'shutdown',
    alias: ['die', 'off'],
    owner: true,
    desc:  'Kill the bot process (owner only)',
    execute: async ({ client, m, isOwner }) => {
      if (!isOwner && !m.key.fromMe) return;
      await m.reply('Ghost is going dark. See you on the other side.');
      process.exit(0);
    },
  },
  {
    name:  'setprefix',
    alias: ['sp'],
    owner: true,
    desc:  'Change the command prefix (owner only)',
    execute: async ({ client, m, args, isOwner }) => {
      if (!isOwner && !m.key.fromMe) return;
      const newPrefix = args[0];
      if (!newPrefix) return m.reply('Provide a new prefix. Example: .setprefix !');
      client.prefix = newPrefix;
      await m.reply(`Prefix changed to *${newPrefix}*`);
    },
  },
  {
    name:  'setmode',
    alias: ['sm'],
    owner: true,
    desc:  'Switch between public and private mode (owner only)',
    execute: async ({ client, m, args, isOwner }) => {
      if (!isOwner && !m.key.fromMe) return;
      const newMode = args[0]?.toLowerCase();
      if (!['public', 'private'].includes(newMode)) {
        return m.reply('Usage: .setmode public|private');
      }
      client.public = newMode === 'public';
      await m.reply(`Mode changed to *${newMode}*`);
    },
  },
  {
    name: 'jid',
    alias: ['whoami', 'myid'],
    desc: 'Get your WhatsApp JID',
    execute: async ({ m }) => {
      await m.reply(`Your JID: ${m.sender}`);
    },
  },
];
// ═══════════════════════════════════════════
//  GHOST — Group Utilities
//  "Managing groups so you don't have to."
// ═══════════════════════════════════════════

module.exports = [
  {
    name: 'groupinfo',
    alias: ['ginfo', 'gcinfo'],
    group: true,
    desc: 'Get group metadata',
    execute: async ({ client, m }) => {
      if (!m.isGroup) return m.reply('This command is for groups only.');
      try {
        const meta = await client.groupMetadata(m.sender);
        const desc = meta.desc || 'No description';
        const owner = meta.owner || 'Unknown';
        await m.reply(
          `*Group Info*\n\n` +
          `Name: ${meta.subject}\n` +
          `Members: ${meta.participants.length}\n` +
          `Created by: ${owner}\n` +
          `ID: ${meta.id}\n\n` +
          `*Description:*\n${desc}`
        );
      } catch (e) {
        m.reply('Failed to fetch group info.');
      }
    },
  },
  {
    name: 'tagall',
    alias: ['everyone', 'tag'],
    group: true,
    desc: 'Tag all group members',
    execute: async ({ client, m, args, isOwner }) => {
      if (!m.isGroup) return m.reply('This command is for groups only.');

      try {
        const meta = await client.groupMetadata(m.sender);
        const text = args.join(' ') || 'Attention everyone!';
        const mentions = meta.participants.map(p => p.id);
        await client.sendMessage(m.sender, { text: `@everyone ${text}`, mentions });
      } catch (e) {
        m.reply('Failed to tag members.');
      }
    },
  },
  {
    name: 'profile',
    alias: ['pp'],
    desc: 'Get profile picture of a user',
    execute: async ({ client, m, args }) => {
      const jid = m.quoted?.sender || m.mentions[0] || m.sender;
      try {
        const ppUrl = await client.profilePictureUrl(jid, 'image');
        await client.sendMessage(m.sender, {
          image: { url: ppUrl },
          caption: `Profile picture of ${jid}`,
        });
      } catch {
        await m.reply('Could not fetch profile picture. User may not have one set.');
      }
    },
  },
];
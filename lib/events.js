// ═══════════════════════════════════════════
//  GHOST — Group Events (Welcome/Leave)
// ═══════════════════════════════════════════

const { botname } = require('../set.js');
const welcomeEnabled = () => (process.env.WELCOME || 'on') === 'on';

const handleGroupEvent = async (client, update) => {
  if (!welcomeEnabled()) return;

  try {
    const metadata = await client.groupMetadata(update.id);
    const participants = update.participants || [];

    for (const num of participants) {
      let ppUrl;
      try {
        ppUrl = await client.profilePictureUrl(num, 'image');
      } catch {
        ppUrl = 'https://files.catbox.moe/s5nuh3.jpg';
      }

      if (update.action === 'add') {
        const text = `@${num.split('@')[0]} Welcome to *${metadata.subject}*. 👋\n\n` +
                     `Read the group description and follow the rules.\n\n` +
                     `Powered by ${botname} 🖤`;

        await client.sendMessage(update.id, {
          image: { url: ppUrl },
          caption: text,
          mentions: [num],
        });
      } else if (update.action === 'remove') {
        const text = `@${num.split('@')[0]} left the building. Goodbye. 🖤`;

        await client.sendMessage(update.id, {
          image: { url: ppUrl },
          caption: text,
          mentions: [num],
        });
      }
    }
  } catch (err) {
    console.error('Group event error:', err.message);
  }
};

module.exports = { handleGroupEvent };
// ═══════════════════════════════════════════
//  GHOST — Sticker Maker
//  "Because regular images are too mainstream."
// ═══════════════════════════════════════════

module.exports = {
  name:  'sticker',
  alias: ['s', 'take'],
  desc:  'Convert an image/video to a sticker',
  group: false,
  execute: async ({ client, m }) => {
    const mime = (m.msg?.imageMessage || m.msg?.videoMessage)?.mimetype;
    if (!mime) return m.reply('Reply to an image or video to make a sticker.');

    let buffer;
    try {
      buffer = await client.downloadMediaMessage(m);
    } catch (e) {
      return m.reply('Failed to download media.');
    }

    const { default: makeWASocket } = require('@whiskeysockets/baileys');
    const { MessageType } = require('@whiskeysockets/baileys');

    const isVideo = mime.startsWith('video');

    await client.sendMessage(m.sender, {
      sticker: buffer,
      ...(isVideo ? { mimetype: 'video/mp4' } : {}),
    });
  },
};
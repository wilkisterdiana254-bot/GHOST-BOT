// ═══════════════════════════════════════════
//  GHOST — Anti-Delete
//  Stores deleted messages and re-sends them
// ═══════════════════════════════════════════

const { getContentType } = require('@whiskeysockets/baileys');

if (!global.deletedMessages) global.deletedMessages = new Map();

const antiDeleteHandler = async (client, msg) => {
  try {
    const from = msg.key.remoteJid;
    if (!from || from === 'status@broadcast') return;

    const id = msg.key.id;

    // Store the message
    global.deletedMessages.set(id, {
      msg,
      from,
      sender: msg.key.participant || msg.key.remoteJid,
      timestamp: Date.now(),
    });

    // Cleanup old entries (keep last 200)
    if (global.deletedMessages.size > 200) {
      const keys = [...global.deletedMessages.keys()];
      for (let i = 0; i < keys.length - 200; i++) {
        global.deletedMessages.delete(keys[i]);
      }
    }
  } catch {}
};

// Listen for message deletes
const setupAntiDelete = (client) => {
  client.ev.on('messages.delete', async (deleteEvent) => {
    if (deleteEvent.key?.remoteJid === 'status@broadcast') return;

    for (const key of (deleteEvent.keys || [])) {
      const deleted = global.deletedMessages.get(key.id);
      if (!deleted) continue;

      try {
        const sender = deleted.sender || key.remoteJid;
        const ctype = getContentType(deleted.msg.message);
        let text = `🖤 *GHOST Anti-Delete*\n\n@${sender.split('@')[0]} deleted a message:\n\n`;

        if (ctype === 'conversation') {
          text += deleted.msg.message.conversation;
          await client.sendMessage(deleted.from, {
            text,
            contextInfo: { mentionedJid: [sender] },
          });
        } else if (ctype === 'extendedTextMessage') {
          text += deleted.msg.message.extendedTextMessage.text;
          await client.sendMessage(deleted.from, {
            text,
            contextInfo: { mentionedJid: [sender] },
          });
        } else if (['imageMessage', 'videoMessage', 'audioMessage'].includes(ctype)) {
          // Re-forward the media
          await client.sendMessage(deleted.from, {
            forward: deleted.msg,
            contextInfo: {
              mentionedJid: [sender],
              forwardedNewsletterMessageInfo: undefined,
            },
          });
          await client.sendMessage(deleted.from, {
            text: `🖤 @${sender.split('@')[0]} deleted this ${ctype.replace('Message', '')}.`,
            contextInfo: { mentionedJid: [sender] },
          });
        }

        global.deletedMessages.delete(key.id);
      } catch (err) {
        console.error('Anti-delete recovery error:', err.message);
      }
    }
  });
};

module.exports = { antiDeleteHandler, setupAntiDelete };
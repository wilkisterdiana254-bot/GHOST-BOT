// ═══════════════════════════════════════════
//  GHOST — Utility Commands
//  "Because basic tasks still need doing."
// ═══════════════════════════════════════════

const fetch = require('node-fetch');

module.exports = [
  {
    name: 'translate',
    alias: ['tr'],
    desc: 'Translate text to a language',
    execute: async ({ m, args }) => {
      const text = args.slice(1).join(' ');
      const lang = args[0];
      if (!lang || !text) return m.reply('Usage: .translate <language> <text>\n\nExample: .translate sw Hello world');

      try {
        const r = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${lang}`);
        const d = await r.json();
        const translated = d?.responseData?.translatedText;
        if (!translated) return m.reply('Translation failed. Try another language code.');

        await m.reply(`*Original (${lang}):*\n${text}\n\n*Translated:*\n${translated}`);
      } catch {
        await m.reply('Translation service unavailable.');
      }
    },
  },
  {
    name: 'weather',
    alias: ['w'],
    desc: 'Get weather info for a city',
    execute: async ({ m, args }) => {
      const city = args.join(' ');
      if (!city) return m.reply('Provide a city name.\n\nUsage: .weather Nairobi');

      try {
        const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=0&longitude=0&current_weather=true&search=${encodeURIComponent(city)}`);
        if (r.status !== 200) {
          // Fallback
          const r2 = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`);
          const d2 = await r2.json();
          const current = d2.current_condition[0];
          const text = `*Weather in ${city}*\n\n` +
            `Condition: ${current.weatherDesc[0].value}\n` +
            `Temperature: ${current.temp_C}°C / ${current.temp_F}°F\n` +
            `Humidity: ${current.humidity}%\n` +
            `Wind: ${current.windspeedKmph} km/h`;
          return m.reply(text);
        }
        const d = await r.json();
        const w = d.current_weather;
        await m.reply(`*Weather in ${city}*\n\nTemperature: ${w.temperature}°C\nWind: ${w.windspeed} km/h\nCondition: ${w.weathercode}`);
      } catch {
        await m.reply('Failed to fetch weather data.');
      }
    },
  },
  {
    name: 'ss',
    alias: ['screenshot', 'webss'],
    desc: 'Take a screenshot of a webpage',
    execute: async ({ client, m, args }) => {
      const url = args[0];
      if (!url) return m.reply('Provide a URL.\n\nUsage: .ss https://example.com');

      await m.reply('Capturing screenshot...');
      try {
        const pic = `https://image.thum.io/get/width/1280/${url}`;
        await client.sendMessage(m.chat, {
          image: { url: pic },
          caption: `Screenshot of ${url}`,
        }, { quoted: m.key });
      } catch {
        await m.reply('Failed to capture screenshot.');
      }
    },
  },
  {
    name: 'quote',
    alias: ['qc'],
    desc: 'Create a fake quote/reply message',
    execute: async ({ client, m, args }) => {
      const text = args.join(' ');
      if (!text && !m.quoted) return m.reply('Reply to a message or provide text.\n\nUsage: .quote <text>');

      const quotedText = text || m.quoted?.text || '';
      const quotedSender = m.quoted?.sender || m.sender;
      const pushName = quotedSender.split('@')[0];

      await client.sendMessage(m.chat, {
        text: quotedText,
        contextInfo: {
          remoteJid: m.chat,
          participant: quotedSender,
          quotedMessage: {
            conversation: quotedText,
          },
        },
      }, { quoted: m.key });
    },
  },
  {
    name: 'active',
    alias: ['activity'],
    group: true,
    desc: 'Show most active users in group',
    execute: async ({ m }) => {
      if (!m.isGroup) return m.reply('Group command only.');
      const users = global.getActiveUsers(m.chat, 15);
      if (!users.length) return m.reply('No activity data yet.');

      let text = '*Most Active Members* 🖤\n\n';
      users.forEach((u, i) => {
        text += `${i + 1}. @${u.jid.split('@')[0]} — ${u.count} messages\n`;
      });

      await client.sendMessage(m.chat, {
        text,
        contextInfo: { mentionedJid: users.map(u => u.jid) },
      }, { quoted: m.key });
    },
  },
  {
    name: 'gcp',
    alias: ['changepp'],
    owner: true,
    desc: 'Change bot profile picture (reply to image)',
    execute: async ({ client, m }) => {
      const mime = m.msg?.imageMessage?.mimetype;
      if (!mime) return m.reply('Reply to an image to set as profile picture.');

      try {
        const buffer = await client.downloadMediaMessage(m);
        await client.updateProfilePicture(client.user.id, buffer);
        await m.reply('Profile picture updated. Looking good.');
      } catch {
        await m.reply('Failed to update profile picture.');
      }
    },
  },
  {
    name: 'block',
    owner: true,
    desc: 'Block a user (owner only)',
    execute: async ({ client, m, args }) => {
      const jid = m.quoted?.sender || m.mentionedJid[0] || (args[0] ? args[0] + '@s.whatsapp.net' : '');
      if (!jid) return m.reply('Reply to or mention someone to block.');

      try {
        await client.updateBlockStatus(jid, 'block');
        await m.reply(`Blocked @${jid.split('@')[0]}`);
      } catch {
        await m.reply('Failed to block user.');
      }
    },
  },
  {
    name: 'unblock',
    owner: true,
    desc: 'Unblock a user (owner only)',
    execute: async ({ client, m, args }) => {
      const jid = m.quoted?.sender || m.mentionedJid[0] || (args[0] ? args[0] + '@s.whatsapp.net' : '');
      if (!jid) return m.reply('Reply to or mention someone to unblock.');

      try {
        await client.updateBlockStatus(jid, 'unblock');
        await m.reply(`Unblocked @${jid.split('@')[0]}`);
      } catch {
        await m.reply('Failed to unblock user.');
      }
    },
  },
];
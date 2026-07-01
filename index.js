// ═══════════════════════════════════════════════════════════════
//  GHOST-MD  v2.0
//  "The machine that dreams in binary."
//  Forked from BLACK-MD concepts. Rebuilt cleaner. Rebuilt deadlier.
// ═══════════════════════════════════════════════════════════════

require('dotenv').config({ path: './.env' });
const path            = require('path');
const fs              = require('fs');
const util            = require('util');
const express         = require('express');
const chalk           = require('chalk');
const figlet          = require('figlet');
const QRCode          = require('qrcode');
const qrcodeTerminal  = require('qrcode-terminal');
const pino            = require('pino');
const fetch           = require('node-fetch');

const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  downloadContentFromMessage,
  jidNormalizedUser,
  getContentType,
  DisconnectReason,
} = require('@whiskeysockets/baileys');

const { Boom } = require('@hapi/boom');
const {
  botname, prefix, owner, dev, mode, port,
  anticall, autoread, antilink, badwords,
  autobio, autolike, autoview, antidelete, antibot, antitag,
} = require('./set.js');
const { loadPlugins, runCommand } = require('./plugins/loader');
const { handleGroupEvent } = require('./lib/events');
const { antiDeleteHandler, setupAntiDelete } = require('./lib/antidelete');
const color = (text, c) => !c ? chalk.green(text) : chalk.keyword(c)(text);

// ─── State ───────────────────────────────────────
let qrCodeData = null;
let connectionStatus = 'connecting';
let client = null;

// Active user tracking
if (!global.activeUserStore) global.activeUserStore = new Map();
global.trackMessage = function (groupJid, userJid) {
  if (!groupJid || !userJid) return;
  if (!global.activeUserStore.has(groupJid)) global.activeUserStore.set(groupJid, new Map());
  const group = global.activeUserStore.get(groupJid);
  group.set(userJid, (group.get(userJid) || 0) + 1);
};
global.getActiveUsers = function (groupJid, limit = 15) {
  const group = global.activeUserStore.get(groupJid);
  if (!group || group.size === 0) return [];
  return [...group.entries()]
    .map(([jid, count]) => ({ jid, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
};

// Anti-delete store
if (!global.deletedMessages) global.deletedMessages = new Map();

// AI DM session store
if (!global.gptDMSessions) global.gptDMSessions = new Map();

// ─── Express ─────────────────────────────────────
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/status', (_req, res) => {
  res.json({ bot: botname, status: connectionStatus, hasQR: !!qrCodeData });
});
app.get('/api/qr', (_req, res) => {
  if (!qrCodeData) return res.status(404).json({ error: 'No QR available.' });
  res.json({ qr: qrCodeData });
});
app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ─── Message helpers ─────────────────────────────
function smsg(sock, msg, store) {
  if (!msg) return msg;
  let m = { ...msg };
  m.msg = msg.message;
  const type = getContentType(msg.message);
  m.mtype  = type;
  m.key    = msg.key;
  m.fromMe = msg.key.fromMe;
  m.sender = jidNormalizedUser(msg.key.remoteJid || '');
  m.isGroup = m.sender.endsWith('@g.us');
  m.chat   = m.sender; // alias
  m.body   = (type === 'conversation' && msg.message.conversation)
           || (type === 'extendedTextMessage' && msg.message.extendedTextMessage?.text)
           || (type === 'imageMessage' && msg.message.imageMessage?.caption)
           || (type === 'videoMessage' && msg.message.videoMessage?.caption)
           || (type === 'buttonsResponseMessage' && msg.message.buttonsResponseMessage?.selectedButtonId)
           || (type === 'listResponseMessage' && msg.message.listResponseMessage?.singleSelectReply?.selectedRowId)
           || '';
  m.text = m.body;
  m.pushName = msg.pushName || 'Unknown';

  m.quoted = null;
  if (msg.message.extendedTextMessage?.contextInfo) {
    const ctx = msg.message.extendedTextMessage.contextInfo;
    m.quoted = {
      sender:  jidNormalizedUser(ctx.participant || ''),
      text:    ctx.text || '',
      key:     ctx.stanzaId ? { remoteJid: m.sender, id: ctx.stanzaId, fromMe: ctx.participant === sock.user?.id } : null,
    };
  }
  m.mentionedJid = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.map(j => jidNormalizedUser(j)) || [];
  m.mentions = m.mentionedJid;

  m.reply = (text, opts = {}) => sock.sendMessage(m.chat, { text }, { quoted: msg, ...opts });
  m.send  = (jid, content, opts = {}) => sock.sendMessage(jid, content, { quoted: msg, ...opts });

  return m;
}

function isOwner(jid) {
  if (!jid) return false;
  const normalized = jid.replace(/[^0-9]/g, '');
  return owner.includes(jid) || dev.some(d => normalized.endsWith(d));
}

async function getGroupAdmins(sock, groupId) {
  try {
    const meta = await sock.groupMetadata(groupId);
    return meta.participants.filter(p => p.admin).map(p => jidNormalizedUser(p.id));
  } catch { return []; }
}

async function isBotAdmin(sock, groupId) {
  if (!sock.user) return false;
  const admins = await getGroupAdmins(sock, groupId);
  return admins.includes(jidNormalizedUser(sock.user.id));
}

async function isUserAdmin(sock, groupId, userJid) {
  const admins = await getGroupAdmins(sock, groupId);
  return admins.includes(jidNormalizedUser(userJid));
}

// ─── Main connection ─────────────────────────────
async function startGhost() {
  const plugins = loadPlugins();
  console.log(color(`Loaded ${plugins.length} plugin(s)`, 'cyan'));

  const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, 'session'));
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`WhatsApp Web v${version.join('.')}, latest: ${isLatest}`);

  console.log(color(figlet.textSync('GHOST-MD', {
    font: 'Standard', horizontalLayout: 'default', verticalLayout: 'default', whitespaceBreak: false,
  }), 'green'));

  client = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    browser: ['GHOST-MD', 'Chrome', '120.0'],
    auth: state,
    syncFullHistory: false,
  });

  // ─── Connection events ─────────────────────────
  client.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      connectionStatus = 'qr';
      console.log(color('QR code received — scan with WhatsApp to pair', 'yellow'));
      qrcodeTerminal.generate(qr, { small: true }, (termQR) => console.log(termQR));
      try { qrCodeData = await QRCode.toDataURL(qr, { width: 400, margin: 2 }); } catch {}
    }

    if (connection === 'close') {
      qrCodeData = null;
      const reason = new Boom(lastDisconnect?.error)?.output.statusCode;
      console.log(color(`Disconnected (code ${reason})`, 'red'));
      if (reason === DisconnectReason.badSession || reason === DisconnectReason.loggedOut) {
        console.log('Session invalid. Delete /session and restart.');
        connectionStatus = 'disconnected';
        process.exit(1);
      }
      console.log(color('Reconnecting...', 'yellow'));
      connectionStatus = 'connecting';
      setTimeout(startGhost, 5000);
    }

    if (connection === 'open') {
      qrCodeData = null;
      connectionStatus = 'connected';
      console.log(color(`Connected as ${client.user.name || client.user.id}`, 'green'));
      console.log(color(`Prefix: ${prefix} | Mode: ${mode}`, 'cyan'));
      await client.sendMessage(client.user.id, {
        text: `*GHOST-MD v2.0 is online*\n\nPrefix: ${prefix}\nMode: ${mode}\nType "${prefix}menu" for commands.`,
      });
    }
  });

  client.ev.on('creds.update', saveCreds);

  // ─── Status events (auto-view, auto-like) ──────
  client.ev.on('messages.upsert', async (chatUpdate) => {
    try {
      if (!chatUpdate.messages?.[0]) return;
      let mek = chatUpdate.messages[0];
      if (!mek.message) return;

      // Unwrap ephemeral
      const ctype = getContentType(mek.message);
      if (ctype === 'ephemeralMessage') mek.message = mek.message.ephemeralMessage.message;

      const isStatus = mek.key.remoteJid === 'status@broadcast';

      // ── Auto-view & Auto-like for status ───
      if (isStatus) {
        const participant = mek.key.participant || mek.key.participantPn || '';
        if (!participant) return;

        const botJid = jidNormalizedUser(client.user.id);
        const baseKey = {
          remoteJid: mek.key.remoteJid,
          id: mek.key.id,
          fromMe: mek.key.fromMe,
          participant,
        };

        if (autoview === 'on') {
          try { await client.readMessages([baseKey]); } catch {}
        }

        if (autolike === 'on') {
          const emojis = ['🖤', '👁️', '⚡', '🔥', '✅', '💀', '👑', '🌀', '💎', '🤍'];
          const emoji = emojis[Math.floor(Math.random() * emojis.length)];
          try {
            await client.sendMessage(mek.key.remoteJid, {
              react: { key: baseKey, text: emoji },
            }, { statusJidList: [participant, botJid] });
          } catch {}
        }
        return; // Don't process status as regular messages
      }

      // ── Anti-delete ──────────────────────
      if (antidelete === 'on') {
        await antiDeleteHandler(client, mek);
      }

      // ── Private mode ─────────────────────
      if (mode === 'private' && !mek.key.fromMe && !isOwner(mek.key.remoteJid)) return;

      const m = smsg(client, mek, null);

      // ── Track activity ───────────────────
      if (m.isGroup) global.trackMessage(m.chat, m.sender);

      // ── Auto-read ────────────────────────
      if (autoread === 'on') {
        try { await client.readMessages([m.key]); } catch {}
      }

      // ── Online presence ──────────────────
      try { await client.sendPresenceUpdate('available', m.chat); } catch {}

      // ── Anti-bot detection ───────────────
      if (antibot === 'on' && m.isGroup && mek.key.id.startsWith('BAE5') && mek.key.id.length === 16) {
        const bAdmin = await isBotAdmin(client, m.chat);
        const uAdmin = await isUserAdmin(client, m.chat, m.sender);
        if (bAdmin && !uAdmin) {
          try {
            await client.sendMessage(m.chat, {
              text: `@${m.sender.split('@')[0]} detected as a bot. Removed.`,
              contextInfo: { mentionedJid: [m.sender] },
            }, { quoted: mek });
            await client.groupParticipantsUpdate(m.chat, [m.sender], 'remove');
          } catch {}
          return;
        }
      }

      // ── Anti-tag (mass mentions) ─────────
      if (antitag === 'on' && m.isGroup && m.mentionedJid.length > 10) {
        const bAdmin = await isBotAdmin(client, m.chat);
        const uAdmin = await isUserAdmin(client, m.chat, m.sender);
        if (bAdmin && !uAdmin && !isOwner(m.sender)) {
          try {
            await client.sendMessage(m.chat, { delete: m.key });
            await client.groupParticipantsUpdate(m.chat, [m.sender], 'remove');
          } catch {}
          return;
        }
      }

      // ── Anti-link (full — WhatsApp links) ─
      if (antilink === 'on' && m.isGroup && m.body.match(/https?:\/\/(www\.)?chat\.whatsapp\.com\/\S+/gi)) {
        const bAdmin = await isBotAdmin(client, m.chat);
        const uAdmin = await isUserAdmin(client, m.chat, m.sender);
        if (bAdmin && !uAdmin && !isOwner(m.sender)) {
          try {
            await client.sendMessage(m.chat, { delete: m.key });
            await client.groupParticipantsUpdate(m.chat, [m.sender], 'remove');
            await client.sendMessage(m.chat, {
              text: `@${m.sender.split('@')[0]} Sending WhatsApp group links is prohibited.`,
              contextInfo: { mentionedJid: [m.sender] },
            });
          } catch {}
          return;
        }
      }

      // ── Bad word filter ──────────────────
      const containsBad = badwords.some(w => m.body.toLowerCase().includes(w));
      if (containsBad && !m.key.fromMe && !isOwner(m.sender) && m.isGroup) {
        const bAdmin = await isBotAdmin(client, m.chat);
        const uAdmin = await isUserAdmin(client, m.chat, m.sender);
        if (bAdmin && !uAdmin) {
          await client.sendMessage(m.chat, {
            text: `@${m.sender.split('@')[0]} Watch your language.`,
            contextInfo: { mentionedJid: [m.sender] },
          }, { quoted: mek });
        }
        return;
      }

      // ── Console logging ──────────────────
      if (m.body && m.body.startsWith(prefix)) {
        if (m.isGroup) {
          console.log(chalk.black(chalk.bgWhite('[ GHOST ]')), color(m.body, 'turquoise'),
            chalk.magenta('from'), chalk.green(m.pushName),
            chalk.yellow(`[${m.sender.replace('@s.whatsapp.net', '')}]`),
            chalk.blueBright('IN'), chalk.green('Group'));
        } else {
          console.log(chalk.black(chalk.bgWhite('[ GHOST ]')), color(m.body, 'turquoise'),
            chalk.magenta('from'), chalk.green(m.pushName),
            chalk.yellow(`[${m.sender.replace('@s.whatsapp.net', '')}]`));
        }
      }

      // ── Command matching ─────────────────
      if (!m.body || !m.body.startsWith(prefix)) {
        // ── GPT DM — AI auto-reply in private ──
        const gptdm = process.env.GPTDM || 'off';
        if (gptdm === 'on' && !m.isGroup && !m.key.fromMe && m.body && m.body.trim()) {
          await handleAIDM(client, m);
        }
        return;
      }

      const args    = m.body.slice(prefix.length).trim().split(/\s+/);
      const cmd     = args.shift().toLowerCase();
      const cmdText = m.body.slice(prefix.length).trim();

      await runCommand({ cmd, args, cmdText, client, m, plugins, isOwner: isOwner(m.sender) });
    } catch (err) {
      console.error('Message handler error:', err);
    }
  });

  // ─── Group events (welcome/leave) ────────────
  client.ev.on('group-participants.update', async (update) => {
    await handleGroupEvent(client, update);
  });

  // ─── Call handler (anticall) ─────────────────
  client.ev.on('call', async (calls) => {
    if (anticall !== 'on') return;
    let lastTextTime = 0;
    for (const call of calls) {
      if (call.isGroup) continue;
      try {
        await client.rejectCall(call.id, call.from);
        const now = Date.now();
        if (now - lastTextTime >= 5000) {
          await client.sendMessage(call.from, {
            text: 'Anticall is active. Text only.',
          });
          lastTextTime = now;
        }
      } catch {}
    }
  });

  // ─── Auto-bio interval ───────────────────────
  setInterval(async () => {
    if (autobio !== 'on' || !client?.user) return;
    try {
      const date = new Date();
      const tz = process.env.TZ || 'Africa/Nairobi';
      const timeStr = date.toLocaleString('en-US', { timeZone: tz });
      const day = date.toLocaleString('en-US', { weekday: 'long', timeZone: tz });
      await client.updateProfileStatus(`${timeStr} | ${day}`);
    } catch {}
  }, 10000);

  // ─── Utility methods ─────────────────────────
  client.public = mode === 'public';
  client.prefix = prefix;
  client.botname = botname;

  client.downloadMediaMessage = async (msg) => {
    const messageType = msg.mtype ? msg.mtype.replace(/Message/gi, '') : '';
    const stream = await downloadContentFromMessage(msg, messageType);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
    return buffer;
  };

  client.sendContact = async (jid, numbers, quoted = '', options = {}) => {
    const contacts = numbers.map(number => ({
      displayName: botname,
      vcard: [
        'BEGIN:VCARD', 'VERSION:3.0', `FN:${botname}`, 'N:;BOT;;;',
        `TEL;waid=${number}:${number}`, 'item1.X-ABLabel:Number',
        'END:VCARD',
      ].join('\n'),
    }));
    await client.sendMessage(jid, { contacts: { displayName: botname, contacts }, ...options }, { quoted });
  };

  client.getGroupAdmins = getGroupAdmins;
  client.isBotAdmin = isBotAdmin;
  client.isUserAdmin = isUserAdmin;

  // Setup anti-delete listener
  setupAntiDelete(client);
}

// ─── AI DM Handler ──────────────────────────────
async function handleAIDM(client, m) {
  try {
    const userJid = m.sender;
    if (!global.gptDMSessions.has(userJid)) global.gptDMSessions.set(userJid, []);
    const history = global.gptDMSessions.get(userJid);

    let prompt = '';
    if (history.length) {
      const ctx = history.map(h => `${h.role === 'user' ? 'User' : 'Ghost'}: ${h.content}`).join('\n');
      prompt += `Previous conversation:\n${ctx}\n\n`;
    }

    prompt += `You are GHOST-MD, a witty and sarcastic but helpful WhatsApp assistant. ` +
      `Read the user's mood — if sad be comforting, if happy match energy, if angry stay calm. ` +
      `Reply naturally like a friend. Keep it short. Use emojis where natural. ` +
      `Always reply in the same language the user uses. Never say you are ChatGPT or any AI.\n\n` +
      `User: ${m.body.trim()}`;

    await client.sendPresenceUpdate('composing', m.chat);

    const apis = [
      `https://api.bk9.dev/ai/llama?q=${encodeURIComponent(prompt)}`,
    ];

    let replyText = '';
    for (const url of apis) {
      try {
        const r = await fetch(url, { timeout: 10000 });
        const d = await r.json();
        replyText = d?.BK9 || d?.reply || d?.result || d?.response || d?.message || d?.answer || '';
        if (replyText.trim()) break;
      } catch { continue; }
    }

    if (!replyText.trim()) return;

    history.push({ role: 'user', content: m.body.trim() });
    history.push({ role: 'assistant', content: replyText.trim() });
    if (history.length > 20) history.splice(0, 2);

    await client.sendPresenceUpdate('paused', m.chat);
    await client.sendMessage(m.chat, { text: replyText.trim() }, { quoted: m.key });
  } catch (err) {
    try { await client.sendPresenceUpdate('paused', m.chat); } catch {}
  }
}

// ─── Start ───────────────────────────────────────
app.listen(port, () => {
  console.log(color(`Web server running on port ${port}`, 'cyan'));
  console.log(color(`Visit the URL above to scan QR and pair Ghost`, 'yellow'));
});

startGhost();

process.on('unhandledRejection', (reason) => console.log('Unhandled Rejection:', reason));
process.on('uncaughtException',  (err)    => console.log('Uncaught Exception:', err));
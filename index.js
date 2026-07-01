// ═══════════════════════════════════════════════════════════════
//  GHOST-MD  v1.0
//  "The machine that dreams in binary."
//
//  A Baileys-based WhatsApp bot that pairs via OnRender QR.
//  Deploy, visit the URL, scan the QR, and Ghost is alive.
// ═══════════════════════════════════════════════════════════════

require('dotenv').config({ path: './.env' });
const path            = require('path');
const fs              = require('fs');
const express         = require('express');
const chalk           = require('chalk');
const figlet          = require('figlet');
const QRCode          = require('qrcode');
const qrcodeTerminal  = require('qrcode-terminal');
const pino            = require('pino');

const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  downloadContentFromMessage,
  jidNormalizedUser,
  getContentType,
  DisconnectReason,
} = require('@whiskeysockets/baileys');

const { Boom }       = require('@hapi/boom');
const { botname, prefix, owner, dev, mode, port, anticall, autoread, antilink, badwords } = require('./set.js');
const { loadPlugins, runCommand } = require('./plugins/loader');
const color = (text, c) => !c ? chalk.green(text) : chalk.keyword(c)(text);

// ─── State ───────────────────────────────────────
let qrCodeData = null;        // latest QR string (base64 PNG for web)
let connectionStatus = 'connecting'; // connecting | qr | connected | disconnected
let client = null;

// ─── Express (for QR pairing page) ───────────────
const app = express();
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/status', (_req, res) => {
  res.json({
    bot:    botname,
    status: connectionStatus,
    hasQR:  !!qrCodeData,
  });
});

app.get('/api/qr', (_req, res) => {
  if (!qrCodeData) {
    return res.status(404).json({ error: 'No QR available. Bot may already be paired or not started yet.' });
  }
  res.json({ qr: qrCodeData });
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

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
  m.body   = (type === 'conversation' && msg.message.conversation)
           || (type === 'extendedTextMessage' && msg.message.extendedTextMessage?.text)
           || (type === 'imageMessage' && msg.message.imageMessage?.caption)
           || (type === 'videoMessage' && msg.message.videoMessage?.caption)
           || '';

  m.quoted = null;
  if (msg.message.extendedTextMessage?.contextInfo) {
    const ctx = msg.message.extendedTextMessage.contextInfo;
    m.quoted = {
      sender:  jidNormalizedUser(ctx.participant || ''),
      text:    ctx.text || '',
      key:     ctx.stanzaId ? { remoteJid: m.sender, id: ctx.stanzaId, fromMe: ctx.participant === sock.user?.id } : null,
    };
  }

  m.mentions = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.map(j => jidNormalizedUser(j)) || [];

  m.reply = (text, opts = {}) => sock.sendMessage(m.sender, { text }, { quoted: msg, ...opts });
  m.send  = (jid, content, opts = {}) => sock.sendMessage(jid, content, { quoted: msg, ...opts });

  return m;
}

function isOwner(jid) {
  const normalized = jid.replace(/[^0-9]/g, '');
  return owner.includes(jid) || dev.some(d => normalized.endsWith(d));
}

// ─── Main connection ─────────────────────────────
async function startGhost() {
  // Load plugins
  const plugins = loadPlugins();
  console.log(color(`Loaded ${plugins.length} plugin(s)`, 'cyan'));

  const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, 'session'));
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`WhatsApp Web v${version.join('.')}, latest: ${isLatest}`);

  // Banner
  console.log(color(figlet.textSync('GHOST-MD', {
    font: 'Standard', horizontalLayout: 'default', verticalLayout: 'default', whitespaceBreak: false,
  }), 'green'));

  client = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,   // we handle QR ourselves
    browser: ['GHOST-MD', 'Chrome', '120.0'],
    auth: state,
    syncFullHistory: false,
  });

  // ─── Connection events ─────────────────────────
  client.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    // QR received — generate PNG for web display
    if (qr) {
      connectionStatus = 'qr';
      console.log(color('QR code received — scan with WhatsApp to pair', 'yellow'));

      // Terminal QR
      qrcodeTerminal.generate(qr, { small: true }, (termQR) => {
        console.log(termQR);
      });

      // Web QR (base64 PNG)
      try {
        qrCodeData = await QRCode.toDataURL(qr, { width: 400, margin: 2 });
      } catch (e) {
        console.error('QR generation failed:', e.message);
      }
    }

    if (connection === 'close') {
      qrCodeData = null;
      const reason = new Boom(lastDisconnect?.error)?.output.statusCode;
      console.log(color(`Disconnected (code ${reason})`, 'red'));

      if (reason === DisconnectReason.badSession) {
        console.log('Bad session. Delete /session folder and restart.');
        connectionStatus = 'disconnected';
        process.exit(1);
      } else if (reason === DisconnectReason.loggedOut) {
        console.log('Logged out. Delete /session folder and restart.');
        connectionStatus = 'disconnected';
        process.exit(1);
      } else {
        // Reconnect
        console.log(color('Reconnecting...', 'yellow'));
        connectionStatus = 'connecting';
        setTimeout(startGhost, 5000);
      }
    }

    if (connection === 'open') {
      qrCodeData = null;
      connectionStatus = 'connected';
      const me = client.user;
      console.log(color(`Connected as ${me.name || me.id}`, 'green'));
      console.log(color(`Prefix: ${prefix} | Mode: ${mode}`, 'cyan'));

      // Welcome message to self
      await client.sendMessage(client.user.id, {
        text: `*GHOST-MD is online*\n\nPrefix: ${prefix}\nMode: ${mode}\nType "${prefix}menu" for commands.`,
      });
    }
  });

  client.ev.on('creds.update', saveCreds);

  // ─── Message handler ───────────────────────────
  client.ev.on('messages.upsert', async (chatUpdate) => {
    try {
      if (!chatUpdate.messages?.[0]) return;
      let mek = chatUpdate.messages[0];
      if (!mek.message) return;

      // Unwrap ephemeral
      mek.message = getContentType(mek.message) === 'ephemeralMessage'
        ? mek.message.ephemeralMessage.message
        : mek.message;

      // Skip status broadcasts
      if (mek.key.remoteJid === 'status@broadcast') return;

      // Private mode: ignore non-owners
      if (mode === 'private' && !mek.key.fromMe && !isOwner(mek.key.remoteJid)) return;

      const m = smsg(client, mek, null);

      // Auto-read
      if (autoread === 'on') {
        await client.readMessages([{ remoteJid: m.sender, id: m.key.id }]);
      }

      // Anti-link (group only)
      if (antilink === 'on' && m.isGroup && m.body.match(/https?:\/\/(www\.)?chat\.whatsapp\.com\/\S+/gi)) {
        // Basic antilink — delete and warn
        try {
          await client.sendMessage(m.sender, { text: 'Links are not allowed in this group.' });
        } catch (_) {}
      }

      // Antilink group-only logic would need group metadata — kept simple here

      // Bad word filter
      const containsBad = badwords.some(w => m.body.toLowerCase().includes(w));
      if (containsBad && !m.key.fromMe) {
        return; // silently ignore messages with bad words
      }

      // Command matching
      if (!m.body || !m.body.startsWith(prefix)) return;
      const args    = m.body.slice(prefix.length).trim().split(/\s+/);
      const cmd     = args.shift().toLowerCase();
      const cmdText = m.body.slice(prefix.length).trim();

      await runCommand({ cmd, args, cmdText, client, m, plugins, isOwner: isOwner(m.sender) });

    } catch (err) {
      console.error('Message handler error:', err);
    }
  });

  // ─── Call handler (anticall) ───────────────────
  client.ev.on('call', async (calls) => {
    if (anticall !== 'on') return;
    for (const call of calls) {
      if (call.isGroup) continue;
      try {
        await client.rejectCall(call.id, call.from);
        await client.sendMessage(call.from, { text: 'Anticall is active. Text only.' });
      } catch (_) {}
    }
  });

  // ─── Contacts store ────────────────────────────
  client.ev.on('contacts.update', (updates) => {
    for (const c of updates) {
      // Basic contact tracking — extend with a proper store if needed
    }
  });

  // ─── Utility methods on client ─────────────────
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
}

// ─── Start ───────────────────────────────────────
app.listen(port, () => {
  console.log(color(`Web server running on port ${port}`, 'cyan'));
  console.log(color(`Visit the URL above to scan QR and pair Ghost`, 'yellow'));
});

startGhost();

// ─── Error handling ──────────────────────────────
process.on('unhandledRejection', (reason) => console.log('Unhandled Rejection:', reason));
process.on('uncaughtException',  (err)    => console.log('Uncaught Exception:', err));
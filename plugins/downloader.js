// ═══════════════════════════════════════════
//  GHOST — Media Downloader
//  YouTube, Instagram, TikTok
// ═══════════════════════════════════════════

const fetch = require('node-fetch');

async function downloadMedia(url) {
  const apis = [
    `https://api.bk9.dev/download/ytmp4?url=${encodeURIComponent(url)}`,
    `https://api.bk9.dev/download/ytmp3?url=${encodeURIComponent(url)}`,
  ];
  for (const api of apis) {
    try {
      const r = await fetch(api, { timeout: 15000 });
      const d = await r.json();
      if (d?.BK9?.download || d?.download || d?.url) {
        return d.BK9?.download || d.download || d.url;
      }
    } catch {}
  }
  // Fallback for Instagram/TikTok
  try {
    const r = await fetch(`https://api.bk9.dev/download/ig?url=${encodeURIComponent(url)}`, { timeout: 15000 });
    const d = await r.json();
    if (d?.BK9?.download || d?.download || d?.url) {
      return d.BK9?.download || d.download || d.url;
    }
  } catch {}
  return null;
}

module.exports = [
  {
    name: 'play',
    alias: ['song', 'yta'],
    desc: 'Download audio from YouTube URL',
    execute: async ({ client, m, args }) => {
      const url = args[0] || m.quoted?.text;
      if (!url) return m.reply('Provide a YouTube URL.\n\nUsage: .play <url>');
      if (!url.match(/youtu\.?be/i)) return m.reply('That doesn\'t look like a YouTube URL.');

      await m.reply('Downloading audio...');
      const mediaUrl = await downloadMedia(url);
      if (!mediaUrl) return m.reply('Failed to download. Try another URL.');

      await client.sendMessage(m.chat, {
        audio: { url: mediaUrl },
        mimetype: 'audio/mpeg',
      }, { quoted: m.key });
    },
  },
  {
    name: 'video',
    alias: ['ytv', 'ytmp4'],
    desc: 'Download video from YouTube URL',
    execute: async ({ client, m, args }) => {
      const url = args[0] || m.quoted?.text;
      if (!url) return m.reply('Provide a YouTube URL.\n\nUsage: .video <url>');
      if (!url.match(/youtu\.?be/i)) return m.reply('That doesn\'t look like a YouTube URL.');

      await m.reply('Downloading video...');
      const mediaUrl = await downloadMedia(url);
      if (!mediaUrl) return m.reply('Failed to download. Try another URL.');

      await client.sendMessage(m.chat, {
        video: { url: mediaUrl },
        caption: `Downloaded by ${client.botname} 🖤`,
      }, { quoted: m.key });
    },
  },
  {
    name: 'ig',
    alias: ['instagram', 'reel'],
    desc: 'Download Instagram post/reel',
    execute: async ({ client, m, args }) => {
      const url = args[0] || m.quoted?.text;
      if (!url) return m.reply('Provide an Instagram URL.\n\nUsage: .ig <url>');

      await m.reply('Fetching...');
      const mediaUrl = await downloadMedia(url);
      if (!mediaUrl) return m.reply('Failed to download. Make sure the post is public.');

      await client.sendMessage(m.chat, {
        video: { url: mediaUrl },
        caption: `Downloaded by ${client.botname} 🖤`,
      }, { quoted: m.key });
    },
  },
  {
    name: 'tiktok',
    alias: ['tt'],
    desc: 'Download TikTok video',
    execute: async ({ client, m, args }) => {
      const url = args[0] || m.quoted?.text;
      if (!url) return m.reply('Provide a TikTok URL.\n\nUsage: .tiktok <url>');

      await m.reply('Fetching...');
      try {
        const r = await fetch(`https://api.bk9.dev/download/tiktok?url=${encodeURIComponent(url)}`, { timeout: 15000 });
        const d = await r.json();
        const videoUrl = d?.BK9?.download || d?.download || d?.url;
        if (!videoUrl) return m.reply('Failed to download.');

        await client.sendMessage(m.chat, {
          video: { url: videoUrl },
          caption: `Downloaded by ${client.botname} 🖤`,
        }, { quoted: m.key });
      } catch {
        return m.reply('Failed to fetch TikTok video.');
      }
    },
  },
];
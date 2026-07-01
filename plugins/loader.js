// ═══════════════════════════════════════════
//  GHOST — Plugin Loader
//  Auto-discovers and loads all .js files in /plugins
// ═══════════════════════════════════════════

const fs   = require('fs');
const path = require('path');

function loadPlugins() {
  const dir = path.join(__dirname);
  const plugins = [];

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    return plugins;
  }

  for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.js') && f !== 'loader.js')) {
    try {
      const mod = require(path.join(dir, file));
      // Support single plugin or array of plugins
      const items = Array.isArray(mod) ? mod : [mod];
      for (const plugin of items) {
        if (plugin && plugin.name && typeof plugin.execute === 'function') {
          plugins.push(plugin);
          console.log(`  ↳ Plugin loaded: ${plugin.name}`);
        }
      }
    } catch (err) {
      console.error(`  ✗ Failed to load ${file}:`, err.message);
    }
  }

  return plugins;
}

async function runCommand({ cmd, args, cmdText, client, m, plugins, isOwner }) {
  // Search plugins
  for (const plugin of plugins) {
    const aliases = Array.isArray(plugin.alias) ? plugin.alias : [];
    if (plugin.name === cmd || aliases.includes(cmd)) {
      // Owner-only check
      if (plugin.owner && !isOwner && !m.key.fromMe) {
        return m.reply('This command is restricted to the owner.');
      }
      // Group-only check
      if (plugin.group && !m.isGroup) {
        return m.reply('This command is for groups only.');
      }
      try {
        await plugin.execute({ client, m, args, cmd, cmdText, isOwner });
      } catch (err) {
        console.error(`Plugin ${plugin.name} error:`, err);
        m.reply(`Command error: ${err.message}`);
      }
      return;
    }
  }

  // No command found
  m.reply(`Unknown command: *${cmd}*\nType *${client.prefix}menu* for available commands.`);
}

module.exports = { loadPlugins, runCommand };
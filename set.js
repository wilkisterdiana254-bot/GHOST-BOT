// ═══════════════════════════════════════════
//  GHOST — Configuration
//  "I don't have friends, I have clients."
// ═══════════════════════════════════════════

const botname    = process.env.BOTNAME    || 'GHOST-MD';
const prefix     = process.env.PREFIX     || '.';
const owner      = process.env.OWNER      || '';
const dev        = process.env.DEV        || '';
const mode       = process.env.MODE       || 'public';
const port       = process.env.PORT       || 10000;

// Features
const anticall   = process.env.ANTICALL   || 'off';
const autoread   = process.env.AUTOREAD   || 'off';
const antilink   = process.env.ANTILINK   || 'off';
const autobio    = process.env.AUTOBIO    || 'off';
const autolike   = process.env.AUTOLIKE   || 'off';
const autoview   = process.env.AUTOVIEW   || 'off';
const antidelete = process.env.ANTIDELETE || 'off';
const antibot    = process.env.ANTIBOT    || 'off';
const antitag    = process.env.ANTITAG    || 'off';

const badwords = (process.env.BAD_WORDS || 'fuck,shit,bitch').split(',').map(w => w.trim());

module.exports = {
  botname, prefix, owner, dev, mode, port,
  anticall, autoread, antilink, autobio, autolike, autoview,
  antidelete, antibot, antitag, badwords,
};
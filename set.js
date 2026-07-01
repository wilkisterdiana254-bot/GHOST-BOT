// ═══════════════════════════════════════════
//  GHOST — Configuration
//  "I don't have friends, I have clients."
// ═══════════════════════════════════════════

const botname  = process.env.BOTNAME  || 'GHOST-MD';
const prefix   = process.env.PREFIX   || '.';
const owner    = process.env.OWNER    || '';          // comma-separated WhatsApp JIDs
const dev      = process.env.DEV      || '';          // comma-separated numbers
const mode     = process.env.MODE     || 'public';    // public | private
const port     = process.env.PORT     || 10000;
const anticall = process.env.ANTICALL || 'off';
const autoread = process.env.AUTOREAD || 'off';
const antilink = process.env.ANTILINK || 'off';
const badwords = (process.env.BAD_WORDS || 'fuck,shit,bitch').split(',').map(w => w.trim());

module.exports = {
  botname,
  prefix,
  owner: owner ? owner.split(',') : [],
  dev:   dev   ? dev.split(',')   : [],
  mode,
  port,
  anticall,
  autoread,
  antilink,
  badwords,
};
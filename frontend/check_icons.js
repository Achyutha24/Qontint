const l = require('./node_modules/lucide-react');
const keys = Object.keys(l).filter(k => {
  const lk = k.toLowerCase();
  return lk.includes('you') || lk.includes('git') || lk.includes('graph') || lk.includes('credit') || lk.includes('video') || lk.includes('play') || lk.includes('film') || lk.includes('monitor');
});
console.log(keys.join(', '));

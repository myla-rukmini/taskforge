const fs = require('fs');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../data');
if (!fs.existsSync(dbPath)) fs.mkdirSync(dbPath, { recursive: true });

const dbFile = (name) => path.join(dbPath, `${name}.json`);

const readAll = (name) => {
  const f = dbFile(name);
  if (!fs.existsSync(f)) return [];
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return []; }
};

const writeAll = (name, data) => {
  fs.writeFileSync(dbFile(name), JSON.stringify(data, null, 2));
};

const genId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const makeStore = (name) => ({
  findOne: (query) => {
    const all = readAll(name);
    return Promise.resolve(all.find(doc => match(doc, query)) || null);
  },
  find: (query) => {
    const all = readAll(name);
    return Promise.resolve(all.filter(doc => match(doc, query)));
  },
  insert: (doc) => {
    const all = readAll(name);
    const newDoc = { ...doc, _id: genId() };
    all.push(newDoc);
    writeAll(name, all);
    return Promise.resolve(newDoc);
  },
  update: (query, update) => {
    let all = readAll(name);
    let count = 0;
    all = all.map(doc => {
      if (match(doc, query)) {
        count++;
        const set = update.$set || update;
        return { ...doc, ...set };
      }
      return doc;
    });
    writeAll(name, all);
    return Promise.resolve(count);
  },
  remove: (query, opts) => {
    let all = readAll(name);
    const multi = opts && opts.multi;
    let removed = 0;
    const next = [];
    for (const doc of all) {
      if (match(doc, query) && (multi || removed === 0)) {
        removed++;
      } else {
        next.push(doc);
      }
    }
    writeAll(name, next);
    return Promise.resolve(removed);
  },
  count: (query) => {
    const all = readAll(name);
    return Promise.resolve(all.filter(doc => match(doc, query)).length);
  },
});

function match(doc, query) {
  for (const key of Object.keys(query)) {
    const qVal = query[key];
    if (qVal && typeof qVal === 'object' && !Array.isArray(qVal)) {
      // Handle operators
      if ('$in' in qVal) {
        if (!qVal.$in.includes(doc[key])) return false;
      } else if ('$ne' in qVal) {
        if (doc[key] === qVal.$ne) return false;
      } else if ('$lt' in qVal) {
        if (!(doc[key] < qVal.$lt)) return false;
      } else if ('$exists' in qVal) {
        if (qVal.$exists && !(key in doc)) return false;
      } else {
        if (doc[key] !== qVal) return false;
      }
    } else {
      if (doc[key] !== qVal) return false;
    }
  }
  return true;
}

module.exports = {
  users:    makeStore('users'),
  projects: makeStore('projects'),
  tasks:    makeStore('tasks'),
  members:  makeStore('members'),
};
const fs = require('fs');
const path = require('path');
const config = require('../config.json');

let bot = null;
const savedPositions = new Map();
const opList = new Set();

let persistentPassword = config.persistentPassword || null;
let tempPassword = null;
let tempPasswordExpiry = 0;
const tempAuth = new Map();

// 历史玩家（所有曾加入过的玩家）
const knownPlayers = new Set();

const DATA_FILE = path.join(__dirname, '..', 'data.json');
const PLAYERS_FILE = path.join(__dirname, '..', 'players.json');

function saveState() {
  const data = {
    opList: Array.from(opList),
    tempPassword,
    tempPasswordExpiry,
    tempAuth: Array.from(tempAuth.entries())
  };
  try { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); } catch(e) {}
}

function loadState() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const data = JSON.parse(raw);
      if (data.opList) data.opList.forEach(u => opList.add(u));
      tempPassword = data.tempPassword || null;
      tempPasswordExpiry = data.tempPasswordExpiry || 0;
      if (data.tempAuth) {
        for (const [key, value] of data.tempAuth) {
          tempAuth.set(key, value);
        }
      }
    }
  } catch(e) {}
}

// 历史玩家持久化
function saveKnownPlayers() {
  try {
    fs.writeFileSync(PLAYERS_FILE, JSON.stringify(Array.from(knownPlayers), null, 2));
  } catch(e) {}
}

function loadKnownPlayers() {
  try {
    if (fs.existsSync(PLAYERS_FILE)) {
      const raw = fs.readFileSync(PLAYERS_FILE, 'utf8');
      const list = JSON.parse(raw);
      if (Array.isArray(list)) list.forEach(name => knownPlayers.add(name));
    }
  } catch(e) {}
}

function addKnownPlayer(name) {
  if (knownPlayers.has(name)) return;
  knownPlayers.add(name);
  saveKnownPlayers();
}

function setBot(instance) { bot = instance; }
function getBot() { return bot; }

function setPersistentPassword(pw) {
  persistentPassword = pw;
  try {
    const configPath = path.join(__dirname, '..', 'config.json');
    const currentConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    currentConfig.persistentPassword = pw;
    fs.writeFileSync(configPath, JSON.stringify(currentConfig, null, 2), 'utf8');
  } catch(e) {}
}

function checkPersistentPassword(pw) {
  return persistentPassword && pw === persistentPassword;
}

function setTempPassword(pw, minutes) {
  tempPassword = pw;
  tempPasswordExpiry = Date.now() + minutes * 60000;
  saveState();
}

function checkTempPassword(pw) {
  if (!tempPassword || Date.now() > tempPasswordExpiry) {
    tempPassword = null;
    return false;
  }
  return pw === tempPassword;
}

function addTempAuth(username, minutes) {
  tempAuth.set(username, Date.now() + minutes * 60000);
  saveState();
}

function hasTempAuth(username) {
  const expiry = tempAuth.get(username);
  if (!expiry) return false;
  if (Date.now() > expiry) {
    tempAuth.delete(username);
    saveState();
    return false;
  }
  return true;
}

function removeTempAuth(username) {
  tempAuth.delete(username);
  saveState();
}

function getTempAuthExpiry(username) {
  return tempAuth.get(username) || 0;
}

module.exports = {
  setBot, getBot, savedPositions, opList,
  setPersistentPassword, checkPersistentPassword,
  setTempPassword, checkTempPassword,
  addTempAuth, hasTempAuth, removeTempAuth, getTempAuthExpiry,
  tempAuth,
  saveState, loadState,
  knownPlayers, addKnownPlayer, loadKnownPlayers
};
'use strict';

// Tiny JSON file store for config.json (tracked teams etc.).
// In-memory cache with write-through; fine for a single local process.

const fs = require('node:fs');
const path = require('node:path');

const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

let config = null;

function read() {
  if (config) return config;
  config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  config.trackers ||= [];
  return config;
}

function write() {
  // atomic-ish: write temp then rename
  const tmp = CONFIG_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(config, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, CONFIG_PATH);
}

function getTrackers() {
  return read().trackers;
}

function addTracker(tracker) {
  const cfg = read();
  const id = tracker.id || `${tracker.type}-${Date.now()}`;
  const item = { id, ...tracker };
  cfg.trackers.push(item);
  write();
  return item;
}

function removeTracker(id) {
  const cfg = read();
  const before = cfg.trackers.length;
  cfg.trackers = cfg.trackers.filter((t) => t.id !== id);
  if (cfg.trackers.length !== before) write();
  return cfg.trackers.length !== before;
}

function getF1Year() {
  return read().f1Year;
}

module.exports = { getTrackers, addTracker, removeTracker, getF1Year };

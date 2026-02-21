import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { log } from '../utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_DIR = join(__dirname, '..', '..', 'data');
const STATE_FILE = join(STATE_DIR, 'state.json');

function replacer(key, value) {
  if (typeof value === 'bigint') return { __bigint: value.toString() };
  return value;
}

function reviver(key, value) {
  if (value && value.__bigint) return BigInt(value.__bigint);
  return value;
}

export function loadState() {
  try {
    if (!existsSync(STATE_FILE)) {
      log.info('No previous state found, starting fresh.');
      return {};
    }
    return JSON.parse(readFileSync(STATE_FILE, 'utf-8'), reviver);
  } catch (error) {
    log.error('Failed to load state:', error.message);
    return {};
  }
}

export function saveState(data) {
  try {
    if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true });
    writeFileSync(STATE_FILE, JSON.stringify(data, replacer, 2), 'utf-8');
    log.debug('State saved.');
  } catch (error) {
    log.error('Failed to save state:', error.message);
  }
}

import fs from "node:fs";
import path from "node:path";

const DATA_FILE = "events.json";

export function createStorage(dataDir) {
  const filePath = path.join(dataDir, DATA_FILE);

  function ensureDir() {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  function readData() {
    ensureDir();
    if (!fs.existsSync(filePath)) {
      return [];
    }
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  }

  function writeData(events) {
    ensureDir();
    fs.writeFileSync(filePath, JSON.stringify(events, null, 2), "utf-8");
  }

  return {
    loadAll() {
      return readData();
    },

    save(event) {
      const events = readData();
      events.push(event);
      writeData(events);
    },

    remove(eventId) {
      const events = readData();
      const idx = events.findIndex((e) => e.id === eventId);
      if (idx === -1) return false;
      events.splice(idx, 1);
      writeData(events);
      return true;
    },

    update(eventId, updates) {
      const events = readData();
      const idx = events.findIndex((e) => e.id === eventId);
      if (idx === -1) return false;
      Object.assign(events[idx], updates);
      writeData(events);
      return events[idx];
    },

    findById(eventId) {
      const events = readData();
      return events.find((e) => e.id === eventId);
    },
  };
}

import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

function checkCovers() {
  const appData = process.env.APPDATA;
  const possiblePaths = [
    path.join(appData, "Resonance", "resonance.sqlite"),
    path.join(appData, "resonance", "resonance.sqlite"),
    path.join(appData, "Electron", "resonance.sqlite"),
  ];
  
  let dbPath = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      dbPath = p;
      break;
    }
  }
  
  if (!dbPath) {
    console.error("Could not find resonance.sqlite in APPDATA.");
    return;
  }
  
  const db = new Database(dbPath);
  const rows = db.prepare("SELECT title, cover_path FROM tracks LIMIT 10").all();
  console.log(JSON.stringify(rows, null, 2));
}

checkCovers();

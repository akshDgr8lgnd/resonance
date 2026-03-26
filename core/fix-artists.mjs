import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

function fixArtists() {
  const appData = process.env.APPDATA;
  if (!appData) {
    console.error("APPDATA not found");
    return;
  }
  
  // Potential locations for the DB depending on whether the app runs directly or from an electron folder
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
  
  console.log(`Found DB at ${dbPath}`);
  const db = new Database(dbPath);
  
  // Track artists
  const tracks = db.prepare("SELECT id, artists FROM tracks").all();
  let tracksUpdated = 0;
  
  const updateTrack = db.prepare("UPDATE tracks SET artists = ? WHERE id = ?");
  for (const track of tracks) {
    try {
      const arr = JSON.parse(track.artists);
      if (Array.isArray(arr) && arr.length > 0) {
        let changed = false;
        const newArr = [];
        for (const a of arr) {
          if (a.includes("&") || a.includes(",")) {
            changed = true;
            const split = a.split(/,\s*|\s+&\s+|\s+feat\.?\s+|\s+ft\.?\s+/i).map(s => s.trim()).filter(Boolean);
            newArr.push(...split);
          } else {
            newArr.push(a);
          }
        }
        
        if (changed) {
          updateTrack.run(JSON.stringify(newArr), track.id);
          tracksUpdated++;
        }
      }
    } catch (e) {
      console.error(`Error parsing track ${track.id} artists: ${e.message}`);
    }
  }
  
  // Jobs
  const jobs = db.prepare("SELECT id, artists FROM download_jobs").all();
  let jobsUpdated = 0;
  
  const updateJob = db.prepare("UPDATE download_jobs SET artists = ? WHERE id = ?");
  for (const job of jobs) {
    try {
      const arr = JSON.parse(job.artists);
      if (Array.isArray(arr) && arr.length > 0) {
        let changed = false;
        const newArr = [];
        for (const a of arr) {
          if (a.includes("&") || a.includes(",")) {
            changed = true;
            const split = a.split(/,\s*|\s+&\s+|\s+feat\.?\s+|\s+ft\.?\s+/i).map(s => s.trim()).filter(Boolean);
            newArr.push(...split);
          } else {
            newArr.push(a);
          }
        }
        
        if (changed) {
          updateJob.run(JSON.stringify(newArr), job.id);
          jobsUpdated++;
        }
      }
    } catch (e) {
      // ignore
    }
  }
  
  console.log(`Fixed ${tracksUpdated} tracks and ${jobsUpdated} jobs.`);
}

fixArtists();

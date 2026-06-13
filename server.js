// server.js — minimal backend for the notes app
// Run: npm install express cors  &&  node server.js
// Serves the API the frontend (notes.html) expects:
//   PATCH  /api/notes/:id      body: { isDeleted: true|false }  -> returns updated note
//   DELETE /api/notes/trash                                     -> purges all deleted notes

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const DB_FILE = path.join(__dirname, "notes.json");
const FOLDERS = ["Personal", "Work", "Ideas", "Journal"];
const DEFAULT_NOTES = [
  { id: 1, title: "Meeting Agenda", body: "Discuss Q3 roadmap\nReview open PRs\nPlan sprint goals", folder: "Work", pinned: true, created: "2026-06-01", deleted: false },
  { id: 2, title: "Book List", body: "The Dispossessed\nKlara and the Sun\nPiranesi\nLeGuin's collected essays", folder: "Personal", pinned: false, created: "2026-05-28", deleted: false },
  { id: 3, title: "App Ideas", body: "Spatial audio journaling\nCollaborative recipe builder\nReverse calendar planner", folder: "Ideas", pinned: true, created: "2026-05-20", deleted: false },
  { id: 4, title: "Today's Reflection", body: "Slow morning. Coffee on the balcony. Wind from the east. Noticed how the light catches the dust on the shelves—maybe that's a metaphor.", folder: "Journal", pinned: false, created: "2026-06-07", deleted: false },
  { id: 5, title: "Old Draft", body: "This needs revision...", folder: "Work", pinned: false, created: "2026-04-10", deleted: true },
  { id: 6, title: "Grocery run", body: "Oat milk, sourdough, tahini, lemons", folder: "Personal", pinned: false, created: "2026-05-30", deleted: true },
];

function loadNotesFromFile() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_NOTES, null, 2), "utf8");
    }
    return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  } catch (err) {
    console.error("Failed to load notes file:", err);
    return [...DEFAULT_NOTES];
  }
}

function saveNotesToFile(notes) {
  fs.writeFileSync(DB_FILE, JSON.stringify(notes, null, 2), "utf8");
}

let notes = loadNotesFromFile();
let nextId = notes.reduce((max, note) => Math.max(max, note.id), 0) + 1;

// ── Routes ──────────────────────────────────────────────────────────────────

const NOTE_ROUTES = ["/api/notes", "/notes"];
const NOTE_ROUTE_ID = ["/api/notes/:id", "/notes/:id"];
const NOTE_TRASH_ROUTES = ["/api/notes/trash", "/notes/trash"];

// GET /api/notes or /notes — fetch all notes
app.get(NOTE_ROUTES, (req, res) => {
  const ordered = [...notes].sort((a, b) => {
    if (a.deleted !== b.deleted) return a.deleted - b.deleted;
    if (a.pinned !== b.pinned) return b.pinned - a.pinned;
    return b.created.localeCompare(a.created);
  });
  res.json(ordered);
});

// POST /api/notes or /notes — create a new note
app.post(NOTE_ROUTES, (req, res) => {
  const { title, body, folder, pinned } = req.body || {};
  const note = {
    id: nextId++,
    title: title || "Untitled",
    body: body || "",
    folder: FOLDERS.includes(folder) ? folder : "Personal",
    pinned: !!pinned,
    created: new Date().toISOString().slice(0, 10),
    deleted: false,
  };
  notes.unshift(note);
  saveNotesToFile(notes);
  res.status(201).json(note);
});

// PATCH /api/notes/:id or /notes/:id — partial update (title, body, folder, pinned, isDeleted)
app.patch(NOTE_ROUTE_ID, (req, res) => {
  const id = Number(req.params.id);
  const noteIndex = notes.findIndex(n => n.id === id);
  if (noteIndex === -1) {
    return res.status(404).json({ error: `Note ${id} not found` });
  }

  const note = notes[noteIndex];
  const { title, body, folder, pinned, isDeleted } = req.body || {};
  notes[noteIndex] = {
    ...note,
    title: title !== undefined ? title : note.title,
    body: body !== undefined ? body : note.body,
    folder: folder !== undefined ? (FOLDERS.includes(folder) ? folder : note.folder) : note.folder,
    pinned: pinned !== undefined ? !!pinned : note.pinned,
    deleted: isDeleted !== undefined ? !!isDeleted : note.deleted,
  };

  saveNotesToFile(notes);
  res.json(notes[noteIndex]);
});

// DELETE /api/notes/trash or /notes/trash — purge all notes marked deleted
app.delete(NOTE_TRASH_ROUTES, (req, res) => {
  const before = notes.length;
  notes = notes.filter(n => !n.deleted);
  saveNotesToFile(notes);
  res.json({ deleted: before - notes.length });
});

// DELETE /api/notes/:id or /notes/:id — hard-delete a single note directly (optional helper)
app.delete(NOTE_ROUTE_ID, (req, res) => {
  const id = Number(req.params.id);
  const before = notes.length;
  notes = notes.filter(n => n.id !== id);
  if (notes.length === before) {
    return res.status(404).json({ error: `Note ${id} not found` });
  }
  saveNotesToFile(notes);
  res.status(204).end();
});

// ── Start ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Notes API running at http://localhost:${PORT}`);
});

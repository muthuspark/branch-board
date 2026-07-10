import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

const INVALID_BOARD_STATE = "Invalid board state.";

export function createEmptyBoardState() {
  return {
    cam: { x: 0, y: 0, scale: 1 },
    nodes: [],
    edges: [],
    uid: 0,
    messageUid: 0
  };
}

export function createBoardStore({ dbFile }) {
  mkdirSync(path.dirname(dbFile), { recursive: true });
  const db = new Database(dbFile);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS boards (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      state_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  const listBoardsStatement = db.prepare(`
    SELECT id, title, created_at, updated_at
    FROM boards
    ORDER BY updated_at DESC
  `);
  const getBoardStatement = db.prepare(`
    SELECT id, title, state_json, created_at, updated_at
    FROM boards
    WHERE id = ?
  `);
  const insertBoardStatement = db.prepare(`
    INSERT INTO boards (id, title, state_json, created_at, updated_at)
    VALUES (@id, @title, @state_json, @created_at, @updated_at)
  `);
  const updateBoardStatement = db.prepare(`
    UPDATE boards
    SET title = @title, state_json = @state_json, updated_at = @updated_at
    WHERE id = @id
  `);
  const deleteBoardStatement = db.prepare("DELETE FROM boards WHERE id = ?");

  function createBoard({ title, state = createEmptyBoardState() } = {}) {
    assertValidBoardState(state);

    const now = new Date().toISOString();
    const board = {
      id: randomUUID(),
      title: normalizeTitle(title),
      state,
      createdAt: now,
      updatedAt: now
    };

    insertBoardStatement.run({
      id: board.id,
      title: board.title,
      state_json: JSON.stringify(state),
      created_at: board.createdAt,
      updated_at: board.updatedAt
    });

    return board;
  }

  function listBoards() {
    return listBoardsStatement.all().map(rowToBoardSummary);
  }

  function getBoard(id) {
    const row = getBoardStatement.get(id);
    return row ? rowToBoard(row) : null;
  }

  function updateBoard(id, changes = {}) {
    const current = getBoard(id);
    if (!current) {
      return null;
    }

    const hasTitle = Object.hasOwn(changes, "title");
    const { state } = changes;
    const nextState = state === undefined ? current.state : state;
    assertValidBoardState(nextState);

    const board = {
      ...current,
      title: hasTitle ? normalizeTitle(changes.title) : current.title,
      state: nextState,
      updatedAt: new Date().toISOString()
    };

    updateBoardStatement.run({
      id,
      title: board.title,
      state_json: JSON.stringify(board.state),
      updated_at: board.updatedAt
    });

    return board;
  }

  function deleteBoard(id) {
    return deleteBoardStatement.run(id).changes > 0;
  }

  function close() {
    db.close();
  }

  return {
    listBoards,
    createBoard,
    getBoard,
    updateBoard,
    deleteBoard,
    close
  };
}

function rowToBoard(row) {
  return {
    id: row.id,
    title: row.title,
    state: JSON.parse(row.state_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function rowToBoardSummary(row) {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normalizeTitle(title) {
  const normalized = title == null ? "" : String(title).trim();
  return normalized || "Untitled board";
}

function assertValidBoardState(state) {
  if (
    !isPlainObject(state) ||
    !isPlainObject(state.cam) ||
    !isFiniteNumber(state.cam.x) ||
    !isFiniteNumber(state.cam.y) ||
    !isFiniteNumber(state.cam.scale) ||
    !Array.isArray(state.nodes) ||
    !Array.isArray(state.edges) ||
    !Number.isInteger(state.uid) ||
    !Number.isInteger(state.messageUid)
  ) {
    throw new Error(INVALID_BOARD_STATE);
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

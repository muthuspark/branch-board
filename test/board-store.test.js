import assert from "node:assert/strict";
import { mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import { createBoardStore, createEmptyBoardState } from "../src/board-store.js";

const tempDirs = [];
const stores = [];

afterEach(async () => {
  for (const store of stores.splice(0)) {
    store.close();
  }
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })));
});

async function makeStore() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "branchboard-store-"));
  tempDirs.push(dir);
  const store = createBoardStore({ dbFile: path.join(dir, "boards.sqlite") });
  stores.push(store);
  return store;
}

function waitForClockTick() {
  return new Promise(resolve => setTimeout(resolve, 5));
}

describe("createEmptyBoardState", () => {
  it("returns the default board state shape", () => {
    assert.deepEqual(createEmptyBoardState(), {
      cam: { x: 0, y: 0, scale: 1 },
      nodes: [],
      edges: [],
      uid: 0,
      messageUid: 0
    });
  });
});

describe("createBoardStore", () => {
  it("creates, lists, and loads boards", async () => {
    const store = await makeStore();
    const state = {
      cam: { x: 10, y: -5, scale: 1.5 },
      nodes: [{ id: "node-1", text: "Start" }],
      edges: [],
      uid: 7,
      messageUid: 3
    };

    const board = store.createBoard({ title: "Project map", state });

    assert.equal(typeof board.id, "string");
    assert.equal(board.title, "Project map");
    assert.deepEqual(board.state, state);
    assert.match(board.createdAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.match(board.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal("created_at" in board, false);
    assert.equal("updated_at" in board, false);

    assert.deepEqual(store.getBoard(board.id), board);
    assert.deepEqual(store.listBoards(), [
      {
        id: board.id,
        title: "Project map",
        createdAt: board.createdAt,
        updatedAt: board.updatedAt
      }
    ]);
  });

  it("creates the database directory recursively", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "branchboard-store-"));
    tempDirs.push(dir);
    const dbFile = path.join(dir, "missing", "nested", "boards.sqlite");
    const store = createBoardStore({ dbFile });
    stores.push(store);

    store.createBoard();

    const dbFileStat = await stat(dbFile);
    assert.equal(dbFileStat.isFile(), true);
  });

  it("uses default title and empty state when creating a board", async () => {
    const store = await makeStore();

    const board = store.createBoard();

    assert.equal(board.title, "Untitled board");
    assert.deepEqual(board.state, createEmptyBoardState());
  });

  it("normalizes titles when creating a board", async () => {
    const store = await makeStore();

    assert.equal(store.createBoard({ title: "  Roadmap  " }).title, "Roadmap");
    assert.equal(store.createBoard({ title: "" }).title, "Untitled board");
    assert.equal(store.createBoard({ title: "   " }).title, "Untitled board");
    assert.equal(store.createBoard({ title: null }).title, "Untitled board");
    assert.equal(store.createBoard({ title: undefined }).title, "Untitled board");
    assert.equal(store.createBoard({ title: 42 }).title, "42");
  });

  it("lists board summaries by most recently updated first", async () => {
    const store = await makeStore();
    const first = store.createBoard({ title: "First" });
    await waitForClockTick();
    const second = store.createBoard({ title: "Second" });
    await waitForClockTick();
    const updatedFirst = store.updateBoard(first.id, { title: "First updated" });

    assert.deepEqual(
      store.listBoards().map(board => board.id),
      [updatedFirst.id, second.id]
    );
  });

  it("updates board title and state", async () => {
    const store = await makeStore();
    const board = store.createBoard({ title: "Draft" });
    await waitForClockTick();
    const state = {
      cam: { x: 1, y: 2, scale: 0.75 },
      nodes: [{ id: "node-1" }],
      edges: [{ from: "node-1", to: "node-2" }],
      uid: 12,
      messageUid: 4
    };

    const updated = store.updateBoard(board.id, { title: "Published", state });

    assert.equal(updated.id, board.id);
    assert.equal(updated.title, "Published");
    assert.deepEqual(updated.state, state);
    assert.notEqual(updated.updatedAt, board.updatedAt);
    assert.deepEqual(store.getBoard(board.id), updated);
  });

  it("normalizes titles when updating a board", async () => {
    const store = await makeStore();
    const board = store.createBoard({ title: "Draft" });

    assert.equal(store.updateBoard(board.id, { title: "  Published  " }).title, "Published");
    assert.equal(store.updateBoard(board.id, { title: "" }).title, "Untitled board");
    assert.equal(store.updateBoard(board.id, { title: "   " }).title, "Untitled board");
    assert.equal(store.updateBoard(board.id, { title: null }).title, "Untitled board");
    assert.equal(store.updateBoard(board.id, { title: undefined }).title, "Untitled board");
    assert.equal(store.updateBoard(board.id, { title: 42 }).title, "42");
  });

  it("preserves title when updating only board state", async () => {
    const store = await makeStore();
    const board = store.createBoard({ title: "Draft" });
    const state = {
      ...createEmptyBoardState(),
      uid: 2
    };

    const updated = store.updateBoard(board.id, { state });

    assert.equal(updated.title, "Draft");
    assert.deepEqual(updated.state, state);
  });

  it("returns null when loading or updating a missing board", async () => {
    const store = await makeStore();

    assert.equal(store.getBoard("missing"), null);
    assert.equal(store.updateBoard("missing", { title: "Nope" }), null);
  });

  it("deletes boards and reports whether a row was removed", async () => {
    const store = await makeStore();
    const board = store.createBoard({ title: "Disposable" });

    assert.equal(store.deleteBoard(board.id), true);
    assert.equal(store.getBoard(board.id), null);
    assert.deepEqual(store.listBoards(), []);
    assert.equal(store.deleteBoard(board.id), false);
  });

  it("rejects malformed board state", async () => {
    const store = await makeStore();
    const board = store.createBoard();

    assert.throws(
      () => store.createBoard({ state: { nodes: [] } }),
      new Error("Invalid board state.")
    );
    assert.throws(
      () => store.updateBoard(board.id, { state: { nodes: [] } }),
      new Error("Invalid board state.")
    );
  });
});

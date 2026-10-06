<template>
  <p class="sr-only" id="keyboard-help">
    Select part of an answer, then choose Explore this to open a related chat beside this one.
  </p>

  <main id="chat-workspace" aria-label="Branchboard chats">
    <header class="edition-masthead">
      <div id="workspace-controls" aria-label="Board controls">
        <label class="sr-only" for="board-switcher">Board</label>
        <select id="board-switcher" v-model="activeBoardId" @change="openSelectedBoard">
          <option v-for="board in boards" :key="board.id" :value="board.id">{{ board.title }}</option>
        </select>
        <div class="board-actions" aria-label="Board actions">
          <button type="button" class="board-action" @click="startBoardRename"><Pencil aria-hidden="true" :size="15" /> Rename</button>
          <button type="button" class="board-action danger" @click="deleteActiveBoard"><Trash2 aria-hidden="true" :size="15" /> Delete</button>
        </div>
      </div>
      <button type="button" class="new-board" @click="openNewBoardDialog">
        <FilePlus2 aria-hidden="true" :size="16" :stroke-width="1.8" /> New board
      </button>
    </header>
    <div class="chat-columns">
      <article
        v-for="node in orderedNodes"
        :key="node.id"
        :ref="setNodeRef(node.id)"
        class="node"
        :class="{ focused: focusedId === node.id }"
        :data-node-id="node.id"
        tabindex="0"
        role="group"
        aria-describedby="keyboard-help"
        :aria-label="node.parent ? `${displayNodeLabel(node.id)} about ${trim(node.fromText, 50)}` : 'Main chat'"
        :aria-busy="node.pending"
        @focusin="focusNode(node.id)"
      >
        <div v-if="node.parent" class="branch-source">
          <span>{{ trim(node.fromText, 120) }}</span>
          <button type="button" class="node__delete" aria-label="Delete chat" title="Delete chat" @click.stop="deleteNode(node)">
            <Trash2 aria-hidden="true" :size="15" :stroke-width="1.8" />
          </button>
        </div>
        <div class="node__body">
          <div v-for="message in node.messages" :key="message.id" class="msg" :class="[message.role, { thinking: message.thinking, error: message.error }]" v-html="message.html"></div>
        </div>

        <div class="node__foot">
          <textarea :id="`chat-input-${node.id}`" :name="`chat-input-${node.id}`" v-model="node.draft" rows="1" :aria-label="node.parent ? 'Ask about this branch' : 'Ask your first question'" :placeholder="node.parent ? 'Continue this branch...' : 'Ask anything...'" @input="handleDraftInput(node, $event)" @keydown.enter.exact.prevent="sendQuestion(node)"></textarea>
          <button class="ask" :disabled="node.pending || !node.draft.trim()" @click="sendQuestion(node)">{{ node.pending ? "Thinking" : "Send" }}</button>
        </div>
      </article>
    </div>
  </main>

  <button
    id="pill"
    ref="pillEl"
    type="button"
    aria-label="Explore selected answer text"
    :style="pillStyle"
    @pointerdown.stop.prevent
    @click="branchFromSelection"
  >
    <span class="k">↳</span> Explore this
  </button>

  <div v-if="newBoardDialog.open" class="confirm" role="dialog" aria-modal="true" aria-labelledby="new-board-title" @click.self="closeNewBoardDialog">
    <form class="confirm__panel" @submit.prevent="startNewBoard">
      <h2 id="new-board-title">Start a new board</h2>
      <p>What would you like to explore?</p>
      <label class="sr-only" for="new-board-question">First question</label>
      <textarea id="new-board-question" v-model="newBoardDialog.question" rows="3" placeholder="Ask your first question..."></textarea>
      <div class="confirm__actions">
        <button type="button" class="confirm__button" @click="closeNewBoardDialog">Cancel</button>
        <button type="submit" class="confirm__button primary" :disabled="!newBoardDialog.question.trim()">Start board</button>
      </div>
    </form>
  </div>

  <div v-if="isRenamingBoard" class="confirm" role="dialog" aria-modal="true" aria-labelledby="rename-board-title" @click.self="cancelBoardRename">
    <form class="confirm__panel" @submit.prevent="finishBoardRename">
      <h2 id="rename-board-title">Rename board</h2>
      <label class="sr-only" for="board-title-input">Board title</label>
      <input id="board-title-input" v-model="boardTitleDraft" @keydown.escape.prevent="cancelBoardRename" />
      <div class="confirm__actions">
        <button type="button" class="confirm__button" @click="cancelBoardRename">Cancel</button>
        <button type="submit" class="confirm__button primary">Save name</button>
      </div>
    </form>
  </div>

  <div
    v-if="confirmDialog.open"
    class="confirm"
    role="dialog"
    aria-modal="true"
    aria-labelledby="confirm-title"
    aria-describedby="confirm-message"
    @click.self="resolveConfirm(false)"
    @keydown="handleConfirmKeydown"
  >
    <div class="confirm__panel">
      <h2 id="confirm-title">{{ confirmDialog.title }}</h2>
      <p id="confirm-message">{{ confirmDialog.message }}</p>
      <div class="confirm__actions">
        <button ref="confirmCancelEl" type="button" class="confirm__button" @click="resolveConfirm(false)">Cancel</button>
        <button type="button" class="confirm__button danger" @click="resolveConfirm(true)">
          {{ confirmDialog.confirmLabel }}
        </button>
      </div>
    </div>
  </div>

</template>

<script setup>
import DOMPurify from "dompurify";
import { FilePlus2, Pencil, Trash2 } from "@lucide/vue";
import katex from "katex";
import "katex/dist/katex.min.css";
import { marked } from "marked";
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from "vue";

import { renderAssistantMarkdown } from "../../public/markdown-renderer.js";

const DEFAULT_NODE_W = 440;
const NODE_GAP = 72;
const PLACEMENT_COLUMNS = 20;
const PLACEMENT_ROWS = 20;
const pillEl = ref(null);
const confirmCancelEl = ref(null);
const mode = ref("demo");
const boards = ref([]);
const activeBoardId = ref("");
const committedBoardId = ref("");
const activeBoardTitle = ref("Untitled board");
const isRenamingBoard = ref(false);
const boardTitleDraft = ref("");
const saveStatus = ref("");
const cam = reactive({ x: 0, y: 0, scale: 1 });
const nodes = ref([]);
const edges = ref([]);
const nodeRefs = new Map();
const manuallyRenamedBoards = new Set();
const inFlightBoardSaves = new Map();
const queuedBoardSaves = new Map();
const confirmDialog = reactive({
  open: false,
  title: "",
  message: "",
  confirmLabel: "Delete",
  resolve: null
});
const newBoardDialog = reactive({ open: false, question: "" });
let uid = 0;
let messageUid = 0;
let focusedId = ref(null);
let pendingSel = ref(null);
let isPanning = ref(false);
let panState = null;
let dragState = null;
let saveTimer = null;
let pendingSaveSnapshot = null;
let isRestoringBoard = false;
let boardTitleBeforeRename = "Untitled board";
let focusBeforeConfirm = null;

const pillStyle = computed(() => {
  if (!pendingSel.value) return { display: "none" };
  return {
    display: "flex",
    left: `${pendingSel.value.left}px`,
    top: `${pendingSel.value.top}px`
  };
});

const orderedNodes = computed(() => [...nodes.value].sort((a, b) => a.x - b.x || a.y - b.y));

function setNodeRef(id) {
  return element => {
    if (element) nodeRefs.set(id, element);
    else nodeRefs.delete(id);
  };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    }
  });
  if (response.status === 204) return null;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Request failed.");
  return payload;
}

async function initializeBoards() {
  try {
    const data = await fetchJson("/api/boards");
    boards.value = Array.isArray(data.boards) ? data.boards : [];
    if (!boards.value.length) {
      if (!await createNewBoard()) {
        restoreStartupRoot("Local save failed");
      }
      return;
    }
    if (!await loadBoard(boards.value[0].id)) {
      restoreStartupRoot("Could not load boards");
    }
  } catch (_) {
    boards.value = [];
    restoreStartupRoot("Could not load boards");
  }
}

async function refreshBoardList() {
  const data = await fetchJson("/api/boards");
  boards.value = Array.isArray(data.boards) ? data.boards : [];
}

async function createNewBoard(question = "") {
  if (!await flushActiveBoardSave()) return false;
  try {
    const board = await fetchJson("/api/boards", {
      method: "POST",
      body: JSON.stringify({
        title: question ? trim(question, 48) : "Untitled board",
        state: createInitialBoardState()
      })
    });
    await refreshBoardList();
    loadBoardSnapshot(board);
    saveStatus.value = "Saved";
    if (question) {
      nextTick(() => {
        const root = nodes.value[0];
        if (!root) return;
        root.draft = question;
        sendQuestion(root);
      });
    }
    return true;
  } catch (_) {
    saveStatus.value = "Local save failed";
    return false;
  }
}

function openNewBoardDialog() {
  newBoardDialog.question = "";
  newBoardDialog.open = true;
  nextTick(() => document.getElementById("new-board-question")?.focus());
}

function closeNewBoardDialog() {
  newBoardDialog.open = false;
}

async function startNewBoard() {
  const question = newBoardDialog.question.trim();
  if (!question) return;
  if (await createNewBoard(question)) closeNewBoardDialog();
}

async function openSelectedBoard() {
  const requestedBoardId = activeBoardId.value;
  if (!requestedBoardId || requestedBoardId === committedBoardId.value) return;
  if (!await flushActiveBoardSave()) {
    activeBoardId.value = committedBoardId.value;
    return;
  }
  if (!await loadBoard(requestedBoardId) && activeBoardId.value === requestedBoardId) {
    activeBoardId.value = committedBoardId.value;
  }
}

async function loadBoard(id) {
  const requestedBoardId = id;
  try {
    const board = await fetchJson(`/api/boards/${requestedBoardId}`);
    if (activeBoardId.value && activeBoardId.value !== requestedBoardId) return false;
    loadBoardSnapshot(board);
    saveStatus.value = "Saved";
    return true;
  } catch (_) {
    if (activeBoardId.value === requestedBoardId) activeBoardId.value = committedBoardId.value;
    saveStatus.value = "Could not load boards";
    return false;
  }
}

function restoreStartupRoot(status) {
  clearPendingSave();
  saveStatus.value = status;
  activeBoardId.value = "";
  committedBoardId.value = "";
  activeBoardTitle.value = "Untitled board";
  isRenamingBoard.value = false;
  isRestoringBoard = true;
  nodes.value = [];
  edges.value = [];
  nodeRefs.clear();
  createRootNode();
  isRestoringBoard = false;
}

function loadBoardSnapshot(board) {
  clearPendingSave();
  isRenamingBoard.value = false;
  isRestoringBoard = true;
  activeBoardId.value = board.id;
  committedBoardId.value = board.id;
  activeBoardTitle.value = board.title || "Untitled board";
  restoreBoardState(board.state || createInitialBoardState());
  isRestoringBoard = false;
}

function renameActiveBoard() {
  activeBoardTitle.value = activeBoardTitle.value.trim() || "Untitled board";
  if (committedBoardId.value) manuallyRenamedBoards.add(committedBoardId.value);
  scheduleBoardSave();
}

function startBoardRename() {
  boardTitleBeforeRename = activeBoardTitle.value;
  boardTitleDraft.value = activeBoardTitle.value;
  isRenamingBoard.value = true;
  nextTick(() => document.getElementById("board-title-input")?.focus());
}

function finishBoardRename() {
  if (!isRenamingBoard.value) return;
  activeBoardTitle.value = boardTitleDraft.value;
  isRenamingBoard.value = false;
  renameActiveBoard();
}

function cancelBoardRename() {
  boardTitleDraft.value = boardTitleBeforeRename || "Untitled board";
  isRenamingBoard.value = false;
}

async function deleteActiveBoard() {
  if (!committedBoardId.value) return;
  if (!await confirmDestructiveAction({
    title: "Delete board",
    message: "Delete this board and all of its notes?",
    confirmLabel: "Delete board"
  })) return;
  isRenamingBoard.value = false;
  if (!await flushActiveBoardSave()) return;
  const deletedId = committedBoardId.value;
  const currentIndex = boards.value.findIndex(board => board.id === deletedId);
  const remaining = boards.value.filter(board => board.id !== deletedId);
  const nextBoard = remaining[Math.min(Math.max(currentIndex, 0), remaining.length - 1)];
  clearPendingSave();
  try {
    await fetchJson(`/api/boards/${deletedId}`, { method: "DELETE" });
    committedBoardId.value = "";
    activeBoardId.value = "";
    await refreshBoardList();
    if (nextBoard) {
      activeBoardId.value = nextBoard.id;
      if (!await loadBoard(nextBoard.id)) restoreStartupRoot("Could not load boards");
    } else if (!await createNewBoard()) {
      restoreStartupRoot("Local save failed");
    }
  } catch (_) {
    saveStatus.value = "Local save failed";
  }
}

function createInitialBoardState() {
  return {
    cam: { x: 0, y: 0, scale: 1 },
    nodes: [],
    edges: [],
    uid: 0,
    messageUid: 0
  };
}

function serializeBoardState() {
  return {
    cam: { x: cam.x, y: cam.y, scale: cam.scale },
    nodes: nodes.value.map(node => ({
      id: node.id,
      x: node.x,
      y: node.y,
      parentId: node.parent?.id || null,
      fromText: node.fromText,
      draft: node.draft,
      messages: node.messages.map(serializeMessage).filter(Boolean)
    })),
    edges: edges.value.map(edge => ({ from: edge.from, to: edge.to })),
    uid,
    messageUid
  };
}

function restoreBoardState(state) {
  const snapshot = isPlainObject(state) ? state : createInitialBoardState();
  nodes.value = [];
  edges.value = [];
  nodeRefs.clear();
  hidePill();

  const stateCam = isPlainObject(snapshot.cam) ? snapshot.cam : createInitialBoardState().cam;
  cam.x = finiteNumber(stateCam.x, 0);
  cam.y = finiteNumber(stateCam.y, 0);
  cam.scale = finiteNumber(stateCam.scale, 1);
  uid = Number.isInteger(snapshot.uid) ? snapshot.uid : 0;
  messageUid = Number.isInteger(snapshot.messageUid) ? snapshot.messageUid : 0;

  const parentIds = new Map();
  const byId = new Map();
  for (const savedNode of Array.isArray(snapshot.nodes) ? snapshot.nodes : []) {
    if (!isPlainObject(savedNode)) continue;
    const node = {
      id: String(savedNode.id || `n${++uid}`),
      x: finiteNumber(savedNode.x, 0),
      y: finiteNumber(savedNode.y, 0),
      parent: null,
      fromText: savedNode.fromText || null,
      draft: savedNode.draft || "",
      pending: false,
      messages: Array.isArray(savedNode.messages)
        ? savedNode.messages.map(restoreMessage)
        : [],
      children: []
    };
    nodes.value.push(node);
    byId.set(node.id, node);
    parentIds.set(node.id, savedNode.parentId || null);
  }

  for (const node of nodes.value) {
    const parent = byId.get(parentIds.get(node.id));
    if (parent && parent.id !== node.id) {
      node.parent = parent;
      parent.children.push(node.id);
    }
  }

  edges.value = (Array.isArray(snapshot.edges) ? snapshot.edges : [])
    .filter(edge => isPlainObject(edge))
    .filter(edge => byId.has(edge.from) && byId.has(edge.to))
    .map(edge => ({ from: edge.from, to: edge.to }));

  if (!nodes.value.length) {
    createRootNode();
    return;
  }
  focusNode(nodes.value[0].id);
  nextTick(ensureRestoredBoardVisible);
}

function ensureRestoredBoardVisible() {
  if (!nodes.value.length) return;
  if (cam.scale <= 0.35) {
    centerOn(nodes.value[0], 0.75);
    return;
  }
  const hasVisibleNode = nodes.value.some(node => {
    const left = cam.x + node.x * cam.scale;
    const top = cam.y + node.y * cam.scale;
    const right = left + nodeWidth(node) * cam.scale;
    const bottom = top + nodeHeight(node) * cam.scale;
    return right > 0 && bottom > 0 && left < window.innerWidth && top < window.innerHeight;
  });
  if (!hasVisibleNode) centerOn(nodes.value[0], Math.max(cam.scale, 0.75));
}

function restoreMessage(message) {
  const text = message?.thinking ? userFacingError() : (message?.text || "");
  const role = message?.role === "assistant" ? "assistant" : "user";
  return {
    id: message?.id || `m${++messageUid}`,
    role,
    text,
    html: renderMessageHtml(role, text),
    ...((message?.error || message?.thinking) && role === "assistant" ? { error: true } : {})
  };
}

function serializeMessage(message) {
  if (!isPlainObject(message)) return null;
  const role = message.role === "assistant" ? "assistant" : "user";
  const text = message.thinking && role === "assistant" ? userFacingError() : String(message.text || "");
  const serialized = {
    id: message.id || `m${++messageUid}`,
    role,
    text
  };
  if ((message.error || message.thinking) && role === "assistant") {
    serialized.error = true;
  }
  return serialized;
}

function maybeDeriveBoardTitle(question) {
  if (!committedBoardId.value) return;
  if (manuallyRenamedBoards.has(committedBoardId.value)) return;
  if (activeBoardTitle.value.trim() !== "Untitled board") return;
  activeBoardTitle.value = trim(question, 48);
}

function clearPendingSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  pendingSaveSnapshot = null;
}

function clearSaveTimer() {
  if (!saveTimer) return;
  clearTimeout(saveTimer);
  saveTimer = null;
}

function scheduleBoardSave() {
  if (isRestoringBoard || !committedBoardId.value) return;
  pendingSaveSnapshot = captureActiveBoardSnapshot();
  clearSaveTimer();
  saveTimer = setTimeout(saveActiveBoard, 350);
}

function captureActiveBoardSnapshot() {
  if (!committedBoardId.value) return null;
  return {
    boardId: committedBoardId.value,
    title: activeBoardTitle.value,
    state: serializeBoardState()
  };
}

async function flushActiveBoardSave() {
  const boardId = committedBoardId.value;
  const snapshot = pendingSaveSnapshot;
  clearSaveTimer();
  pendingSaveSnapshot = null;
  if (snapshot && !await saveBoardSnapshot(snapshot, { updateUi: false })) return false;
  if (!boardId) return true;
  return waitForBoardSaveIdle(committedBoardId.value);
}

async function saveActiveBoard() {
  if (isRestoringBoard) return;
  const snapshot = pendingSaveSnapshot || captureActiveBoardSnapshot();
  clearSaveTimer();
  pendingSaveSnapshot = null;
  if (!snapshot) return;
  await saveBoardSnapshot(snapshot);
}

async function saveBoardSnapshot(snapshot, { updateUi = true } = {}) {
  if (inFlightBoardSaves.has(snapshot.boardId)) {
    queuedBoardSaves.set(snapshot.boardId, { snapshot, updateUi });
    return waitForBoardSaveIdle(snapshot.boardId);
  }

  const savePromise = processBoardSaveQueue(snapshot.boardId, { snapshot, updateUi });
  inFlightBoardSaves.set(snapshot.boardId, savePromise);
  try {
    return await savePromise;
  } finally {
    if (inFlightBoardSaves.get(snapshot.boardId) === savePromise) {
      inFlightBoardSaves.delete(snapshot.boardId);
    }
  }
}

async function waitForBoardSaveIdle(boardId) {
  return inFlightBoardSaves.get(boardId) || true;
}

async function processBoardSaveQueue(boardId, initialRequest) {
  let request = initialRequest;
  let ok = true;
  while (request) {
    ok = await persistBoardSnapshot(request.snapshot, { updateUi: request.updateUi });
    request = queuedBoardSaves.get(boardId);
    queuedBoardSaves.delete(boardId);
  }
  return ok;
}

async function persistBoardSnapshot(snapshot, { updateUi = true } = {}) {
  saveStatus.value = "Saving...";
  try {
    const board = await fetchJson(`/api/boards/${snapshot.boardId}`, {
      method: "PUT",
      body: JSON.stringify({
        title: snapshot.title,
        state: snapshot.state
      })
    });
    if (updateUi && snapshot.boardId !== committedBoardId.value) return true;
    if (updateUi) {
      activeBoardTitle.value = board.title || activeBoardTitle.value;
      await refreshBoardList();
    }
    if (!updateUi || snapshot.boardId === committedBoardId.value) saveStatus.value = "Saved";
    return true;
  } catch (_) {
    if (!updateUi || snapshot.boardId === committedBoardId.value) saveStatus.value = "Local save failed";
    return false;
  }
}

function plainMessage(role, text, extra = {}) {
  return {
    id: `m${++messageUid}`,
    role,
    text,
    html: renderMessageHtml(role, text),
    ...extra
  };
}

function assistantMessage(answer) {
  return {
    id: `m${++messageUid}`,
    role: "assistant",
    text: answer,
    html: renderAssistantMarkdown(answer, marked, DOMPurify, katex)
  };
}

function renderMessageHtml(role, text) {
  return role === "assistant" ? renderAssistantMarkdown(text, marked, DOMPurify, katex) : escapeHtml(text);
}

function createNode({ x, y, parent = null, fromText = null }) {
  const id = `n${++uid}`;
  const position = findOpenNodePosition(x, y);
  const node = {
    id,
    x: position.x,
    y: position.y,
    parent,
    fromText,
    draft: "",
    pending: false,
    messages: [],
    children: []
  };
  nodes.value.push(node);
  if (parent) {
    parent.children.push(id);
    edges.value.push({ from: parent.id, to: id });
  }
  focusNode(id);
  if (!isRestoringBoard) {
    scheduleBoardSave();
    nextTick(() => {
      nodeRefs.get(id)?.querySelector("textarea")?.focus();
      scrollNodeBody(node);
    });
  }
  return node;
}

function findOpenNodePosition(preferredX, preferredY) {
  const width = DEFAULT_NODE_W;
  const height = Math.min(
    Math.max(window.innerHeight * 0.8, 320),
    window.innerHeight - 32
  );
  const rowOffsets = [0];
  for (let row = 1; row <= PLACEMENT_ROWS; row += 1) {
    rowOffsets.push(row, -row);
  }

  for (let column = 0; column <= PLACEMENT_COLUMNS; column += 1) {
    for (const row of rowOffsets) {
      const candidate = {
        x: snapToCanvasGrid(preferredX + column * (width + NODE_GAP)),
        y: snapToCanvasGrid(preferredY + row * (height + NODE_GAP)),
        width,
        height
      };
      if (nodes.value.every(node => !nodeRectanglesOverlap(candidate, node))) {
        return { x: candidate.x, y: candidate.y };
      }
    }
  }

  return {
    x: snapToCanvasGrid(preferredX + (PLACEMENT_COLUMNS + 1) * (width + NODE_GAP)),
    y: snapToCanvasGrid(preferredY)
  };
}

function nodeRectanglesOverlap(candidate, node) {
  const existing = {
    x: node.x,
    y: node.y,
    width: nodeWidth(node),
    height: nodeHeight(node)
  };
  return candidate.x < existing.x + existing.width + NODE_GAP
    && candidate.x + candidate.width + NODE_GAP > existing.x
    && candidate.y < existing.y + existing.height + NODE_GAP
    && candidate.y + candidate.height + NODE_GAP > existing.y;
}

function snapToCanvasGrid(value) {
  return Math.round(value / 24) * 24;
}

function createRootNode() {
  const node = createNode({ x: 0, y: 0 });
  const shouldSave = !isRestoringBoard;
  nextTick(() => centerOn(node, 1, shouldSave));
  return node;
}

function collectNodeAndDescendantIds(node) {
  const ids = new Set();
  const stack = [node.id];
  while (stack.length) {
    const id = stack.pop();
    if (ids.has(id)) continue;
    ids.add(id);
    const current = nodes.value.find(item => item.id === id);
    if (current) stack.push(...current.children);
  }
  return ids;
}

async function deleteNode(node) {
  if (!node) return;
  const idsToDelete = collectNodeAndDescendantIds(node);
  if (!await confirmDestructiveAction({
    title: "Delete note",
    message: idsToDelete.size > 1
      ? "Delete this note and its branches?"
      : "Delete this note?",
    confirmLabel: "Delete note"
  })) return;

  hidePill();
  window.getSelection()?.removeAllRanges();
  nodes.value = nodes.value.filter(item => !idsToDelete.has(item.id));
  edges.value = edges.value.filter(edge => !idsToDelete.has(edge.from) && !idsToDelete.has(edge.to));
  for (const remainingNode of nodes.value) {
    remainingNode.children = remainingNode.children.filter(id => !idsToDelete.has(id));
  }
  for (const id of idsToDelete) {
    nodeRefs.delete(id);
  }
  if (focusedId.value && idsToDelete.has(focusedId.value)) {
    focusedId.value = nodes.value[0]?.id || null;
  }
  if (!nodes.value.length) createRootNode();
  else scheduleBoardSave();
}

function confirmDestructiveAction({ title, message, confirmLabel }) {
  if (confirmDialog.resolve) confirmDialog.resolve(false);
  return new Promise(resolve => {
    focusBeforeConfirm = document.activeElement;
    confirmDialog.title = title;
    confirmDialog.message = message;
    confirmDialog.confirmLabel = confirmLabel;
    confirmDialog.resolve = resolve;
    confirmDialog.open = true;
    nextTick(() => confirmCancelEl.value?.focus());
  });
}

function resolveConfirm(confirmed) {
  const resolve = confirmDialog.resolve;
  confirmDialog.open = false;
  confirmDialog.resolve = null;
  if (resolve) resolve(Boolean(confirmed));
  nextTick(() => focusBeforeConfirm?.focus?.());
}

function handleConfirmKeydown(event) {
  if (event.key === "Escape") {
    event.preventDefault();
    resolveConfirm(false);
    return;
  }
  if (event.key !== "Tab") return;
  const controls = [...event.currentTarget.querySelectorAll("button:not(:disabled)")];
  if (!controls.length) return;
  const first = controls[0];
  const last = controls[controls.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function createCenteredRoot() {
  const center = screenToWorld(window.innerWidth / 2, window.innerHeight / 2);
  createNode({ x: center.x - DEFAULT_NODE_W / 2, y: center.y - 120 });
}

function sendQuestion(node) {
  if (node.pending) return;
  const question = node.draft.trim();
  if (!question) return;
  const requestBoardId = committedBoardId.value;
  const requestNodeId = node.id;
  const history = conversationFor(node);
  maybeDeriveBoardTitle(question);
  node.draft = "";
  node.pending = true;
  node.messages.push(plainMessage("user", question));
  const thinking = plainMessage("assistant", "Thinking...", { thinking: true });
  node.messages.push(thinking);
  let receivedAnswer = false;
  scheduleBoardSave();
  nextTick(() => scrollNodeBody(node));
  streamLLM(question, lineageFor(node), history, {
    onDelta(delta) {
      appendMessageTextForBoard(requestBoardId, requestNodeId, thinking.id, delta, {
        replace: !receivedAnswer
      });
      receivedAnswer = true;
      if (requestBoardId === committedBoardId.value) {
        const activeNode = nodes.value.find(item => item.id === requestNodeId);
        if (activeNode) nextTick(() => scrollNodeBody(activeNode));
      }
    }
  })
    .then(() => {
      mode.value = "live";
    })
    .catch(error => {
      replaceMessageForBoard(requestBoardId, requestNodeId, thinking.id, {
        ...plainMessage("assistant", userFacingError(error)),
        error: true
      });
    })
    .finally(() => {
      const requestNode = nodes.value.find(item => item.id === requestNodeId);
      if (requestBoardId === committedBoardId.value && requestNode) requestNode.pending = false;
      if (requestBoardId === committedBoardId.value) {
        const activeNode = nodes.value.find(item => item.id === requestNodeId);
        if (activeNode) nextTick(() => scrollNodeBody(activeNode));
      }
    });
}

async function streamLLM(question, lineage, history, { onDelta }) {
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, lineage, history })
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || "Answer request failed.");
    }
    if (!response.body) throw new Error("Answer stream failed.");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let receivedText = false;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
      let eventEnd;
      while ((eventEnd = buffer.indexOf("\n\n")) !== -1) {
        const event = parseStreamEvent(buffer.slice(0, eventEnd));
        buffer = buffer.slice(eventEnd + 2);
        if (!event) continue;
        if (event.type === "done") {
          if (!receivedText) throw new Error("Empty answer.");
          return;
        }
        if (event.type === "error") {
          const payload = parseStreamPayload(event.data);
          throw new Error(payload.error || "Answer request failed.");
        }
        const payload = parseStreamPayload(event.data);
        const delta = payload.delta || "";
        if (delta) {
          receivedText = true;
          onDelta(delta);
        }
      }
    }

    buffer += decoder.decode();
    if (buffer.trim()) {
      const event = parseStreamEvent(buffer);
      if (event?.type === "message") {
        const payload = parseStreamPayload(event.data);
        const delta = payload.delta || "";
        if (delta) {
          receivedText = true;
          onDelta(delta);
        }
      }
    }

    if (!receivedText) throw new Error("Empty answer.");
  } catch (error) {
    mode.value = "demo";
    throw error;
  }
}

function parseStreamEvent(block) {
  const lines = block.split("\n");
  const data = [];
  let type = "message";
  for (const line of lines) {
    if (line.startsWith("event:")) type = line.slice(6).trim();
    else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
  }
  if (!data.length && type === "message") return null;
  return { type, data: data.join("\n") };
}

function parseStreamPayload(data) {
  try {
    return JSON.parse(data || "{}");
  } catch (_) {
    return {};
  }
}

async function callLLM(question, lineage) {
  try {
    let answer = "";
    await streamLLM(question, lineage, [], {
      onDelta(delta) {
        answer += delta;
      }
    });
    const text = answer.trim();
    if (!text) throw new Error("Empty answer.");
    mode.value = "live";
    return text;
  } catch (error) {
    mode.value = "demo";
    throw error;
  }
}

function replaceMessage(node, id, message) {
  const index = node.messages.findIndex(item => item.id === id);
  if (index !== -1) {
    node.messages.splice(index, 1, message);
    scheduleBoardSave();
  }
}

function replaceMessageForBoard(boardId, nodeId, id, message) {
  if (boardId !== committedBoardId.value) return;
  const node = nodes.value.find(item => item.id === nodeId);
  if (!node) return;
  replaceMessage(node, id, message);
}

function appendMessageText(node, id, delta, { replace = false } = {}) {
  const message = node.messages.find(item => item.id === id);
  if (!message) return;
  const text = replace ? delta : `${message.text || ""}${delta}`;
  Object.assign(message, {
    role: "assistant",
    text,
    html: renderMessageHtml("assistant", text)
  });
  delete message.thinking;
  delete message.error;
  scheduleBoardSave();
}

function appendMessageTextForBoard(boardId, nodeId, id, delta, options) {
  if (boardId !== committedBoardId.value) return;
  const node = nodes.value.find(item => item.id === nodeId);
  if (!node) return;
  appendMessageText(node, id, delta, options);
}

function branchFromSelection() {
  if (!pendingSel.value) return;
  const parent = nodes.value.find(node => node.id === pendingSel.value.nodeId);
  if (!parent) return;
  try {
    const mark = document.createElement("span");
    mark.className = "branch-mark";
    mark.appendChild(pendingSel.value.range.extractContents());
    pendingSel.value.range.insertNode(mark);
  } catch (_) {}

  const child = createNode({
    x: parent.x + nodeWidth(parent) + 90,
    y: parent.y + parent.children.length * 150,
    parent,
    fromText: pendingSel.value.text
  });
  placeBranchBesideParent(child, parent);
  hidePill();
  window.getSelection()?.removeAllRanges();
  revealNodeForInput(child);
}

function placeBranchBesideParent(child, parent) {
  const columns = orderedNodes.value.filter(node => node.id !== child.id);
  const parentIndex = columns.findIndex(node => node.id === parent.id);
  columns.splice(parentIndex + 1, 0, child);
  columns.forEach((node, index) => {
    node.x = index * (DEFAULT_NODE_W + NODE_GAP);
    node.y = 0;
  });
  scheduleBoardSave();
}

async function revealNodeForInput(node) {
  await nextTick();
  const column = nodeRefs.get(node.id);
  column?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  column?.querySelector("textarea")?.focus({ preventScroll: true });
  scrollNodeBody(node);
}

function handleSelectionChange() {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.toString().trim()) {
    hidePill();
    return;
  }
  const anchorEl = selection.anchorNode?.parentElement?.closest?.(".msg.assistant");
  const focusEl = selection.focusNode?.parentElement?.closest?.(".msg.assistant");
  if (!anchorEl || anchorEl !== focusEl) {
    hidePill();
    return;
  }
  const nodeEl = anchorEl.closest(".node");
  const rect = selection.getRangeAt(0).getBoundingClientRect();
  pendingSel.value = {
    nodeId: nodeEl.dataset.nodeId,
    text: selection.toString().trim(),
    range: selection.getRangeAt(0).cloneRange(),
    left: rect.left + rect.width / 2,
    top: rect.top
  };
}

function hidePill() {
  pendingSel.value = null;
}

function lineageFor(node) {
  const parts = [];
  if (node.fromText) parts.push(`Selected text: ${trim(node.fromText, 160)}`);
  let cur = nodes.value.find(item => item.id === node.parent?.id);
  let guard = 0;
  while (cur && guard++ < 4) {
    const firstUser = cur.messages.find(message => message.role === "user");
    if (firstUser) parts.unshift(trim(firstUser.text, 90));
    cur = nodes.value.find(item => item.id === cur.parent?.id);
  }
  return parts.length ? parts.join("  ->  ") : "";
}

function conversationFor(node) {
  return node.messages
    .filter(message => !message.thinking && !message.error && message.text?.trim())
    .slice(-20)
    .map(message => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: message.text.trim()
    }));
}

function focusNode(id) {
  focusedId.value = id;
}

function displayNodeLabel(id) {
  return `Note ${String(id || "").replace(/^n/, "")}`;
}

function userFacingError(error) {
  return error?.message === "Empty answer."
    ? "I got an empty answer. Please try again."
    : "I couldn't get an answer. Please try again.";
}

function nodeWidth(node) {
  return nodeRefs.get(node.id)?.offsetWidth || DEFAULT_NODE_W;
}

function nodeHeight(node) {
  return nodeRefs.get(node.id)?.offsetHeight || 200;
}

function screenToWorld(sx, sy) {
  return { x: (sx - cam.x) / cam.scale, y: (sy - cam.y) / cam.scale };
}

function centerOn(node, scale = cam.scale, persist = true) {
  cam.scale = scale;
  cam.x = window.innerWidth / 2 - (node.x + nodeWidth(node) / 2) * scale;
  cam.y = window.innerHeight / 2 - (node.y + nodeHeight(node) / 2) * scale;
  if (persist) scheduleBoardSave();
}

function fitAll() {
  if (!nodes.value.length) return;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of nodes.value) {
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x + nodeWidth(node));
    maxY = Math.max(maxY, node.y + nodeHeight(node));
  }
  const pad = 80;
  const width = maxX - minX + pad * 2;
  const height = maxY - minY + pad * 2;
  const scale = clamp(Math.min(window.innerWidth / width, window.innerHeight / height), 0.25, 1.2);
  cam.scale = scale;
  cam.x = (window.innerWidth - width * scale) / 2 - (minX - pad) * scale;
  cam.y = (window.innerHeight - height * scale) / 2 - (minY - pad) * scale;
  scheduleBoardSave();
}

function resetView() {
  const root = nodes.value[0];
  if (root) centerOn(root, 1);
}

function zoomBy(factor) {
  cam.scale = clamp(cam.scale * factor, 0.25, 2.2);
  scheduleBoardSave();
}

function startPan(event) {
  if (
    event.target.closest(".node") ||
    event.target.closest("#hud") ||
    event.target.closest("#board-controls") ||
    event.target.closest("#workspace-controls") ||
    event.target === pillEl.value
  ) return;
  isPanning.value = true;
  panState = { sx: event.clientX, sy: event.clientY, cx: cam.x, cy: cam.y };
  viewportEl.value?.setPointerCapture(event.pointerId);
  hidePill();
}

function panCanvas(event) {
  if (!isPanning.value || !panState) return;
  cam.x = panState.cx + event.clientX - panState.sx;
  cam.y = panState.cy + event.clientY - panState.sy;
  scheduleBoardSave();
}

function endPan(event) {
  isPanning.value = false;
  panState = null;
  try {
    viewportEl.value?.releasePointerCapture(event.pointerId);
  } catch (_) {}
}

function startNodeDrag(event, node) {
  if (event.target.closest("textarea,button")) return;
  dragState = { node, sx: event.clientX, sy: event.clientY, ox: node.x, oy: node.y };
  event.currentTarget.setPointerCapture(event.pointerId);
  event.currentTarget.addEventListener("pointermove", dragNode);
  event.currentTarget.addEventListener("pointerup", endNodeDrag, { once: true });
  event.currentTarget.addEventListener("pointercancel", endNodeDrag, { once: true });
  event.stopPropagation();
}

function dragNode(event) {
  if (!dragState) return;
  dragState.node.x = dragState.ox + (event.clientX - dragState.sx) / cam.scale;
  dragState.node.y = dragState.oy + (event.clientY - dragState.sy) / cam.scale;
  scheduleBoardSave();
}

function endNodeDrag(event) {
  event.currentTarget.removeEventListener("pointermove", dragNode);
  try {
    event.currentTarget.releasePointerCapture(event.pointerId);
  } catch (_) {}
  dragState = null;
  scheduleBoardSave();
}

function createNodeFromDoubleClick(event) {
  if (
    event.target.closest(".node") ||
    event.target.closest("#hud") ||
    event.target.closest("#board-controls") ||
    event.target.closest("#workspace-controls")
  ) return;
  const world = screenToWorld(event.clientX, event.clientY);
  createNode({ x: world.x - DEFAULT_NODE_W / 2, y: world.y - 40 });
}

function isTypingTarget(target) {
  return target?.closest?.("textarea,input,button,[contenteditable='true']");
}

function moveFocusedNode(dx, dy) {
  const node = nodes.value.find(item => item.id === focusedId.value);
  if (!node) return;
  node.x += dx / cam.scale;
  node.y += dy / cam.scale;
}

function handleCanvasKeyboard(event) {
  if (isTypingTarget(event.target)) return;
  const panStep = event.shiftKey ? 96 : 48;
  const moveStep = event.shiftKey ? 48 : 24;
  let dx = 0;
  let dy = 0;
  if (event.key === "ArrowLeft") dx = -1;
  else if (event.key === "ArrowRight") dx = 1;
  else if (event.key === "ArrowUp") dy = -1;
  else if (event.key === "ArrowDown") dy = 1;
  else return;
  event.preventDefault();
  if (event.altKey) {
    moveFocusedNode(dx * moveStep, dy * moveStep);
    scheduleBoardSave();
    return;
  }
  cam.x -= dx * panStep;
  cam.y -= dy * panStep;
  hidePill();
  scheduleBoardSave();
}

function autoGrow(event) {
  const textarea = event.target;
  textarea.style.height = "auto";
  textarea.style.height = `${Math.min(textarea.scrollHeight, 80)}px`;
}

function handleDraftInput(_node, event) {
  autoGrow(event);
  scheduleBoardSave();
}

function scrollNodeBody(node) {
  nodeRefs.get(node.id)?.querySelector(".node__foot")?.scrollIntoView({
    block: "end",
    inline: "nearest"
  });
}

function trim(value, length) {
  const text = value || "";
  return text.length > length ? `${text.slice(0, length - 1)}...` : text;
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function finiteNumber(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

onMounted(() => {
  document.addEventListener("selectionchange", handleSelectionChange);
  initializeBoards();
});

onBeforeUnmount(() => {
  document.removeEventListener("selectionchange", handleSelectionChange);
  clearPendingSave();
});
</script>

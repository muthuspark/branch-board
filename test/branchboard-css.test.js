import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const shell = await readFile(new URL("../index.html", import.meta.url), "utf8").catch(() => "");
const appVue = await readFile(new URL("../src/frontend/App.vue", import.meta.url), "utf8").catch(() => "");
const mainJs = await readFile(new URL("../src/frontend/main.js", import.meta.url), "utf8").catch(() => "");
const viteConfig = await readFile(new URL("../vite.config.js", import.meta.url), "utf8").catch(() => "");
const tailwindCss = await readFile(new URL("../src/frontend/styles.css", import.meta.url), "utf8").catch(() => "");
const packageJson = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8")
);
const style = [
  appVue.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? "",
  tailwindCss
].join("\n");

function ruleFor(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = style.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  return match?.[1] ?? "";
}

function functionBlock(name, nextName) {
  const match = appVue.match(new RegExp(`function ${name}\\(\\) \\{([\\s\\S]*?)\\n\\}\\n\\nfunction ${nextName}\\(`));
  return match?.[1] ?? "";
}

describe("Branchboard Vue/Vite structure", () => {
  it("uses a Vite app shell and Vue entrypoint", () => {
    assert.match(shell, /<div id="app"><\/div>/);
    assert.match(shell, /src="\/src\/frontend\/main\.js"/);
    assert.match(mainJs, /createApp\(BranchboardApp\)\.mount\("#app"\)/);
    assert.equal(packageJson.dependencies.vue.startsWith("^"), true);
    assert.equal(packageJson.devDependencies.vite.startsWith("^"), true);
    assert.equal(packageJson.devDependencies["@vitejs/plugin-vue"].startsWith("^"), true);
    assert.equal(packageJson.scripts.build, "vite build");
  });

  it("uses Tailwind CSS through the Vite pipeline", () => {
    assert.match(viteConfig, /import tailwindcss from "@tailwindcss\/vite"/);
    assert.match(viteConfig, /plugins:\s*\[tailwindcss\(\), vue\(\)\]/);
    assert.match(mainJs, /import "\.\/styles\.css"/);
    assert.equal(packageJson.devDependencies.tailwindcss.startsWith("^"), true);
    assert.equal(packageJson.devDependencies["@tailwindcss/vite"].startsWith("^"), true);
    assert.match(tailwindCss, /@import "tailwindcss"/);
    assert.match(tailwindCss, /@theme/);
    assert.match(tailwindCss, /--color-parchment:\s*#f3f1ed/);
    assert.match(tailwindCss, /--color-aubergine-black:\s*#302023/);
  });
});

describe("Branchboard cursor affordances", () => {
  it("keeps reading and writing surfaces text-selectable", () => {
    assert.match(ruleFor(".node__body"), /cursor\s*:\s*text/);
    assert.match(ruleFor(".msg"), /cursor\s*:\s*text/);
    assert.match(ruleFor(".node__foot textarea"), /cursor\s*:\s*text/);
  });

  it("keeps assistant markdown tables structured and legible", () => {
    assert.match(ruleFor(".msg.assistant table"), /border-collapse\s*:\s*collapse/);
    assert.match(ruleFor(".msg.assistant th, .msg.assistant td"), /border\s*:\s*1px\s+solid\s+var\(--color-bone\)/);
    assert.match(ruleFor(".msg.assistant th"), /background\s*:\s*var\(--color-pure-white\)/);
  });
});

describe("Branchboard chat workspace", () => {
  it("uses horizontal chat columns instead of canvas navigation", () => {
    assert.match(appVue, /id="chat-workspace"/);
    assert.match(appVue, /class="chat-columns"/);
    assert.match(appVue, /v-for="node in orderedNodes"/);
    assert.match(appVue, /const orderedNodes = computed/);
    assert.doesNotMatch(appVue, /id="btn-zoomout"/);
    assert.doesNotMatch(appVue, /id="viewport"/);
    assert.match(ruleFor(".chat-columns"), /overflow-x\s*:\s*auto/);
  });
});

describe("Branchboard accessibility hardening", () => {
  it("labels dynamic chat inputs and keyboard branch controls", () => {
    assert.match(appVue, /class="sr-only"/);
    assert.match(appVue, /aria-label="Explore selected answer text"/);
    assert.match(appVue, /:data-node-id="node\.id"/);
    assert.match(appVue, /:aria-label="node\.parent \? 'Ask about this branch' : 'Ask your first question'"/);
    assert.match(appVue, /tabindex="0"/);
    assert.match(appVue, /role="group"/);
  });

  it("does not reserve arrow keys for spatial navigation", () => {
    assert.doesNotMatch(appVue, /window\.addEventListener\("keydown", handleCanvasKeyboard\)/);
  });
});

describe("Branchboard node deletion", () => {
  it("places branch deletion in its source strip", () => {
    const branchSource = appVue.match(/<div v-if="node\.parent" class="branch-source">([\s\S]*?)<\/div>/)?.[0] ?? "";

    assert.match(branchSource, /type="button"/);
    assert.match(branchSource, /class="node__delete"/);
    assert.match(branchSource, /aria-label="Delete chat"/);
    assert.match(branchSource, /title="Delete chat"/);
    assert.match(branchSource, /@click\.stop="deleteNode\(node\)"/);
    assert.match(branchSource, /<Trash2/);
    assert.match(ruleFor(".node__delete"), /width\s*:\s*28px/);
  });

  it("deletes the selected node with descendants, connected edges, focus, and pending branch UI", () => {
    assert.match(appVue, /function collectNodeAndDescendantIds\(node\)/);
    assert.match(appVue, /const idsToDelete = collectNodeAndDescendantIds\(node\)/);
    assert.match(appVue, /nodes\.value = nodes\.value\.filter\(item => !idsToDelete\.has\(item\.id\)\)/);
    assert.match(appVue, /edges\.value = edges\.value\.filter\(edge => !idsToDelete\.has\(edge\.from\) && !idsToDelete\.has\(edge\.to\)\)/);
    assert.match(appVue, /if \(focusedId\.value && idsToDelete\.has\(focusedId\.value\)\)/);
    assert.match(appVue, /hidePill\(\)/);
    assert.match(appVue, /scheduleBoardSave\(\)/);
  });
});

describe("Branchboard destructive confirmations", () => {
  it("uses an in-app HTML dialog instead of browser confirm boxes", () => {
    assert.match(appVue, /<div\s+v-if="confirmDialog\.open"\s+class="confirm"/);
    assert.match(appVue, /role="dialog"/);
    assert.match(appVue, /aria-modal="true"/);
    assert.match(appVue, /@click\.self="resolveConfirm\(false\)"/);
    assert.match(appVue, /class="confirm__button danger"/);
    assert.match(appVue, /function confirmDestructiveAction\(\{ title, message, confirmLabel \}\)/);
    assert.match(appVue, /function resolveConfirm\(confirmed\)/);
    assert.doesNotMatch(appVue, /window\.confirm/);
  });

  it("routes both board and node deletion through the shared confirmation dialog", () => {
    assert.match(appVue, /if \(!await confirmDestructiveAction\(\{\s*title: "Delete board"/);
    assert.match(appVue, /if \(!await confirmDestructiveAction\(\{\s*title: "Delete note"/);
    assert.match(appVue, /confirmLabel: "Delete board"/);
    assert.match(appVue, /confirmLabel: "Delete note"/);
  });

  it("traps keyboard focus and restores it after the dialog closes", () => {
    assert.match(appVue, /@keydown="handleConfirmKeydown"/);
    assert.match(appVue, /focusBeforeConfirm = document\.activeElement/);
    assert.match(appVue, /event\.key !== "Tab"/);
    assert.match(appVue, /focusBeforeConfirm\?\.focus\?\.\(\)/);
  });
});

describe("Branchboard first screen", () => {
  it("starts with an empty root prompt instead of a seeded question", () => {
    assert.doesNotMatch(appVue, /How does a transformer model actually work\?/);
    assert.match(appVue, /Ask your first question/);
    assert.match(appVue, /createRootNode\(\)/);
  });
});

describe("Branchboard multiple board persistence", () => {
  it("provides one board switcher with contextual rename and delete actions", () => {
    assert.match(appVue, /id="workspace-controls"/);
    assert.match(appVue, /id="board-switcher"/);
    assert.match(appVue, /v-model="activeBoardId"/);
    assert.match(appVue, /@change="openSelectedBoard"/);
    assert.match(appVue, /@click="openNewBoardDialog"/);
    assert.match(appVue, /@click="startBoardRename"/);
    assert.match(appVue, /v-if="isRenamingBoard"/);
    assert.match(appVue, /@keydown\.escape\.prevent="cancelBoardRename"/);
    assert.match(appVue, /@click="deleteActiveBoard"/);
  });

  it("keeps board actions together in the masthead", () => {
    assert.match(appVue, /<div id="workspace-controls"/);
    assert.match(appVue, /id="board-switcher"/);
    assert.match(appVue, /class="new-board"/);
    assert.match(appVue, /class="board-actions"/);
    assert.match(appVue, /@click="deleteActiveBoard"/);
    assert.match(appVue, /class="board-action danger"/);
  });

  it("uses one native board menu rather than nested menus", () => {
    assert.doesNotMatch(appVue, /<details id="board-controls"/);
    assert.doesNotMatch(appVue, /id="board-menu"/);
  });

  it("uses the active board title as the top-left workspace identity", () => {
    assert.doesNotMatch(appVue, /id="brand"/);
    assert.doesNotMatch(appVue, /<h1>Branchboard<\/h1>/);
    assert.match(ruleFor("#workspace-controls"), /display\s*:\s*flex/);
    assert.match(appVue, /id="board-switcher"/);
    assert.doesNotMatch(appVue, /id="save-status"/);
    assert.doesNotMatch(appVue, /Answers paused/);
  });

  it("loads persisted boards on startup before falling back to a root node", () => {
    assert.match(appVue, /async function initializeBoards\(\)/);
    assert.match(appVue, /(?:fetchJson|fetch)\("\/api\/boards"\)/);
    assert.match(appVue, /await createNewBoard\(\)/);
    assert.match(appVue, /createRootNode\(\)/);
    assert.match(appVue, /onMounted\([\s\S]*initializeBoards\(\)[\s\S]*\)/);
    assert.match(appVue, /nextTick\(ensureRestoredBoardVisible\)/);
  });

  it("restores saved chats into the chat workspace", () => {
    assert.match(appVue, /function restoreBoardState\(state\)/);
    assert.match(appVue, /focusNode\(nodes\.value\[0\]\.id\)/);
  });

  it("serializes board state without parent cycles and debounces active board saves", () => {
    assert.match(appVue, /function serializeBoardState\(\)/);
    assert.match(appVue, /parentId:\s*node\.parent\?\.id\s*\|\|\s*null/);
    assert.doesNotMatch(appVue, /parent:\s*node\.parent/);
    assert.match(appVue, /function restoreBoardState\(state\)/);
    assert.match(appVue, /function scheduleBoardSave\(\)/);
    assert.match(appVue, /setTimeout\(saveActiveBoard,\s*350\)/);
    assert.match(appVue, /\/api\/boards\/\$\{snapshot\.boardId\}/);
  });

  it("uses explicit snapshots and stale guards for board persistence races", () => {
    assert.match(appVue, /const committedBoardId = ref\(""\)/);
    assert.match(appVue, /function captureActiveBoardSnapshot\(\)/);
    assert.match(appVue, /async function flushActiveBoardSave\(\)/);
    assert.match(appVue, /async function saveBoardSnapshot\(snapshot, \{ updateUi = true \} = \{\}\)/);
    assert.match(appVue, /\/api\/boards\/\$\{snapshot\.boardId\}/);
    assert.match(appVue, /state: snapshot\.state/);
    assert.match(appVue, /if \(updateUi && snapshot\.boardId !== committedBoardId\.value\) return true/);
    assert.match(appVue, /activeBoardId\.value = committedBoardId\.value/);
    assert.match(appVue, /await flushActiveBoardSave\(\)/);
  });

  it("serializes overlapping saves per board and keeps only the latest queued snapshot", () => {
    assert.match(appVue, /const inFlightBoardSaves = new Map\(\)/);
    assert.match(appVue, /const queuedBoardSaves = new Map\(\)/);
    assert.match(appVue, /queuedBoardSaves\.set\(snapshot\.boardId, \{ snapshot, updateUi \}\)/);
    assert.match(appVue, /async function waitForBoardSaveIdle\(boardId\)/);
    assert.match(appVue, /async function processBoardSaveQueue\(boardId, initialRequest\)/);
    assert.match(appVue, /while \(request\)/);
    assert.match(appVue, /queuedBoardSaves\.get\(boardId\)/);
    assert.match(appVue, /queuedBoardSaves\.delete\(boardId\)/);
    assert.match(appVue, /await persistBoardSnapshot\(request\.snapshot, \{ updateUi: request\.updateUi \}\)/);
    assert.match(appVue, /return waitForBoardSaveIdle\(committedBoardId\.value\)/);
  });

  it("ties chat responses to their originating board and node", () => {
    assert.match(appVue, /const requestBoardId = committedBoardId\.value/);
    assert.match(appVue, /const requestNodeId = node\.id/);
    assert.match(appVue, /const history = conversationFor\(node\)/);
    assert.match(appVue, /streamLLM\(question, lineageFor\(node\), history, \{/);
    assert.match(appVue, /appendMessageTextForBoard\(requestBoardId, requestNodeId, thinking\.id/);
    assert.match(appVue, /if \(boardId !== committedBoardId\.value\) return/);
    assert.match(appVue, /const node = nodes\.value\.find\(item => item\.id === nodeId\)/);
  });

  it("streams assistant responses instead of waiting for complete JSON", () => {
    assert.match(appVue, /async function streamLLM\(question, lineage, history, \{ onDelta \}\)/);
    assert.match(appVue, /JSON\.stringify\(\{ question, lineage, history \}\)/);
    assert.match(appVue, /response\.body\.getReader\(\)/);
    assert.match(appVue, /TextDecoder/);
    assert.match(appVue, /parseStreamEvent/);
    assert.doesNotMatch(appVue, /const data = await response\.json\(\)/);
    assert.doesNotMatch(appVue, /const text = \(data\.text \|\| ""\)\.trim\(\)/);
  });

  it("creates selected-text branches as context and waits for the user's question", () => {
    const branchFromSelection = functionBlock("branchFromSelection", "handleSelectionChange");

    assert.match(branchFromSelection, /fromText:\s*pendingSel\.value\.text/);
    assert.doesNotMatch(branchFromSelection, /child\.messages\.push\(plainMessage\("user", pendingSel\.value\.text\)\)/);
    assert.doesNotMatch(branchFromSelection, /callLLM\(/);
    assert.doesNotMatch(branchFromSelection, /Expand on it/);
    assert.match(branchFromSelection, /revealNodeForInput\(child\)/);
  });

  it("reveals a new branch column after render and focuses its prompt", () => {
    assert.match(appVue, /async function revealNodeForInput\(node\)/);
    assert.match(appVue, /await nextTick\(\)/);
    assert.match(appVue, /scrollIntoView\(\{ behavior: "smooth", block: "nearest", inline: "nearest" \}\)/);
    assert.match(appVue, /querySelector\("textarea"\)\?\.focus\(\{ preventScroll: true \}\)/);
  });

  it("places new notes on open grid-aligned space without moving existing notes", () => {
    assert.match(appVue, /const position = findOpenNodePosition\(x, y\)/);
    assert.match(appVue, /function findOpenNodePosition\(preferredX, preferredY\)/);
    assert.match(appVue, /nodes\.value\.every\(node => !nodeRectanglesOverlap\(candidate, node\)\)/);
    assert.match(appVue, /function nodeRectanglesOverlap\(candidate, node\)/);
    assert.match(appVue, /Math\.round\(value \/ 24\) \* 24/);
    assert.match(appVue, /const NODE_GAP = 72/);
  });

  it("includes selected branch text as context when the user asks from a child node", () => {
    assert.match(appVue, /function lineageFor\(node\)/);
    assert.match(appVue, /node\.fromText/);
    assert.match(appVue, /Selected text: \$\{trim\(node\.fromText, 160\)\}/);
  });

  it("includes prior messages from the same note as conversation context", () => {
    assert.match(appVue, /function conversationFor\(node\)/);
    assert.match(appVue, /\.filter\(message => !message\.thinking && !message\.error/);
    assert.match(appVue, /\.slice\(-20\)/);
    assert.match(appVue, /content: message\.text\.trim\(\)/);
  });

  it("persists canonical message fields and regenerates message HTML", () => {
    assert.match(appVue, /function serializeMessage\(message\)/);
    assert.doesNotMatch(appVue, /messages: node\.messages\.map\(message => \(\{ \.\.\.message \}\)\)/);
    assert.match(appVue, /html: renderMessageHtml\(role, text\)/);
    assert.match(appVue, /function renderMessageHtml\(role, text\)/);
    assert.doesNotMatch(appVue, /html: message\?\.html/);
    assert.doesNotMatch(appVue, /message\?\.thinking \? \{ thinking: true \}/);
  });
});

describe("Branchboard model failures", () => {
  it("does not replace model failures with fake canned answers", () => {
    assert.doesNotMatch(appVue, /function mockAnswer/);
    assert.doesNotMatch(appVue, /At its core,/);
    assert.match(appVue, /I couldn't get an answer\. Please try again\./);
  });
});

describe("Branchboard answer loading state", () => {
  it("prevents overlapping requests within one note and exposes its busy state", () => {
    assert.match(appVue, /:aria-busy="node\.pending"/);
    assert.match(appVue, /:disabled="node\.pending \|\| !node\.draft\.trim\(\)"/);
    assert.match(appVue, /if \(node\.pending\) return/);
    assert.match(appVue, /node\.pending = true/);
    assert.match(appVue, /requestNode\.pending = false/);
  });
});

describe("Branchboard plain-language copy", () => {
  it("uses non-technical visible labels for everyday users", () => {
    assert.match(appVue, /New board/);
    assert.match(appVue, /Main chat/);
    assert.match(appVue, /Explore this/);
    assert.doesNotMatch(appVue, /\+ New question/);
    assert.doesNotMatch(appVue, /id="btn-new"/);
    assert.match(appVue, /class="new-board"/);
    assert.match(appVue, /class="board-action danger"/);
    assert.doesNotMatch(appVue, />New board<\/button>/);
    assert.doesNotMatch(appVue, />Show all<\/button>/);
    assert.doesNotMatch(appVue, />Smaller<\/button>/);
    assert.doesNotMatch(appVue, />Bigger<\/button>/);
    assert.doesNotMatch(appVue, />Center<\/button>/);
    assert.doesNotMatch(appVue, />Delete board<\/button>/);
    assert.match(appVue, /displayNodeLabel\(node\.id\)/);
    assert.doesNotMatch(appVue, /Root thread|New root|Fit all|deepseek v4|local demo|pan the canvas|card's header/i);
  });
});

describe("Branchboard markdown rendering", () => {
  it("renders answers through the shared markdown sanitizer", () => {
    assert.match(appVue, /import \{ marked \} from "marked"/);
    assert.match(appVue, /import DOMPurify from "dompurify"/);
    assert.match(appVue, /from "\.\.\/\.\.\/public\/markdown-renderer\.js"/);
    assert.match(appVue, /renderAssistantMarkdown\(answer, marked, DOMPurify, katex\)/);
    assert.match(appVue, /v-html="message\.html"/);
  });
});

describe("Branchboard responsive hardening", () => {
  it("uses responsive node sizing and touch targets", () => {
    assert.match(appVue, /const DEFAULT_NODE_W = 440/);
    assert.match(ruleFor(".node"), /flex\s*:\s*0\s+0\s+min\(380px/);
    assert.match(ruleFor(".ask"), /min-height\s*:\s*42px/);
    assert.match(style, /#pill\s*\{[^}]*min-height\s*:\s*38px/);
    assert.match(style, /@media \(max-width: 700px\)/);
    assert.match(style, /flex-basis: calc\(100vw - 48px\)/);
  });

  it("keeps board controls separate from reading space", () => {
    assert.match(appVue, /id="workspace-controls"/);
    assert.doesNotMatch(appVue, /id="bottom-controls"/);
    assert.match(ruleFor(".edition-masthead"), /border-bottom\s*:\s*1px\s+solid\s+var\(--color-bone\)/);
    assert.match(ruleFor("#workspace-controls"), /min-width\s*:\s*0/);
  });
});

describe("Branchboard control icons", () => {
  it("uses Lucide icons for board and chat actions", () => {
    assert.equal(packageJson.dependencies["@lucide/vue"].startsWith("^"), true);
    assert.match(appVue, /from "@lucide\/vue"/);
    assert.match(appVue, /<FilePlus2/);
    assert.match(appVue, /<Trash2/);
    assert.match(appVue, /aria-hidden="true"/);
    assert.match(appVue, /@click="deleteActiveBoard"/);
  });
});

describe("Branchboard token coverage", () => {
  it("uses semantic tokens for secondary surfaces and states", () => {
    assert.match(style, /--surface-code:/);
    assert.match(style, /--surface-error:/);
    assert.match(style, /--selection:/);
    assert.match(style, /--focus:/);
    assert.match(ruleFor(".msg.assistant code"), /background\s*:\s*var\(--surface-code\)/);
    assert.match(ruleFor(".msg.assistant.error"), /background\s*:\s*var\(--surface-error\)/);
  });

  it("uses semantic typography tokens for dense product UI text", () => {
    assert.match(style, /--font-main:/);
    assert.match(ruleFor(".msg"), /font-size\s*:\s*15px/);
    assert.match(ruleFor(".msg"), /line-height\s*:\s*1\.55/);
    assert.match(ruleFor(".branch-source"), /font-size\s*:\s*13px/);
  });
});

describe("Branchboard visual style", () => {
  it("uses the restrained parchment dossier treatment", () => {
    assert.doesNotMatch(style, /linear-gradient|radial-gradient/);
    assert.match(ruleFor("#chat-workspace"), /background\s*:\s*var\(--color-parchment\)/);
    assert.match(ruleFor(".node"), /border-left\s*:\s*1px\s+solid\s+var\(--color-bone\)/);
    assert.match(ruleFor(".msg.user"), /border-bottom\s*:\s*1px\s+solid\s+var\(--color-ink-black\)/);
    assert.match(ruleFor(".new-board, .board-action, .confirm__button, .ask, #pill"), /border-radius\s*:\s*100px/);
  });
});

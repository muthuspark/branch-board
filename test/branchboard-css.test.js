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
    assert.match(tailwindCss, /--color-ink:\s*oklch\(13% 0\.006 245\)/);
    assert.match(tailwindCss, /--accent:\s*oklch\(76% 0\.12 78\)/);
    assert.match(tailwindCss, /@layer components/);
    assert.match(ruleFor(".node"), /@apply/);
  });
});

describe("Branchboard cursor affordances", () => {
  it("limits the draggable cursor to the node header", () => {
    assert.match(ruleFor("#viewport"), /cursor\s*:\s*grab/);
    assert.match(ruleFor(".node"), /cursor\s*:\s*default/);
    assert.match(ruleFor(".node__bar"), /cursor\s*:\s*grab/);
  });

  it("keeps readable node content text-selectable by cursor affordance", () => {
    assert.match(ruleFor(".node__body"), /cursor\s*:\s*text/);
    assert.match(ruleFor(".msg"), /cursor\s*:\s*text/);
    assert.match(ruleFor(".node__foot textarea"), /cursor\s*:\s*text/);
  });

  it("styles the node body scrollbar as an embedded dark control", () => {
    assert.match(ruleFor(".node__body"), /scrollbar-color\s*:\s*var\(--scrollbar-thumb\)\s+var\(--scrollbar-track\)/);
    assert.match(ruleFor(".node__body::-webkit-scrollbar"), /width\s*:\s*14px/);
    assert.match(ruleFor(".node__body::-webkit-scrollbar-track"), /background\s*:\s*var\(--scrollbar-track\)/);
    assert.match(ruleFor(".node__body::-webkit-scrollbar-thumb"), /background\s*:\s*var\(--scrollbar-thumb\)/);
    assert.match(ruleFor(".node__body::-webkit-scrollbar-thumb"), /border-radius\s*:\s*var\(--radius-pill\)/);
  });

  it("keeps assistant markdown tables readable inside answer bubbles", () => {
    assert.match(ruleFor(".msg.assistant table"), /display\s*:\s*block/);
    assert.match(ruleFor(".msg.assistant table"), /overflow-x\s*:\s*auto/);
    assert.match(ruleFor(".msg.assistant table"), /scrollbar-color\s*:\s*var\(--scrollbar-thumb\)\s+var\(--card-2\)/);
    assert.match(ruleFor(".msg.assistant th,\n  .msg.assistant td"), /min-width\s*:\s*8rem/);
    assert.match(ruleFor(".msg.assistant th,\n  .msg.assistant td"), /overflow-wrap\s*:\s*break-word/);
    assert.match(ruleFor(".msg.assistant thead"), /background\s*:\s*var\(--paper\)/);
  });
});

describe("Branchboard wheel interactions", () => {
  it("disables wheel and pinch zoom while retaining explicit zoom controls", () => {
    assert.doesNotMatch(appVue, /@wheel/);
    assert.doesNotMatch(appVue, /function handleViewportWheel/);
    assert.doesNotMatch(appVue, /function zoomCanvas/);
    assert.match(appVue, /id="btn-zoomout"[\s\S]*@click="zoomBy\(1 \/ 1\.15\)"/);
    assert.match(appVue, /id="btn-zoomin"[\s\S]*@click="zoomBy\(1\.15\)"/);
    assert.match(appVue, /use <b>− \/ \+<\/b> to zoom/);
  });
});

describe("Branchboard accessibility hardening", () => {
  it("labels dynamic chat inputs and keyboard branch controls", () => {
    assert.match(appVue, /class="sr-only"/);
    assert.match(appVue, /aria-label="Explore selected answer text"/);
    assert.match(appVue, /:data-node-id="node\.id"/);
    assert.match(appVue, /:aria-label="node\.parent \? 'Ask about this note' : 'Ask your first question'"/);
    assert.match(appVue, /tabindex="0"/);
    assert.match(appVue, /role="group"/);
  });

  it("supports keyboard movement for canvas and focused nodes", () => {
    assert.match(appVue, /function handleCanvasKeyboard\(event\)/);
    assert.match(appVue, /window\.addEventListener\("keydown", handleCanvasKeyboard\)/);
    assert.match(appVue, /event\.altKey/);
    assert.match(appVue, /moveFocusedNode\(dx, dy\)/);
    assert.match(appVue, /ArrowLeft/);
  });
});

describe("Branchboard node deletion", () => {
  it("provides a quiet destructive action in each node header", () => {
    const nodeBar = appVue.match(/<div class="node__bar"[\s\S]*?<\/div>\n\n\s*<div class="node__body"/)?.[0] ?? "";

    assert.match(nodeBar, /type="button"/);
    assert.match(nodeBar, /class="node__delete"/);
    assert.match(nodeBar, /aria-label="Delete note"/);
    assert.match(nodeBar, /title="Delete note"/);
    assert.match(nodeBar, /@pointerdown\.stop/);
    assert.match(nodeBar, /@click\.stop="deleteNode\(node\)"/);
    assert.match(nodeBar, /<Trash2/);
    assert.match(ruleFor(".node__delete"), /min-height\s*:\s*32px/);
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
    assert.match(appVue, /id="board-controls"/);
    assert.match(appVue, /id="workspace-controls"/);
    assert.match(appVue, /v-model="activeBoardId"/);
    assert.match(appVue, /@change="openSelectedBoard"/);
    assert.match(appVue, /@click="createNewBoard"/);
    assert.match(appVue, /@click="startBoardRename"/);
    assert.match(appVue, /v-if="isRenamingBoard"/);
    assert.match(appVue, /@keydown\.enter\.prevent="finishBoardRename"/);
    assert.match(appVue, /@keydown\.escape\.prevent="cancelBoardRename"/);
    assert.match(appVue, /@click="deleteActiveBoard"/);
  });

  it("keeps destructive board actions out of the canvas toolbar", () => {
    const bottomControls = appVue.match(/<div id="bottom-controls">([\s\S]*?)<\/div>\n\s*<\/div>/)?.[1] ?? "";
    const boardControls = appVue.match(/<details id="board-controls"([\s\S]*?)<\/details>/)?.[1] ?? "";

    assert.match(appVue, /<div id="workspace-controls"/);
    assert.doesNotMatch(bottomControls, /id="board-controls"/);
    assert.match(bottomControls, /id="hud"/);
    assert.doesNotMatch(bottomControls, /deleteActiveBoard/);
    assert.doesNotMatch(bottomControls, /id="btn-delete-board"/);
    assert.match(boardControls, /<summary/);
    assert.match(boardControls, /id="board-menu"/);
    assert.match(boardControls, /@click="createNewBoard"/);
    assert.match(boardControls, /@click="deleteActiveBoard"/);
    assert.match(boardControls, /class="board-menu__button danger"/);
  });

  it("keeps open board menus visually quiet instead of adding nested amber frames", () => {
    assert.doesNotMatch(ruleFor("#board-controls[open] summary"), /border-color\s*:\s*var\(--focus\)/);
  });

  it("uses the active board title as the top-left workspace identity", () => {
    const boardControls = appVue.match(/<details id="board-controls"([\s\S]*?)<\/details>/)?.[1] ?? "";
    const modeControls = appVue.match(/<div id="mode"[\s\S]*?<\/div>/)?.[0] ?? "";

    assert.doesNotMatch(appVue, /id="brand"/);
    assert.doesNotMatch(appVue, /<h1>Branchboard<\/h1>/);
    assert.match(ruleFor("#workspace-controls"), /@apply[^}]*top-\[18px\]/);
    assert.match(boardControls, /<summary aria-label="Open board history"/);
    assert.match(boardControls, /id="board-title"/);
    assert.doesNotMatch(boardControls, /id="save-status"/);
    assert.match(modeControls, /id="save-status"/);
  });

  it("loads persisted boards on startup before falling back to a root node", () => {
    assert.match(appVue, /async function initializeBoards\(\)/);
    assert.match(appVue, /(?:fetchJson|fetch)\("\/api\/boards"\)/);
    assert.match(appVue, /await createNewBoard\(\)/);
    assert.match(appVue, /createRootNode\(\)/);
    assert.match(appVue, /onMounted\([\s\S]*initializeBoards\(\)[\s\S]*\)/);
    assert.match(appVue, /nextTick\(ensureRestoredBoardVisible\)/);
  });

  it("recovers saved camera states that reopen as an empty black canvas", () => {
    assert.match(appVue, /function ensureRestoredBoardVisible\(\)/);
    assert.match(appVue, /if \(cam\.scale <= 0\.35\)/);
    assert.match(appVue, /centerOn\(nodes\.value\[0\], 0\.75\)/);
    assert.match(appVue, /const hasVisibleNode = nodes\.value\.some/);
    assert.match(appVue, /if \(!hasVisibleNode\) centerOn\(nodes\.value\[0\], Math\.max\(cam\.scale, 0\.75\)\)/);
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

  it("centers a new branch after render and focuses its prompt without changing zoom", () => {
    assert.match(appVue, /async function revealNodeForInput\(node\)/);
    assert.match(appVue, /await nextTick\(\)/);
    assert.match(appVue, /centerOn\(node, cam\.scale\)/);
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
    assert.match(appVue, /Ready/);
    assert.match(appVue, /Answers paused/);
    assert.match(appVue, /Start here/);
    assert.match(appVue, /Explore this/);
    assert.doesNotMatch(appVue, /\+ New question/);
    assert.doesNotMatch(appVue, /id="btn-new"/);
    assert.match(appVue, /aria-label="New board"/);
    assert.match(appVue, /aria-label="Show all"/);
    assert.match(appVue, /aria-label="Smaller"/);
    assert.match(appVue, /aria-label="Bigger"/);
    assert.match(appVue, /aria-label="Center"/);
    assert.match(appVue, /aria-label="Delete board"/);
    assert.doesNotMatch(appVue, />New board<\/button>/);
    assert.doesNotMatch(appVue, />Show all<\/button>/);
    assert.doesNotMatch(appVue, />Smaller<\/button>/);
    assert.doesNotMatch(appVue, />Bigger<\/button>/);
    assert.doesNotMatch(appVue, />Center<\/button>/);
    assert.doesNotMatch(appVue, />Delete board<\/button>/);
    assert.match(appVue, /displayNodeLabel\(node\.id\)/);
    assert.match(appVue, /<b>Drag<\/b> empty space to move around/);
    assert.match(appVue, /use <b>− \/ \+<\/b> to zoom/);
    assert.doesNotMatch(appVue, /Root thread|New root|Fit all|deepseek v4|local demo|Branch on this|pan the canvas|card's header/i);
  });
});

describe("Branchboard markdown rendering", () => {
  it("renders answers through the shared markdown sanitizer", () => {
    assert.match(appVue, /import \{ marked \} from "marked"/);
    assert.match(appVue, /import DOMPurify from "dompurify"/);
    assert.match(appVue, /from "\.\.\/\.\.\/public\/markdown-renderer\.js"/);
    assert.match(appVue, /renderAssistantMarkdown\(answer, marked, DOMPurify\)/);
    assert.match(appVue, /v-html="message\.html"/);
  });
});

describe("Branchboard responsive hardening", () => {
  it("uses responsive node sizing and touch targets", () => {
    assert.match(appVue, /const DEFAULT_NODE_W = 440/);
    assert.match(style, /--node-w\s*:\s*440px/);
    assert.match(style, /--node-max-w\s*:\s*90vw/);
    assert.match(style, /--node-min-h\s*:\s*80vh/);
    assert.match(style, /--node-max-h\s*:\s*calc\(100dvh - 32px\)/);
    assert.match(ruleFor(".node"), /width\s*:\s*min\(var\(--node-w\),var\(--node-max-w\)\)/);
    assert.match(ruleFor(".node"), /max-width\s*:\s*var\(--node-max-w\)/);
    assert.match(ruleFor(".node"), /min-height\s*:\s*var\(--node-min-h\)/);
    assert.match(ruleFor(".node"), /max-height\s*:\s*var\(--node-max-h\)/);
    assert.match(ruleFor(".node__body"), /flex\s*:\s*1\s+1\s+auto/);
    assert.match(ruleFor(".ask"), /min-height\s*:\s*44px/);
    assert.match(ruleFor("#pill"), /min-height\s*:\s*44px/);
    assert.match(style, /@media\s*\(max-width:640px\)/);
    assert.match(style, /--node-w\s*:\s*min\(440px,90vw\)/);
  });

  it("keeps bottom controls focused on canvas actions", () => {
    assert.match(appVue, /id="bottom-controls"/);
    assert.match(appVue, /id="workspace-controls"/);
    assert.doesNotMatch(appVue, /<div class="sep"><\/div>\s*<button id="btn-fit"/);
    assert.match(ruleFor("#bottom-controls"), /@apply[^}]*fixed/);
    assert.match(ruleFor("#bottom-controls"), /@apply[^}]*left-5/);
    assert.match(ruleFor("#bottom-controls"), /@apply[^}]*top-\[76px\]/);
    assert.match(ruleFor("#bottom-controls"), /@apply[^}]*flex-col/);
    assert.doesNotMatch(ruleFor("#bottom-controls"), /bottom-\[18px\]/);
    assert.doesNotMatch(ruleFor("#bottom-controls"), /left-1\/2/);
    assert.doesNotMatch(ruleFor("#bottom-controls"), /transform\s*:\s*translateX/);
    assert.doesNotMatch(ruleFor("#hud"), /fixed/);
    assert.match(ruleFor("#hud"), /@apply[^}]*flex-col/);
    assert.match(ruleFor("#workspace-controls"), /@apply[^}]*fixed/);
    assert.match(ruleFor("#board-menu"), /position\s*:\s*absolute/);
    assert.match(style, /@media \(max-width:640px\)[\s\S]*#bottom-controls/);
  });
});

describe("Branchboard canvas control icons", () => {
  it("uses Lucide icons for canvas HUD actions with accessible names", () => {
    assert.equal(packageJson.dependencies["@lucide/vue"].startsWith("^"), true);
    assert.match(appVue, /from "@lucide\/vue"/);
    assert.match(appVue, /<FilePlus2/);
    assert.match(appVue, /<Maximize/);
    assert.match(appVue, /<ZoomOut/);
    assert.match(appVue, /<ZoomIn/);
    assert.match(appVue, /<LocateFixed/);
    assert.match(appVue, /<Trash2/);
    assert.match(appVue, /aria-hidden="true"/);
    assert.match(appVue, /title="New board"/);
    assert.match(appVue, /title="Show all"/);
    assert.match(appVue, /title="Smaller"/);
    assert.match(appVue, /title="Bigger"/);
    assert.match(appVue, /title="Center"/);
    assert.match(appVue, /title="Delete board"/);
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
    assert.match(style, /--type-body:\s*1rem/);
    assert.match(style, /--type-label:\s*0\.875rem/);
    assert.match(style, /--type-mono:\s*0\.75rem/);
    assert.match(ruleFor(".msg"), /font-size\s*:\s*var\(--type-body\)/);
    assert.match(ruleFor(".msg"), /line-height\s*:\s*var\(--leading-body\)/);
    assert.match(ruleFor(".node__id"), /font-variant-numeric\s*:\s*tabular-nums/);
  });
});

describe("Branchboard visual style", () => {
  it("uses a monochrome engineering workstation stylesheet", () => {
    assert.doesNotMatch(style, /hsl\(/);
    assert.doesNotMatch(style, /#5865F2|#2ED47A|#8f9bff/i);
    assert.match(ruleFor(".node"), /border-radius\s*:\s*2px/);
    assert.match(ruleFor(".node"), /box-shadow\s*:\s*none/);
    assert.match(ruleFor(".node"), /border\s*:\s*1px\s+solid\s+var\(--line\)/);
    assert.match(ruleFor("#viewport"), /background-color\s*:\s*var\(--ink\)/);
    assert.doesNotMatch(ruleFor("#viewport"), /linear-gradient|radial-gradient|background-size/);
    assert.doesNotMatch(ruleFor("#viewport::after"), /radial-gradient/);
    assert.equal(ruleFor(".node::before"), "");
    assert.match(ruleFor(".msg.user"), /border\s*:\s*1px\s+solid\s+var\(--line-strong\)/);
  });
});

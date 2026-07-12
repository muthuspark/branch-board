import express from "express";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ChatOpenAI } from "@langchain/openai";
import { createAgent, tool } from "langchain";

import { createBoardStore } from "./board-store.js";
import { createFileLogger } from "./file-logger.js";

const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
const MODEL = "deepseek-v4-flash";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");

export function createApp({ env = process.env, fetchImpl = fetch, agentFactory = createDeepSeekAgent } = {}) {
  const app = express();
  const logger = createFileLogger(env.LOG_FILE || path.join(rootDir, "logs", "branchboard.log"));
  const boardStore = createBoardStore({
    dbFile: env.SQLITE_DB_FILE || path.join(rootDir, "data", "branchboard.sqlite")
  });
  let closed = false;

  app.locals.boardStore = boardStore;
  app.locals.close = () => {
    if (!closed) {
      closed = true;
      boardStore.close();
    }
  };

  app.use(express.json({ limit: "64kb" }));

  app.get("/api/boards", (_req, res) => {
    res.json({ boards: app.locals.boardStore.listBoards() });
  });

  app.post("/api/boards", (req, res) => {
    try {
      const board = app.locals.boardStore.createBoard({
        title: req.body?.title,
        state: req.body?.state
      });
      res.status(201).json(board);
    } catch (error) {
      if (error?.message === "Invalid board state.") {
        return res.status(400).json({ error: "Invalid board state." });
      }
      return res.status(500).json({ error: "Could not save board." });
    }
  });

  app.get("/api/boards/:id", (req, res) => {
    const board = app.locals.boardStore.getBoard(req.params.id);
    if (!board) {
      return res.status(404).json({ error: "Board not found." });
    }
    res.json(board);
  });

  app.put("/api/boards/:id", (req, res) => {
    try {
      const board = app.locals.boardStore.updateBoard(req.params.id, {
        title: req.body?.title,
        state: req.body?.state
      });
      if (!board) {
        return res.status(404).json({ error: "Board not found." });
      }
      res.json(board);
    } catch (error) {
      if (error?.message === "Invalid board state.") {
        return res.status(400).json({ error: "Invalid board state." });
      }
      return res.status(500).json({ error: "Could not save board." });
    }
  });

  app.delete("/api/boards/:id", (req, res) => {
    if (!app.locals.boardStore.deleteBoard(req.params.id)) {
      return res.status(404).json({ error: "Board not found." });
    }
    res.status(204).end();
  });

  app.post("/api/chat", async (req, res) => {
    const requestId = randomUUID();
    const startedAt = Date.now();
    const question = String(req.body?.question ?? "").trim();
    const lineage = String(req.body?.lineage ?? "").trim();
    const history = normalizeChatHistory(req.body?.history);

    await log(logger, "chat_request_start", {
      requestId,
      questionLength: question.length,
      lineageLength: lineage.length,
      historyLength: history.length,
      model: MODEL
    });

    if (!question) {
      await log(logger, "chat_validation_error", {
        requestId,
        reason: "missing_question",
        durationMs: Date.now() - startedAt
      });
      return res.status(400).json({ error: "Question is required." });
    }

    if (!env.DEEPSEEK_API_KEY) {
      await log(logger, "chat_configuration_error", {
        requestId,
        reason: "missing_deepseek_api_key",
        durationMs: Date.now() - startedAt
      });
      return res.status(500).json({
        error: "DeepSeek API key is not configured."
      });
    }

    try {
      const agent = agentFactory({ env, fetchImpl, lineage });
      const deltas = await createAgentTextDeltaStream(agent, buildAgentInput(question, history));

      res.status(200);
      res.set({
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "content-type": "text/event-stream; charset=utf-8",
        "x-accel-buffering": "no"
      });
      res.flushHeaders?.();

      let responseLength = 0;
      for await (const delta of deltas) {
        responseLength += delta.length;
        res.write(`data: ${JSON.stringify({ delta })}\n\n`);
      }

      if (!responseLength) {
        await log(logger, "deepseek_empty_response", {
          requestId,
          model: MODEL,
          durationMs: Date.now() - startedAt
        });
        res.write(`event: error\ndata: ${JSON.stringify({ error: "DeepSeek returned no text." })}\n\n`);
        return res.end();
      }

      await log(logger, "chat_request_success", {
        requestId,
        model: MODEL,
        responseLength,
        durationMs: Date.now() - startedAt
      });
      res.write("event: done\ndata: {}\n\n");
      return res.end();
    } catch (error) {
      await log(logger, "chat_request_exception", {
        requestId,
        message: error?.message || "unknown_error",
        durationMs: Date.now() - startedAt
      });
      if (res.headersSent) {
        res.write(`event: error\ndata: ${JSON.stringify({ error: "DeepSeek request failed." })}\n\n`);
        return res.end();
      }
      return res.status(502).json({ error: "DeepSeek request failed." });
    }
  });

  app.use((error, req, res, next) => {
    if (error?.type === "entity.parse.failed") {
      return res.status(400).json({ error: "Malformed JSON." });
    }
    if (req.path.startsWith("/api/")) {
      return res.status(500).json({ error: "Internal server error." });
    }
    next(error);
  });

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Not found." });
  });

  app.get("/vendor/marked.esm.js", (_req, res) => {
    res.set("cache-control", "public, max-age=31536000, immutable");
    res.sendFile(path.join(rootDir, "node_modules", "marked", "lib", "marked.esm.js"));
  });

  app.get("/vendor/purify.min.js", (_req, res) => {
    res.set("cache-control", "public, max-age=31536000, immutable");
    res.sendFile(path.join(rootDir, "node_modules", "dompurify", "dist", "purify.min.js"));
  });

  app.use(express.static(path.join(rootDir, "public")));
  app.use(express.static(distDir));

  app.get("/", (_req, res) => {
    const builtIndex = path.join(distDir, "index.html");
    res.sendFile(existsSync(builtIndex) ? builtIndex : path.join(rootDir, "index.html"));
  });

  return app;
}

async function log(logger, event, fields) {
  try {
    await logger.log(event, fields);
  } catch (error) {
    console.error(`Failed to write log event ${event}:`, error);
  }
}

function normalizeChatHistory(value) {
  if (!Array.isArray(value)) return [];
  return value
    .slice(-20)
    .map(message => ({
      role: message?.role === "assistant" ? "assistant" : "user",
      content: String(message?.content ?? "").trim().slice(0, 8000)
    }))
    .filter(message => message.content);
}

function buildSystemPrompt(lineage) {
  return [
    "You are an experienced teacher inside a branching idea-canvas.",
    "Explain clearly, crisply, and practically so readers leave with a concrete next question.",
    "When an image would make an answer easier to understand, call wikipedia_image first and only use image URLs returned by that tool. Render images with markdown image syntax and include a short Wikipedia source link.",
    lineage ? `Context of where this branch came from: ${lineage}` : ""
  ]
    .filter(Boolean)
    .join(" ");
}

function buildAgentInput(question, history = []) {
  return {
    messages: [
      ...history,
      { role: "user", content: question }
    ]
  };
}

export function createDeepSeekAgent({ env, fetchImpl, lineage }) {
  const model = new ChatOpenAI({
    model: MODEL,
    apiKey: env.DEEPSEEK_API_KEY,
    maxTokens: 1000,
    streaming: true,
    configuration: {
      baseURL: DEEPSEEK_BASE_URL,
      fetch: fetchImpl
    }
  });

  return createAgent({
    model,
    tools: [createWikipediaImageTool(fetchImpl)],
    systemPrompt: buildSystemPrompt(lineage)
  });
}

function createWikipediaImageTool(fetchImpl) {
  return tool(
    async ({ query }) => {
      const params = new URLSearchParams({
        action: "query",
        generator: "search",
        gsrsearch: query,
        gsrlimit: "1",
        prop: "pageimages|extracts|info",
        piprop: "original|thumbnail",
        pithumbsize: "900",
        exintro: "1",
        explaintext: "1",
        inprop: "url",
        redirects: "1",
        format: "json"
      });
      const response = await fetchImpl(`https://en.wikipedia.org/w/api.php?${params}`);
      if (!response.ok) return "No Wikipedia image found.";
      const data = await response.json();
      const page = Object.values(data.query?.pages || {})[0];
      let imageUrl = page?.original?.source || page?.thumbnail?.source;
      if (!page || !imageUrl) return "No Wikipedia image found.";
      if (!(await isRealImage(fetchImpl, imageUrl))) {
        imageUrl = await recoverCommonsImage(fetchImpl, imageUrl);
      }
      if (!imageUrl) return "No Wikipedia image found.";
      return JSON.stringify({
        title: page.title,
        imageUrl,
        pageUrl: page.fullurl,
        caption: page.extract || page.title
      });
    },
    {
      name: "wikipedia_image",
      description: "Find a relevant Wikipedia image for a topic. Returns a verified image URL and source page URL.",
      schema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Topic to search on Wikipedia"
          }
        },
        required: ["query"]
      }
    }
  );
}

async function isRealImage(fetchImpl, url) {
  try {
    let response = await fetchImpl(url, { method: "HEAD" });
    if (!response.ok) response = await fetchImpl(url, { headers: { Range: "bytes=0-0" } });
    return response.ok && response.headers.get("content-type")?.startsWith("image/");
  } catch {
    return false;
  }
}

async function recoverCommonsImage(fetchImpl, url) {
  const file = commonsFileName(url);
  if (!file) return null;

  const params = new URLSearchParams({
    action: "query",
    titles: `File:${file}`,
    prop: "imageinfo",
    iiprop: "url|mime",
    format: "json"
  });
  const response = await fetchImpl(`https://commons.wikimedia.org/w/api.php?${params}`);
  const page = response.ok ? Object.values((await response.json()).query?.pages || {})[0] : null;
  const apiUrl = page?.imageinfo?.[0]?.url;
  if (apiUrl && await isRealImage(fetchImpl, apiUrl)) return apiUrl;

  const filePathUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}`;
  return await isRealImage(fetchImpl, filePathUrl) ? filePathUrl : null;
}

function commonsFileName(url) {
  try {
    const parts = new URL(url).pathname.split("/").map(decodeURIComponent);
    return parts.includes("thumb") ? parts.at(-2) : parts.at(-1);
  } catch {
    return null;
  }
}

async function createAgentTextDeltaStream(agent, input) {
  const run = await agent.streamEvents(input, { version: "v3" });
  return streamAgentTextDeltas(run);
}

async function* streamAgentTextDeltas(run) {
  for await (const message of run.messages) {
    for await (const delta of message.text) {
      if (delta) yield delta;
    }
  }
}

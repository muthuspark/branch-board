import express from "express";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createBoardStore } from "./board-store.js";
import { createFileLogger } from "./file-logger.js";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MODEL = "deepseek-v4-flash";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");

export function createApp({ env = process.env, fetchImpl = fetch } = {}) {
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

    await log(logger, "chat_request_start", {
      requestId,
      questionLength: question.length,
      lineageLength: lineage.length,
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
      const upstream = await fetchImpl(DEEPSEEK_URL, {
        method: "POST",
        headers: {
          authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
          "content-type": "application/json"
        },
        body: JSON.stringify(buildDeepSeekPayload(question, lineage))
      });

      if (!upstream.ok) {
        const body = await readResponseBody(upstream);
        await log(logger, "deepseek_upstream_error", {
          requestId,
          status: upstream.status,
          statusText: upstream.statusText || "-",
          model: MODEL,
          response: body,
          durationMs: Date.now() - startedAt
        });
        return res.status(502).json({ error: "DeepSeek request failed." });
      }

      res.status(200);
      res.set({
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "content-type": "text/event-stream; charset=utf-8",
        "x-accel-buffering": "no"
      });
      res.flushHeaders?.();

      let responseLength = 0;
      for await (const delta of streamDeepSeekDeltas(upstream.body)) {
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
        status: upstream.status,
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

async function readResponseBody(response) {
  const text = await response.text().catch(() => "");
  return text.slice(0, 2000);
}

function buildDeepSeekPayload(question, lineage) {
  const system = [
    "You are an experienced teacher inside a branching idea-canvas.",
    "Explain clearly, crisply, and practically so readers leave with a concrete next question.",
    lineage ? `Context of where this branch came from: ${lineage}` : ""
  ]
    .filter(Boolean)
    .join(" ");

  return {
    model: MODEL,
    max_tokens: 1000,
    stream: true,
    messages: [
      { role: "system", content: system },
      { role: "user", content: question }
    ]
  };
}

async function* streamDeepSeekDeltas(body) {
  if (!body) return;
  const decoder = new TextDecoder();
  const reader = body.getReader();
  let buffer = "";
  let dataLines = [];

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex;
    while ((newlineIndex = buffer.search(/\r?\n/)) !== -1) {
      const line = buffer.slice(0, newlineIndex).replace(/\r$/, "");
      buffer = buffer.slice(line.length + (buffer[line.length] === "\r" ? 2 : 1));

      if (!line) {
        const eventData = dataLines.join("\n");
        dataLines = [];
        if (eventData === "[DONE]") return;
        const delta = parseDeepSeekStreamData(eventData);
        if (delta) yield delta;
        continue;
      }

      if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trimStart());
      }
    }
  }

  buffer += decoder.decode();
  if (buffer.startsWith("data:")) {
    dataLines.push(buffer.slice(5).trimStart());
  }
  const eventData = dataLines.join("\n");
  if (eventData && eventData !== "[DONE]") {
    const delta = parseDeepSeekStreamData(eventData);
    if (delta) yield delta;
  }
}

function parseDeepSeekStreamData(data) {
  if (!data) return "";
  const parsed = JSON.parse(data);
  return parsed?.choices?.[0]?.delta?.content || parsed?.choices?.[0]?.message?.content || "";
}

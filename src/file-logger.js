import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

export function createFileLogger(logFile) {
  return {
    log: async (event, fields = {}) => {
      const line = formatLogLine(event, fields);
      await mkdir(path.dirname(logFile), { recursive: true });
      await appendFile(logFile, line + "\n", "utf8");
    }
  };
}

function formatLogLine(event, fields) {
  const parts = [
    new Date().toISOString(),
    `event=${event}`,
    ...Object.entries(fields).map(([key, value]) => `${key}=${formatValue(value)}`)
  ];

  return parts.join(" ");
}

function formatValue(value) {
  if (value === undefined || value === null) return "-";
  return String(value).replace(/\s+/g, " ").slice(0, 1000);
}

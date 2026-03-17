#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { execFileSync } from "child_process";
import { z } from "zod";

import { readFileSync } from "fs";
import { resolve } from "path";

const NODE_NAME = process.env.CANVAS_NODE_NAME ?? "Canvas Web Server";
const WORKSPACE = process.env.OPENCLAW_WORKSPACE ?? process.cwd();

function invoke(command: string, params: Record<string, string>): string {
  const args = ["nodes", "invoke", "--node", NODE_NAME, "--command", command, "--params", JSON.stringify(params)];
  try {
    return execFileSync("openclaw", args, { encoding: "utf-8", timeout: 30_000 }).trim();
  } catch (e: any) {
    return `Error: ${e.stderr || e.message}`;
  }
}

const server = new McpServer({ name: "@openclaw-canvas-web/mcp", version: "0.1.0" });

const S = z.string().optional().describe("Session ID (defaults to agent ID or 'main')");

server.tool("canvas_push", "Push A2UI JSONL content to the canvas", { session: S, payload: z.string().optional().describe("Raw JSONL content"), file: z.string().optional().describe("Path to a JSONL file to push (avoids shell escaping issues)") }, ({ session, payload, file }) => {
  let content: string;
  if (file) {
    const resolvedPath = resolve(WORKSPACE, file);
    try { content = readFileSync(resolvedPath, "utf-8"); } catch (e: any) { return { content: [{ type: "text" as const, text: `Error reading file: ${e.message}` }] }; }
  } else if (payload) {
    content = payload;
  } else {
    return { content: [{ type: "text" as const, text: "Error: either payload or file is required" }] };
  }
  return { content: [{ type: "text" as const, text: invoke("canvas.a2ui.pushJSONL", { session: session ?? "main", payload: content }) }] };
});

server.tool("canvas_reset", "Clear all A2UI surfaces for a session", { session: S }, ({ session }) => ({
  content: [{ type: "text", text: invoke("canvas.a2ui.reset", { session: session ?? "main" }) }],
}));

server.tool("canvas_navigate", "Navigate the canvas to a path or URL", { session: S, url: z.string().describe("URL or path to navigate to") }, ({ session, url }) => ({
  content: [{ type: "text", text: invoke("canvas.navigate", { session: session ?? "main", url }) }],
}));

server.tool("canvas_show", "Show/present the canvas panel", { session: S, target: z.string().optional().describe("URL for external navigation") }, ({ session, target }) => {
  const params: Record<string, string> = { session: session ?? "main" };
  if (target) params.target = target;
  return { content: [{ type: "text", text: invoke("canvas.present", params) }] };
});

server.tool("canvas_hide", "Hide the canvas panel", { session: S }, ({ session }) => ({
  content: [{ type: "text", text: invoke("canvas.hide", { session: session ?? "main" }) }],
}));

server.tool("canvas_eval", "Execute JavaScript in the canvas", { session: S, javaScript: z.string().describe("JavaScript code to execute") }, ({ session, javaScript }) => ({
  content: [{ type: "text", text: invoke("canvas.eval", { session: session ?? "main", javaScript }) }],
}));

server.tool("canvas_snapshot", "Capture a screenshot of the canvas", { session: S }, ({ session }) => ({
  content: [{ type: "text", text: invoke("canvas.snapshot", { session: session ?? "main" }) }],
}));

const transport = new StdioServerTransport();
await server.connect(transport);

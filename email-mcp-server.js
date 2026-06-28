import express from "express";
import nodemailer from "nodemailer";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import crypto from "crypto";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

const CLIENT_ID = process.env.OAUTH_CLIENT_ID || "mcp-email-client";
const CLIENT_SECRET = process.env.OAUTH_CLIENT_SECRET || crypto.randomUUID();
const tokens = new Set();

app.get("/.well-known/oauth-authorization-server", (req, res) => {
  const base = `https://${req.headers.host}`;
  res.json({
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/oauth/token`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"]
  });
});

app.get("/oauth/authorize", (req, res) => {
  const { redirect_uri, state } = req.query;
  const code = crypto.randomUUID();
  const url = new URL(redirect_uri);
  url.searchParams.set("code", code);
  if (state) url.searchParams.set("state", state);
  res.redirect(url.toString());
});

app.post("/oauth/token", (req, res) => {
  const token = crypto.randomUUID();
  tokens.add(token);
  res.json({
    access_token: token,
    token_type: "Bearer",
    expires_in: 86400
  });
});

const server = new McpServer({
  name: "email-sender",
  version: "1.0.0"
});

server.tool(
  "send_email",
  {
    to: z.string().email(),
    subject: z.string(),
    body: z.string()
  },
  async ({ to, subject, body }) => {
    const allowedDomain = process.env.ALLOWED_DOMAIN;
    if (allowedDomain && !to.endsWith(`@${allowedDomain}`)) {
      return {
        content: [{ type: "text", text: `❌ Chỉ gửi được tới @${allowedDomain}` }]
      };
    }

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to,
      subject,
      text: body
    });

    return {
      content: [{ type: "text", text: `✅ Đã gửi email tới ${to}` }]
    };
  }
);

const transports = {};

app.get("/sse", async (req, res) => {
  const transport = new SSEServerTransport("/messages", res);
  transports[transport.sessionId] = transport;
  await server.connect(transport);
  res.on("close", () => delete transports[transport.sessionId]);
});

app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId;
  const transport = transports[sessionId];
  if (transport) {
    await transport.handlePostMessage(req, res);
  } else {
    res.status(400).json({ error: "Session not found" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`MCP server running on port ${PORT}`));
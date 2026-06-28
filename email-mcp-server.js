import express from "express";
import nodemailer from "nodemailer";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";

const app = express();
app.use(express.json());

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
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
  
  res.on("close", () => {
    delete transports[transport.sessionId];
  });
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
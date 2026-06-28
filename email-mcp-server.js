import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import nodemailer from "nodemailer";
import { z } from "zod";

const server = new McpServer({
  name: "email-sender",
  version: "1.0.0"
});

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

server.tool(
  "send_email",
  {
    to: z.string().email(),
    subject: z.string(),
    body: z.string()
  },
  async ({ to, subject, body }) => {
    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to,
      subject,
      text: body
    });

    return { content: [{ type: "text", text: `✅ Đã gửi email tới ${to}` }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
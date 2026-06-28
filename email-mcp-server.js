import express from "express";
import nodemailer from "nodemailer";

const app = express();
app.use(express.json());

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

app.get("/", (req, res) => {
  res.json({ name: "email-mcp-server", version: "1.0.0" });
});

app.post("/send_email", async (req, res) => {
  const { to, subject, body } = req.body;

  const allowedDomain = process.env.ALLOWED_DOMAIN;
  if (allowedDomain && !to.endsWith(`@${allowedDomain}`)) {
    return res.status(403).json({ error: `Chỉ gửi được tới @${allowedDomain}` });
  }

  try {
    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to,
      subject,
      text: body
    });
    res.json({ success: true, message: `Đã gửi email tới ${to}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
import express from "express";
import { createServer } from "node:http";
import authRouter from "./routes/auth.routes.js";
import profileRouter from "./routes/profile.routes.js";
import opportunityRouter from "./routes/opportunity.routes.js";
import chatRouter from "./routes/chat.routes.js";
import collabspaceRouter from "./routes/collabspace.routes.js";
import invitationRouter from "./routes/invitation.routes.js";
import { attachChatWebSocket } from "./lib/chat-websocket.js";

const app = express();
app.set("trust proxy", 1);
const port = process.env.PORT ?? 3000;
const server = createServer(app);

app.use(express.json({ limit: "16kb" }));
app.use("/api/auth", authRouter);
app.use("/api/profiles", profileRouter);
app.use("/api/opportunities", opportunityRouter);
app.use("/api/chat", chatRouter);
app.use("/api/collabspaces", collabspaceRouter);
app.use("/api/invitations", invitationRouter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

attachChatWebSocket(server);

server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

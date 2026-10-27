import express from "express";
import authRouter from "./routes/auth.routes.js";
import profileRouter from "./routes/profile.routes.js";
import opportunityRouter from "./routes/opportunity.routes.js";

const app = express();
const port = process.env.PORT ?? 3000;

app.use(express.json({ limit: "16kb" }));
app.use("/api/auth", authRouter);
app.use("/api/profiles", profileRouter);
app.use("/api/opportunities", opportunityRouter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

import { Hono } from "hono";
import { apiMigrateRoute } from "./routes/migrate";

const app = new Hono();

app.get("/api/health", (c) => c.json({ ok: true }));
app.route("/api/migrate", apiMigrateRoute);

export default app;

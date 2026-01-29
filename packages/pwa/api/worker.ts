import { Hono } from "hono";
import { apiMigrateRoute } from "./routes/migrate";
import { apiHfProxyRoute } from "./routes/hf-proxy";

const app = new Hono();

app.get("/api/health", (c) => c.json({ ok: true }));
app.route("/api/migrate", apiMigrateRoute);
app.route("/api/hf", apiHfProxyRoute);

export default app;

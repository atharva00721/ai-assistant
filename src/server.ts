import app from "./http/app.js";
import { startScheduler } from "./scheduler.js";

const port = Number(Bun.env.PORT) || 3000;
app.listen(port);
console.log(`API listening on port ${port}`);

startScheduler();

export default app;

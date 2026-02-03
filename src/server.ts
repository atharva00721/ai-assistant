import app from "./http/app.js";

const port = Number(Bun.env.PORT) || 3000;
app.listen(port);
console.log(`API listening on port ${port}`);

export default app;

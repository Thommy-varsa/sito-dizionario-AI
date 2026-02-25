// Esempio minimo: salva in server.js, imposta GOOGLE_API_KEY in env, poi avvia con: node server.js
// Non commettere .env nel repo. Usa process.env su hosting.

const express = require("express");
const fetch = require("node-fetch"); // su Node 18+ puoi usare global fetch
const app = express();
app.use(express.json());

const API_KEY = process.env.GOOGLE_API_KEY;
if (!API_KEY) {
  console.error("Devi impostare GOOGLE_API_KEY nell'ambiente!");
  process.exit(1);
}

app.post("/api/generate", async (req, res) => {
  try {
    const body = req.body;
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
    const r = await fetch(endpoint, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(body)
    });
    const text = await r.text();
    // ritrasmetti status, headers e body (JSON) al client
    res.status(r.status);
    try {
      const json = JSON.parse(text);
      res.json(json);
    } catch (e) {
      res.type("text").send(text);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({error: err.message});
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Proxy avviato su http://localhost:" + PORT));
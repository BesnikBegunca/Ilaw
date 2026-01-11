import cors from "cors";
import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(express.json());

const GEMINI_KEY = process.env.GEMINI_API_KEY;

app.post("/chat", async (req, res) => {
  try {
    const { message, context } = req.body;

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${AIzaSyB9jimqJenBIbvhqOiUriYZBmoAGC5N0Ho}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: `${context || ""}\n\nPyetja: ${message}` }]
          }]
        })
      }
    );

    const data = await r.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || "S’pata përgjigje.";

    res.json({ text });
  } catch (e) {
    res.status(500).json({ error: "Gabim" });
  }
});

app.listen(3001, () => console.log("Gemini API on :3001"));

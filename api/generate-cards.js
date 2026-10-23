// Vercel serverless function: POST /api/generate-cards
// Needs the GEMINI_API_KEY environment variable (set in Vercel project settings).
// Optional: GEMINI_MODEL (default: gemini-2.5-flash)

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

function clean(value, max) {
  return String(value ?? "").trim().slice(0, max);
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Use POST." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: "AI is not set up yet (missing GEMINI_API_KEY). You can still add cards manually."
    });
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  if (!body || typeof body !== "object") {
    return res.status(400).json({ error: "Invalid request." });
  }

  const topic = clean(body.topic, 120);
  const subject = clean(body.subject, 80);
  const level = clean(body.level, 40);
  const purpose = clean(body.purpose, 40);
  const context = clean(body.context, 1500);
  const count = Math.min(Math.max(parseInt(body.count, 10) || 10, 1), 20);

  if (!topic || !subject) {
    return res.status(400).json({ error: "Topic and subject are required." });
  }

  const prompt = [
    `Create ${count} study flashcards.`,
    `Topic: ${topic}`,
    `Subject: ${subject}`,
    `Level: ${level || "Beginner"}`,
    `Purpose: ${purpose || "Study"}`,
    context ? `Focus on this extra context:\n${context}` : "",
    "",
    "Rules: each card tests one idea; keep the question short and the answer clear (1-3 sentences).",
    "Only include facts you are confident are correct. Do not repeat questions."
  ].filter(Boolean).join("\n");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`,
      {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.4,
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                cards: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      front: { type: "STRING" },
                      back: { type: "STRING" }
                    },
                    required: ["front", "back"]
                  }
                }
              },
              required: ["cards"]
            }
          }
        })
      }
    );

    if (response.status === 429) {
      return res.status(429).json({
        error: "The free AI quota is used up for now. Try again later or add cards manually."
      });
    }
    if (!response.ok) {
      console.error("Gemini error", response.status, (await response.text()).slice(0, 500));
      return res.status(502).json({ error: "The AI service returned an error. Please try again." });
    }

    const result = await response.json();
    const text = result?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "";

    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = null; }

    const cards = (Array.isArray(parsed?.cards) ? parsed.cards : [])
      .map(c => ({ front: clean(c?.front, 400), back: clean(c?.back, 1200) }))
      .filter(c => c.front && c.back)
      .slice(0, count);

    if (cards.length === 0) {
      return res.status(502).json({ error: "The AI returned no usable cards. Please try again." });
    }

    return res.status(200).json({ cards });
  } catch (error) {
    const timedOut = error && error.name === "AbortError";
    console.error("generate-cards failed:", error);
    return res.status(timedOut ? 504 : 500).json({
      error: timedOut ? "The AI took too long. Please try again." : "Could not generate flashcards."
    });
  } finally {
    clearTimeout(timer);
  }
};

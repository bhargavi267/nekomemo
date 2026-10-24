
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
      error: "Missing GEMINI_API_KEY in Vercel environment variables."
    });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = null;
    }
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return res.status(400).json({ error: "Invalid request body." });
  }

  const topic = clean(body.topic, 120);
  const subject = clean(body.subject, 80);
  const level = clean(body.level, 40) || "Beginner";
  const purpose = clean(body.purpose, 40) || "Study";
  const context = clean(body.context, 1500);

  const requestedCount = Number.parseInt(body.count, 10);
  const count = Math.min(
    Math.max(Number.isFinite(requestedCount) && requestedCount > 0
      ? requestedCount
      : 10, 1),
    20
  );

  if (!topic || !subject) {
    return res.status(400).json({
      error: "Topic and subject are required."
    });
  }

  const prompt = [
    `Generate exactly ${count} study flashcards.`,
    `Topic: ${topic}`,
    `Subject: ${subject}`,
    `Level: ${level}`,
    `Purpose: ${purpose}`,
    context ? `Additional context: ${context}` : "",
    "Each card must test one distinct idea.",
    "Keep each question concise and each answer accurate and clear.",
    "Do not repeat questions.",
    `Return exactly ${count} cards in the required JSON schema.`
  ].filter(Boolean).join("\n");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);

  try {
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/` +
      `${encodeURIComponent(MODEL)}:generateContent`;

    const response = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.3,
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
    });

    if (!response.ok) {
      const rawError = await response.text();
      let providerMessage = "";

      try {
        const data = JSON.parse(rawError);
        providerMessage = data?.error?.message || "";
      } catch {
        providerMessage = rawError;
      }

      // Never log the API key or request headers.
      console.error("Gemini API error:", {
        status: response.status,
        model: MODEL,
        message: providerMessage.slice(0, 1000)
      });

      let message = "Gemini could not generate cards.";

      if (response.status === 400) {
        message = "Invalid Gemini request. Check the model and request schema.";
      } else if (response.status === 401 || response.status === 403) {
        message = "Gemini API key is invalid or lacks permission.";
      } else if (response.status === 404) {
        message = `Gemini model "${MODEL}" is unavailable.`;
      } else if (response.status === 429) {
        message = "Gemini quota or rate limit reached. Check your API usage.";
      } else if (response.status >= 500) {
        message = "Gemini service is temporarily unavailable.";
      }

      return res.status(502).json({
        error: message,
        details: providerMessage.slice(0, 500),
        providerStatus: response.status
      });
    }

    const result = await response.json();
    const candidate = result?.candidates?.[0];
    const generatedText = candidate?.content?.parts
      ?.map(part => part.text || "")
      .join("") || "";

    if (!generatedText) {
      console.error("Gemini returned no text:", {
        model: MODEL,
        finishReason: candidate?.finishReason || "unknown",
        promptFeedback: result?.promptFeedback || null
      });

      return res.status(502).json({
        error: "Gemini returned no card content. Please try again.",
        finishReason: candidate?.finishReason || "unknown"
      });
    }

    let parsed;

    try {
      parsed = JSON.parse(generatedText);
    } catch {
      console.error("Gemini returned invalid JSON.");
      return res.status(502).json({
        error: "Gemini returned an invalid card format. Please try again."
      });
    }

    const cards = (Array.isArray(parsed?.cards) ? parsed.cards : [])
      .map(card => ({
        front: clean(card?.front, 400),
        back: clean(card?.back, 1200)
      }))
      .filter(card => card.front && card.back)
      .slice(0, count);

    if (cards.length === 0) {
      return res.status(502).json({
        error: "Gemini returned no usable flashcards."
      });
    }

    return res.status(200).json({ cards });
  } catch (error) {
    const timedOut = error?.name === "AbortError";

    console.error("generate-cards failed:", {
      name: error?.name,
      message: error?.message
    });

    return res.status(timedOut ? 504 : 500).json({
      error: timedOut
        ? "Gemini timed out after 25 seconds. Please try again."
        : "Could not connect to the Gemini service."
    });
  } finally {
    clearTimeout(timer);
  }
};

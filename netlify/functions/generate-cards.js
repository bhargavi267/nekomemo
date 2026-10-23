
exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json"
  };

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        error: "Please use a POST request."
      })
    };
  }

  try {
    const apiKey = process.env.my_api_key;

    if (!apiKey) {
      throw new Error("Gemini API key is not configured in Netlify.");
    }

    const { topic } = JSON.parse(event.body || "{}");

    if (typeof topic !== "string" || !topic.trim()) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "Please enter a topic."
        })
      };
    }

    if (topic.length > 200) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "Please keep the topic under 200 characters."
        })
      };
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Create 8 useful study flashcards about this topic: ${topic.trim()}.

Return only a valid JSON array. Each item must have:
- "front": a clear question
- "back": a correct, concise answer

Use simple English. Avoid duplicate questions.
Example:
[{"front":"What is RAM?","back":"RAM is temporary memory used by a computer."}]`
            }]
          }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.4
          }
        })
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error("Gemini API request failed:", response.status);
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({
          error: "Gemini could not generate cards. Check your API key, model access, and usage limits."
        })
      };
    }

    const text = result.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("");

    if (!text) {
      throw new Error("Gemini returned an empty response.");
    }

    const cards = JSON.parse(text);

    if (
      !Array.isArray(cards) ||
      cards.length === 0 ||
      cards.length > 8 ||
      !cards.every(card =>
        typeof card.front === "string" &&
        card.front.trim() &&
        typeof card.back === "string" &&
        card.back.trim()
      )
    ) {
      throw new Error("Gemini returned invalid flashcards.");
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        topic: topic.trim(),
        cards: cards.map(card => ({
          front: card.front.trim(),
          back: card.back.trim()
        }))
      })
    };
  } catch (error) {
    console.error("Flashcard generation error:", error.message);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Could not generate flashcards. Please check the setup and try again."
      })
    };
  }
};

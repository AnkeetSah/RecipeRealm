require("dotenv").config();
const { GoogleGenAI } = require("@google/genai");

// Initialize the client; API key is taken from GEMINI_API_KEY environment variable
const ai = new GoogleGenAI({});

async function testGeneration() {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",  // make sure this model exists
      contents: "Explain how AI works in a details words",
    });

    console.log("Generated Text:\n", response.text);
  } catch (error) {
    console.error("Error generating content:", error);
  }
}

testGeneration();

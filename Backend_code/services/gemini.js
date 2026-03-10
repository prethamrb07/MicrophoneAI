import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

let genAI = null;
let model = null;

function getModel() {
    if (!model) {
        if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your-gemini-api-key-here') {
            console.warn('⚠️  GEMINI_API_KEY not set — AI features will return mock responses');
            return null;
        }
        genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    }
    return model;
}

/**
 * Generate a podcast suggestion based on recent transcript context.
 */
export async function generateSuggestion(transcriptContext) {
    const m = getModel();
    if (!m) {
        return getMockSuggestion(transcriptContext);
    }

    try {
        const prompt = `You are an AI podcast assistant. Based on the following conversation transcript from a live podcast, provide a brief, helpful suggestion for the host. The suggestion should be conversational, actionable, and help improve the podcast flow. Keep it to 2-3 sentences max.

Transcript:
${transcriptContext}

Suggestion:`;

        const result = await m.generateContent(prompt);
        return result.response.text().trim();
    } catch (err) {
        console.error('Gemini suggestion error:', err);
        return getMockSuggestion(transcriptContext);
    }
}

/**
 * Transcribe audio using Gemini (simplified: processes audio context description).
 * In a real implementation, you would use Whisper or Gemini's audio API.
 * For the hackathon demo, we simulate transcription from audio chunks.
 */
export async function transcribeAudio(audioBuffer, language = 'en') {
    // Note: Real-time audio transcription typically uses a streaming STT service.
    // For demo purposes, we'll return null and let the WebSocket handler
    // use a simulated transcription approach.
    return null;
}

function getMockSuggestion(context) {
    const suggestions = [
        "Try asking your co-host about their personal experience with this topic — listeners love authentic stories!",
        "Great point! Consider diving deeper into the 'why' behind that statement. Your audience will appreciate the analysis.",
        "This might be a good moment to summarize the key points so far before moving to the next topic.",
        "Consider asking an open-ended question to your co-host to keep the conversation flowing naturally.",
        "You could share a relevant anecdote here — personal stories create stronger connections with your audience.",
        "Try shifting the energy by introducing a contrasting viewpoint. Healthy debate makes for engaging content!",
    ];
    return suggestions[Math.floor(Math.random() * suggestions.length)];
}

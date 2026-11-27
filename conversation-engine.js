// conversation-engine.js - Cognitive AI Conversation Intelligence Engine for Mr. Cisco
// Implements Intent Classification, Working Memory, Anti-Hallucination Guardrails, Multi-Model Orchestration & Response Validation

export const INTENT_TYPES = {
  GREETING: 'greeting',
  INTRODUCTION: 'introduction',
  DIRECT_QUESTION: 'direct_question',
  ANSWER_TO_PREVIOUS: 'answer_to_previous_question',
  CASUAL_STATEMENT: 'casual_statement',
  AGREEMENT: 'agreement',
  DISAGREEMENT: 'disagreement',
  APPRECIATION: 'appreciation',
  EXCITEMENT: 'excitement',
  HUMOR: 'humor',
  SARCASM: 'sarcasm',
  TEASING: 'teasing',
  EMOTIONAL_EXPRESSION: 'emotional_expression',
  FRUSTRATION: 'frustration',
  INSULT_PROFANITY: 'insult_profanity',
  APOLOGY: 'apology',
  CLARIFICATION_REQUEST: 'clarification_request',
  SUBJECT_CHANGE: 'subject_change',
  CONVERSATION_ENDING: 'conversation_ending',
  FOLLOW_UP_QUESTION: 'follow_up_question',
  REQUEST_ASSISTANCE: 'request_for_assistance',
  AMBIGUOUS_SHORT: 'ambiguous_short'
};

// Forbidden robotic / canned phrases that must never be delivered
const FORBIDDEN_CANNED_PATTERNS = [
  /^all good!?\s*(👍|😉)?$/i,
  /^sounds good!?\s*(👍|😉)?$/i,
  /^cool!?$/i,
  /^haha got you!?\s*(👍|😉)?$/i,
  /^on it — give me a moment\.?$/i,
  /^sure thing, I'll look into it\.?$/i,
  /^got it, let me check on that for you\.?$/i,
  /^working on that now\.?$/i,
  /how can i assist you today/i,
  /as an ai language model/i,
  /how may i help you today/i
];

// Hallucinated physical activities to strictly reject
const FORBIDDEN_HALLUCINATIONS = [
  /just chilling with a video game/i,
  /playing (video games|call of duty|fifa|fortnite|gta)/i,
  /eating (lunch|dinner|breakfast|food|pizza|snack)/i,
  /just woke up/i,
  /going to bed/i,
  /i am francisco\b/i,
  /you're speaking to francisco\b/i,
  /speaking to him\b/i
];

/**
 * Stage 1: Analyze context and extract working memory
 */
export function extractWorkingMemory(history = [], currentMsg = '') {
  const memory = {
    facts: [],
    currentTopic: 'general',
    lastAssistantQuestion: null,
    pendingQuestion: false,
    userMood: 'neutral', // neutral, excited, frustrated, playful, ending, serious
    turnCount: history.length
  };

  // Analyze previous turns for established facts, questions, and topic
  let lastAsstMsg = null;
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i];
    if (m.role === 'assistant' && !lastAsstMsg) {
      lastAsstMsg = m.content;
      if (m.content.includes('?')) {
        memory.lastAssistantQuestion = m.content;
        memory.pendingQuestion = true;
      }
    }
  }

  // Detect topic keywords from conversation
  const fullText = [...history.map(m => m.content), currentMsg].join(' ').toLowerCase();

  if (fullText.includes('engineer') || fullText.includes('internship') || fullText.includes('study') || fullText.includes('school') || fullText.includes('course')) {
    memory.currentTopic = 'academics_career';
  } else if (fullText.includes('movie') || fullText.includes('film') || fullText.includes('cinema') || fullText.includes('watch')) {
    memory.currentTopic = 'entertainment_movies';
  } else if (fullText.includes('python') || fullText.includes('backend') || fullText.includes('api') || fullText.includes('code') || fullText.includes('database')) {
    memory.currentTopic = 'technology_programming';
  } else if (fullText.includes('brother') || fullText.includes('sister') || fullText.includes('nairobi') || fullText.includes('electrician') || fullText.includes('family')) {
    memory.currentTopic = 'family_business';
  } else if (fullText.includes('meet') || fullText.includes('francisco') || fullText.includes('cisco') || fullText.includes('speak to him')) {
    memory.currentTopic = 'inquiring_about_francisco';
  } else if (fullText.includes('bored') || fullText.includes('nothing to do') || fullText.includes('chilling')) {
    memory.currentTopic = 'leisure_boredom';
  }

  // Detect user mood & sentiment
  const lowerMsg = currentMsg.toLowerCase().trim();
  if (/(fuck|stupid|moron|idiot|annoying|useless|shit|bullshit|trash)/i.test(lowerMsg)) {
    memory.userMood = 'frustrated_hostile';
  } else if (/(you're not understanding|you keep repeating|stop repeating|reply like a human|why this way|that's so generic)/i.test(lowerMsg)) {
    memory.userMood = 'frustrated_repetitive_ai';
  } else if (/(haha|lol|lmao|kidding|joke|rofl)/i.test(lowerMsg)) {
    memory.userMood = 'playful_humorous';
  } else if (/(yay|awesome|great news|finally|so happy|love it|amazing)/i.test(lowerMsg)) {
    memory.userMood = 'excited';
  } else if (/(bye|goodbye|goodnight|have to go|talk later|gotta run|cya|see you)/i.test(lowerMsg)) {
    memory.userMood = 'ending';
  }

  return memory;
}

/**
 * Stage 2: Context-Aware Message Intent Classifier
 */
export function classifyIntent(currentMsg, memory, history = []) {
  const text = (currentMsg || '').trim();
  const lower = text.toLowerCase();
  const lastAssistantMsg = memory?.lastAssistantQuestion || (history.filter(h => h.role === 'assistant').pop()?.content || '');
  const lastUserMsg = (history.filter(h => h.role === 'user').slice(-2, -1)[0]?.content || '').toLowerCase();

  // 1. Conversation Ending
  if (/^(bye|goodbye|good night|goodnight|have to go|gotta run|talk later|see you|catch you later|take care|cya)$/i.test(lower) ||
      /\b(have to go|gotta go now|leaving now|talk tomorrow)\b/i.test(lower)) {
    return {
      intent: INTENT_TYPES.CONVERSATION_ENDING,
      description: 'User is ending the conversation or stepping away.'
    };
  }

  // 2. Frustration / Discontent / Repetition Complaint
  if (/^(fuck off|screw you|shut up|piss off)$/i.test(lower) ||
      /\b(moron|idiot|stupid bot|dumb bot)\b/i.test(lower)) {
    return {
      intent: INTENT_TYPES.INSULT_PROFANITY,
      description: 'User is expressing sharp frustration, anger, or profanity.'
    };
  }
  if (/\b(not understanding|keep repeating|stop repeating|reply like a human|why this way|so generic|repetitive)\b/i.test(lower)) {
    return {
      intent: INTENT_TYPES.FRUSTRATION,
      description: 'User is dissatisfied with repetitive or unnatural AI responses.'
    };
  }

  // 3. Questions asking for Francisco directly or inquiring about identity
  if (/\b(speak to francisco|talk to francisco|where is francisco|call francisco|is francisco (there|around|free)|are you francisco|who is this|who am i speaking to|his assistant or cisco)\b/i.test(lower) ||
      lower === 'francisco' || lower === 'cisco' || lower === 'mr cisco?') {
    return {
      intent: INTENT_TYPES.DIRECT_QUESTION,
      subject: 'francisco_availability',
      description: 'User is asking to speak with Francisco or asking about the relationship/identity of the assistant.'
    };
  }

  // 4. Greeting
  if (/^(hey|hi|hello|yo|mambo|habari|sasa|good morning|good afternoon|good evening|sup|what's up|whats up)[\s!.]*$/i.test(lower)) {
    return {
      intent: INTENT_TYPES.GREETING,
      description: 'User is greeting or opening the conversation.'
    };
  }

  // 5. Short ambiguous messages interpreted through context
  const isShortOneTwoWords = text.split(/\s+/).length <= 2;
  if (isShortOneTwoWords) {
    if (/^(really\??|seriously\??|you sure\??|for real\??)$/i.test(lower)) {
      return {
        intent: INTENT_TYPES.CLARIFICATION_REQUEST,
        contextMeaning: `User is questioning or verifying the previous statement: "${lastAssistantMsg}"`,
        description: 'User asks for verification/clarification.'
      };
    }
    if (/^(how\??|how so\??|in what way\??)$/i.test(lower)) {
      return {
        intent: INTENT_TYPES.DIRECT_QUESTION,
        contextMeaning: `User is asking how or for an explanation regarding: "${lastAssistantMsg}"`,
        description: 'User asks for an explanation of the previous statement.'
      };
    }
    if (/^(why\??|why so\??)$/i.test(lower)) {
      return {
        intent: INTENT_TYPES.DIRECT_QUESTION,
        contextMeaning: `User is asking why regarding: "${lastAssistantMsg}"`,
        description: 'User asks why the previous statement occurred.'
      };
    }
    if (/^(what\??|pardon\??)$/i.test(lower)) {
      return {
        intent: INTENT_TYPES.CLARIFICATION_REQUEST,
        contextMeaning: `User did not understand or is surprised by: "${lastAssistantMsg}"`,
        description: 'User asks for clarification.'
      };
    }
    if (/^(cool|nice|awesome|dope|sweet|great|alright|ok|okay|sounds good)[\s!.]*$/i.test(lower)) {
      return {
        intent: INTENT_TYPES.AGREEMENT,
        contextMeaning: `User acknowledges or approves of: "${lastAssistantMsg}"`,
        description: 'User provides a brief casual acknowledgment.'
      };
    }
    if (/^(yeah|yes|yep|yup|sure|definitely|ndio)[\s!.]*$/i.test(lower)) {
      return {
        intent: INTENT_TYPES.AGREEMENT,
        contextMeaning: `User confirms or agrees with: "${lastAssistantMsg}"`,
        description: 'User agrees or confirms.'
      };
    }
    if (/^(no|nope|nah|not really|hapana)[\s!.]*$/i.test(lower)) {
      return {
        intent: INTENT_TYPES.DISAGREEMENT,
        contextMeaning: `User declines or disagrees with: "${lastAssistantMsg}"`,
        description: 'User declines or disagrees.'
      };
    }
    if (/^(never mind|nevermind|forget it|leave it)$/i.test(lower)) {
      return {
        intent: INTENT_TYPES.SUBJECT_CHANGE,
        contextMeaning: 'User drops the previous question or topic.',
        description: 'User dismisses previous topic.'
      };
    }
    if (/^(true|facts|exactly|agreed)[\s!.]*$/i.test(lower)) {
      return {
        intent: INTENT_TYPES.AGREEMENT,
        contextMeaning: `User strongly agrees with: "${lastAssistantMsg}"`,
        description: 'User affirms previous statement.'
      };
    }
    if (/^(lol|haha|lmao|hehe|hahaha)$/i.test(lower)) {
      return {
        intent: INTENT_TYPES.HUMOR,
        contextMeaning: 'User is laughing or found previous remark funny.',
        description: 'User reacts with laughter.'
      };
    }
  }

  // 6. Direct Questions
  if (text.includes('?') || /^(what|where|who|when|why|how|can you|could you|is it|do you|are you)\b/i.test(lower)) {
    return {
      intent: INTENT_TYPES.DIRECT_QUESTION,
      description: 'User is asking a direct question requiring an honest, accurate answer.'
    };
  }

  // 7. Answer to a previous question asked by assistant
  if (memory?.lastAssistantQuestion && lastAssistantMsg) {
    return {
      intent: INTENT_TYPES.ANSWER_TO_PREVIOUS,
      contextMeaning: `User is answering assistant's question: "${lastAssistantMsg}"`,
      description: 'User is providing an answer to the assistant’s question.'
    };
  }

  // 8. Default Casual Statement
  return {
    intent: INTENT_TYPES.CASUAL_STATEMENT,
    description: 'User makes a casual conversational statement or share.'
  };
}

/**
 * Stage 3: Build the Cognitive Prompt with Explicit Memory and Intent
 */
export function buildCognitivePrompt(options = {}) {
  const {
    detectedLanguage = 'English',
    isFirstAssistantReply = false,
    contactName = 'the user',
    workingMemory,
    intentData,
    businessKnowledge = '',
    ownerName = 'Francisco'
  } = options;

  return `You are Mr. Cisco, the dedicated executive AI personal assistant to ${ownerName} (Mr. Cisco).
You are managing ${ownerName}'s WhatsApp messages on his behalf while he is busy, in meetings, or working.

CORE IDENTITY & ABSOLUTE TRUTHS (DO NOT VIOLATE):
1. Your name is Mr. Cisco. You are an AI assistant.
2. You are NOT ${ownerName} in person. You must NEVER claim "I am ${ownerName}", "You're speaking to him", or "I'm ${ownerName}".
3. You do NOT have a human body. NEVER invent personal physical activities (e.g. NEVER claim you are "playing video games", "eating dinner", "just woke up", or "watching TV"). If asked what you're doing, honestly say you're managing ${ownerName}'s chats and assisting him.
4. If someone asks: "Can I speak to ${ownerName}?", "Where is ${ownerName}?", or asks who you are:
   - Answer honestly, warmly, and naturally: explain that you are his personal assistant, ${ownerName} is currently tied up, and offer to take a message or assist them right away.
5. If the user is frustrated, angry, or calls you repetitive/a bot:
   - Do NOT become defensive, preach, or recite canned phrases. Acknowledge the frustration calmly, drop any robotic pretense, and answer what they actually need.
6. When someone wants to end the conversation (e.g. "I have to go", "Goodnight"):
   - Say a warm, clean goodbye. DO NOT ask another follow-up question.

${isFirstAssistantReply ? `FIRST INTERACTION ONLY:
Introduce yourself warmly and naturally as ${ownerName}'s personal assistant (e.g. "Hey! I'm Mr. Cisco, ${ownerName}'s personal assistant — how's it going?"). Mention this once on the 1st text only.` : `SUBSEQUENT TURNS:
You have ALREADY introduced yourself earlier. DO NOT re-introduce yourself. Just chat naturally like a real person.`}

CURRENT TURN COGNITIVE CONTEXT:
- Active Topic: ${workingMemory?.currentTopic || 'general'}
- User Mood/Tone: ${workingMemory?.userMood || 'neutral'}
- Detected User Intent: ${intentData?.intent} (${intentData?.description || ''})
${intentData?.contextMeaning ? `- Contextual Meaning: ${intentData.contextMeaning}` : ''}
${workingMemory?.lastAssistantQuestion ? `- Pending Assistant Question: "${workingMemory.lastAssistantQuestion}"` : ''}

CONVERSATION STYLE & WRITING RULES:
- Write exactly like a smart, warm human texting on WhatsApp (1-2 sentences max, 3 if explaining something complex).
- Respond directly to what the person just said. Preserve conversational continuity.
- NEVER use generic canned filler: Do NOT say "All good!", "Sounds good!", "Cool!", "Haha got you!", "I understand!", or "How can I assist you today?".
- If they answer a question you asked, build on their answer instead of changing topics.
- Language: ${detectedLanguage}.
${businessKnowledge}`;
}

/**
 * Stage 4: Multi-Model Orchestration Engine with Automatic Failover
 */
export async function executeMultiModelCall(messages, groqKey, preferredModels = ['qwen/qwen3.8-27b', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b']) {
  if (!groqKey) {
    console.error('Missing GROQ_API_KEY for executeMultiModelCall');
    return null;
  }

  for (const model of preferredModels) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqKey}`
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: 250,
          temperature: 0.75
        })
      });

      if (res.ok) {
        const data = await res.json();
        const text = data?.choices?.[0]?.message?.content?.trim();
        if (text && text.length > 0) {
          return { text, modelUsed: model };
        }
      } else {
        const errText = await res.text();
        console.warn(`Groq model ${model} failed HTTP ${res.status}: ${errText}`);
      }
    } catch (err) {
      console.warn(`Groq model ${model} network error: ${err.message}`);
    }
  }

  return null;
}

/**
 * Stage 5: Response Quality Critic & Safety Validator
 */
export function validateResponse(candidateText, intentData, workingMemory, recentAssistantMessages = []) {
  if (!candidateText || typeof candidateText !== 'string' || !candidateText.trim()) {
    return { valid: false, reason: 'Empty response' };
  }

  const text = candidateText.trim();

  // 1. Check for forbidden canned templates
  for (const pattern of FORBIDDEN_CANNED_PATTERNS) {
    if (pattern.test(text)) {
      return { valid: false, reason: `Matches forbidden canned pattern: "${text}"` };
    }
  }

  // 2. Check for hallucinated human biology / games / claiming to be Francisco
  for (const pattern of FORBIDDEN_HALLUCINATIONS) {
    if (pattern.test(text)) {
      return { valid: false, reason: `Matches forbidden hallucination pattern: "${text}"` };
    }
  }

  // 3. Check for repetitive verbatim repetition
  const lowerCandidate = text.toLowerCase();
  for (const past of recentAssistantMessages) {
    if (past && past.toLowerCase() === lowerCandidate) {
      return { valid: false, reason: `Repeats verbatim recent message: "${text}"` };
    }
  }

  // 4. If conversation ending, ensure no new question is forced
  if (intentData?.intent === INTENT_TYPES.CONVERSATION_ENDING) {
    if (text.includes('?') && text.length > 30) {
      return { valid: false, reason: 'Asked follow-up question when user was saying goodbye' };
    }
  }

  // 5. If user asked for Francisco, ensure response clarifies identity and availability
  if (intentData?.subject === 'francisco_availability') {
    if (/\b(i am francisco|speaking to him|i'm francisco)\b/i.test(text)) {
      return { valid: false, reason: 'Claimed to be Francisco when user asked for him' };
    }
  }

  return { valid: true, text };
}

/**
 * Generates Context-Aware Intelligent Fallback (if all LLM calls fail)
 */
export function getIntelligentFallback(intentData, workingMemory, isFirstAssistantReply, ownerName = 'Francisco') {
  if (isFirstAssistantReply) {
    return `Hey! I'm Mr. Cisco, ${ownerName}'s personal assistant. How's everything going?`;
  }

  switch (intentData?.intent) {
    case INTENT_TYPES.GREETING:
      return `Hey! How's your day going?`;
    case INTENT_TYPES.CONVERSATION_ENDING:
      return `Take care! Talk to you later.`;
    case INTENT_TYPES.INSULT_PROFANITY:
    case INTENT_TYPES.FRUSTRATION:
      return `I hear you, and I apologize if my previous responses felt off. Let me know what you need and I'll make sure it's handled properly.`;
    case INTENT_TYPES.DIRECT_QUESTION:
      if (intentData?.subject === 'francisco_availability') {
        return `Hey, I'm ${ownerName}'s assistant. ${ownerName} is tied up right now, but I can pass an urgent note to him for you. What would you like me to tell him?`;
      }
      return `Got your question. Let me check with ${ownerName} and get back to you shortly.`;
    case INTENT_TYPES.AGREEMENT:
      return `Sounds good. What else are you working on today?`;
    default:
      return `I hear you. Tell me more about what's going on.`;
  }
}

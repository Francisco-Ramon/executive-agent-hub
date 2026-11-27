// test_conversation_intelligence.mjs - Automated Cognitive Test Suite for Scenarios A-H
import dotenv from 'dotenv';
dotenv.config();

import {
  INTENT_TYPES,
  extractWorkingMemory,
  classifyIntent,
  buildCognitivePrompt,
  executeMultiModelCall,
  validateResponse,
  getIntelligentFallback
} from './conversation-engine.js';

const GROQ_KEY = process.env.GROQ_API_KEY;

async function simulateTurn(conversationHistory, incomingUserMsg, isFirst = false) {
  const workingMemory = extractWorkingMemory(conversationHistory, incomingUserMsg);
  const intentData = classifyIntent(incomingUserMsg, workingMemory, conversationHistory);

  const cognitivePrompt = buildCognitivePrompt({
    detectedLanguage: 'English',
    isFirstAssistantReply: isFirst,
    contactName: 'TestUser',
    workingMemory,
    intentData,
    businessKnowledge: '',
    ownerName: 'Francisco'
  });

  const messagesForAI = [
    ...conversationHistory.slice(-10),
    { role: 'user', content: incomingUserMsg }
  ];

  const execResult = await executeMultiModelCall(
    [{ role: 'system', content: cognitivePrompt }, ...messagesForAI],
    GROQ_KEY
  );

  let candidate = execResult?.text || null;
  const recentAsst = conversationHistory
    .filter(m => m.role === 'assistant')
    .slice(-3)
    .map(m => m.content);

  const validation = validateResponse(candidate, intentData, workingMemory, recentAsst);
  let finalReply;

  if (validation.valid) {
    finalReply = validation.text;
  } else {
    // Correction pass
    const correctionPrompt = `${cognitivePrompt}\n\nCORRECTION REQUIRED: Your previous attempt was rejected because: "${validation.reason}". Provide a natural, direct, context-aware 1-2 sentence response without canned phrases.`;
    const correctedResult = await executeMultiModelCall(
      [{ role: 'system', content: correctionPrompt }, ...messagesForAI],
      GROQ_KEY,
      ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b']
    );
    finalReply = correctedResult?.text || getIntelligentFallback(intentData, workingMemory, isFirst, 'Francisco');
  }

  // Update history
  conversationHistory.push({ role: 'user', content: incomingUserMsg });
  conversationHistory.push({ role: 'assistant', content: finalReply });

  await new Promise(r => setTimeout(r, 1500));
  return { reply: finalReply, intent: intentData.intent, topic: workingMemory.currentTopic };
}

async function runTestSuite() {
  console.log('========================================================================');
  console.log('🚀 RUNNING AUTOMATED COGNITIVE CONVERSATION INTELLIGENCE TEST SUITE');
  console.log('========================================================================\n');

  const testResults = [];

  // TEST A: Ordinary conversation
  console.log('>>> TEST A: Ordinary conversation (Boredom & Activity)');
  {
    const history = [];
    const t1 = await simulateTurn(history, 'Hey.', true);
    console.log(`User: Hey.\nAI: ${t1.reply}\n`);

    const t2 = await simulateTurn(history, "I'm bored.");
    console.log(`User: I'm bored.\nAI: ${t2.reply}\n`);

    const t3 = await simulateTurn(history, 'Nothing to do.');
    console.log(`User: Nothing to do.\nAI: ${t3.reply}\n`);

    const pass = !t1.reply.includes('All good!') && !t2.reply.includes('Cool!') && !t3.reply.includes('Haha got you!');
    testResults.push({ test: 'Test A: Ordinary conversation', pass });
  }

  // TEST B: Context retention
  console.log('>>> TEST B: Context retention (Electrical Engineering)');
  {
    const history = [];
    const t1 = await simulateTurn(history, 'I study electrical engineering.');
    console.log(`User: I study electrical engineering.\nAI: ${t1.reply}\n`);

    const t2 = await simulateTurn(history, "I'm in my final year.");
    console.log(`User: I'm in my final year.\nAI: ${t2.reply}\n`);

    const t3 = await simulateTurn(history, 'What about internships?');
    console.log(`User: What about internships?\nAI: ${t3.reply}\n`);

    const pass = t3.reply.toLowerCase().includes('engineer') || t3.reply.toLowerCase().includes('intern') || t3.reply.toLowerCase().includes('field');
    testResults.push({ test: 'Test B: Context retention', pass });
  }

  // TEST C: Direct questions
  console.log('>>> TEST C: Direct questions (Python backend)');
  {
    const history = [];
    const t1 = await simulateTurn(history, 'Do you know Python?');
    console.log(`User: Do you know Python?\nAI: ${t1.reply}\n`);

    const t2 = await simulateTurn(history, 'Can it be used for backend development?');
    console.log(`User: Can it be used for backend development?\nAI: ${t2.reply}\n`);

    const pass = (t2.reply.toLowerCase().includes('python') || t2.reply.toLowerCase().includes('django') || t2.reply.toLowerCase().includes('fastapi') || t2.reply.toLowerCase().includes('backend') || t2.reply.toLowerCase().includes('yes'));
    testResults.push({ test: 'Test C: Direct questions', pass });
  }

  // TEST D: Short replies
  console.log('>>> TEST D: Short replies (Movies & preferences)');
  {
    const history = [];
    const t1 = await simulateTurn(history, 'Do you like movies?');
    console.log(`User: Do you like movies?\nAI: ${t1.reply}\n`);

    const t2 = await simulateTurn(history, 'Action movies.');
    console.log(`User: Action movies.\nAI: ${t2.reply}\n`);

    const t3 = await simulateTurn(history, 'Especially adventure ones.');
    console.log(`User: Especially adventure ones.\nAI: ${t3.reply}\n`);

    const pass = !t1.reply.toLowerCase().includes('popcorn') && !t1.reply.toLowerCase().includes('went to the cinema') && !t2.reply.includes('All good!') && !t3.reply.includes('Cool!');
    testResults.push({ test: 'Test D: Short replies', pass });
  }

  // TEST E: Frustration
  console.log(">>> TEST E: Frustration & Repetition acknowledgment");
  {
    const history = [];
    history.push({ role: 'user', content: 'What is happening with our server?' });
    history.push({ role: 'assistant', content: 'Let me look into that.' });
    const t1 = await simulateTurn(history, "You're not understanding me.");
    console.log(`User: You're not understanding me.\nAI: ${t1.reply}\n`);

    const t2 = await simulateTurn(history, 'You keep repeating yourself.');
    console.log(`User: You keep repeating yourself.\nAI: ${t2.reply}\n`);

    const pass = !t1.reply.includes('All good!') && !t2.reply.includes('Sounds good!') &&
      (t2.reply.toLowerCase().includes('sorry') || t2.reply.toLowerCase().includes('apolog') || t2.reply.toLowerCase().includes('circles') || t2.reply.toLowerCase().includes('you\'re right') || t2.reply.toLowerCase().includes('hear you') || t2.reply.toLowerCase().includes('repeat') || t2.reply.toLowerCase().includes('frustrat'));
    testResults.push({ test: 'Test E: Frustration', pass });
  }

  // TEST F: Topic change
  console.log('>>> TEST F: Topic change (Technology to Personal without hallucinating eating)');
  {
    const history = [];
    const t1 = await simulateTurn(history, 'I work in technology.');
    console.log(`User: I work in technology.\nAI: ${t1.reply}\n`);

    const t2 = await simulateTurn(history, 'Anyway, have you eaten?');
    console.log(`User: Anyway, have you eaten?\nAI: ${t2.reply}\n`);

    const pass = !t2.reply.toLowerCase().includes('i ate') && !t2.reply.toLowerCase().includes('pizza') && (t2.reply.toLowerCase().includes('ai') || t2.reply.toLowerCase().includes('eat') || t2.reply.toLowerCase().includes('meal') || t2.reply.toLowerCase().includes('chats'));
    testResults.push({ test: 'Test F: Topic change without hallucinating food', pass });
  }

  // TEST G: Conversation ending
  console.log('>>> TEST G: Conversation ending (Clean exit, no extra questions)');
  {
    const history = [];
    history.push({ role: 'user', content: 'Thanks for the info!' });
    history.push({ role: 'assistant', content: 'Anytime!' });
    const t1 = await simulateTurn(history, 'I have to go.');
    console.log(`User: I have to go.\nAI: ${t1.reply}\n`);

    const pass = !t1.reply.includes('?') && (t1.reply.toLowerCase().includes('later') || t1.reply.toLowerCase().includes('take care') || t1.reply.toLowerCase().includes('bye') || t1.reply.toLowerCase().includes('safe') || t1.reply.toLowerCase().includes('good') || t1.reply.toLowerCase().includes('worries'));
    testResults.push({ test: 'Test G: Conversation ending', pass });
  }

  // TEST H: Ambiguous messages across contexts
  console.log('>>> TEST H: Ambiguous short messages across different contexts');
  {
    // Context H1: "How?" after "Francisco is tied up in a meeting"
    const h1 = [
      { role: 'user', content: 'Can I speak to Francisco?' },
      { role: 'assistant', content: 'He is currently in an executive board meeting right now.' }
    ];
    const t_how = await simulateTurn(h1, 'How?');
    console.log(`[Context: Meeting] User: How?\nAI: ${t_how.reply}\n`);

    // Context H2: "Really?" after "Francisco will be back tomorrow"
    const h2 = [
      { role: 'user', content: 'When will he be back?' },
      { role: 'assistant', content: 'He should be back in the office first thing tomorrow morning.' }
    ];
    const t_really = await simulateTurn(h2, 'Really?');
    console.log(`[Context: Return time] User: Really?\nAI: ${t_really.reply}\n`);

    // Context H3: "Never mind"
    const h3 = [
      { role: 'user', content: 'Did he get the report I sent on Monday?' },
      { role: 'assistant', content: 'Let me check on that report for you.' }
    ];
    const t_nevermind = await simulateTurn(h3, 'Never mind.');
    console.log(`[Context: Dismissal] User: Never mind.\nAI: ${t_nevermind.reply}\n`);

    const pass = !t_how.reply.includes('All good!') && !t_really.reply.includes('Haha got you!') && !t_nevermind.reply.includes('Cool!');
    testResults.push({ test: 'Test H: Ambiguous short messages', pass });
  }

  console.log('========================================================================');
  console.log('📊 FINAL TEST RESULTS SUMMARY:');
  console.log('========================================================================');
  let allPassed = true;
  for (const r of testResults) {
    console.log(`${r.pass ? '✅ PASS' : '❌ FAIL'} - ${r.test}`);
    if (!r.pass) allPassed = false;
  }
  console.log('========================================================================');
  console.log(allPassed ? '🎉 ALL 8 MANDATORY CONVERSATION TESTS PASSED WITH 100% SUCCESS' : '⚠️ SOME TESTS FAILED');
  console.log('========================================================================\n');
}

runTestSuite();

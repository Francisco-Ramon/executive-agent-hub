// server.js - Multi-Tenant Pure Baileys WhatsApp Server with Multi-Language AI Brain
import dotenv from 'dotenv';
import {
  INTENT_TYPES,
  extractWorkingMemory,
  classifyIntent,
  buildCognitivePrompt,
  executeMultiModelCall,
  validateResponse,
  getIntelligentFallback
} from './conversation-engine.js';
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  delay
} from '@whiskeysockets/baileys';
import pino from 'pino';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import express from 'express';
import cors from 'cors';

dotenv.config();

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION:', reason);
});

const IS_CLOUD = !!(process.env.RAILWAY_ENVIRONMENT || process.env.RENDER || process.env.FLY_APP_NAME || process.env.IS_CLOUD);
console.log(`🏗️ Running in ${IS_CLOUD ? 'CLOUD' : 'LOCAL'} mode with Pure Baileys WebSocket`);

const API_PORT = process.env.PORT || 3001;
const DEFAULT_AUTH_DIR = path.resolve('./.baileys_auth');
let SESSION_DIR = DEFAULT_AUTH_DIR;

if (IS_CLOUD && fs.existsSync('/data')) {
  SESSION_DIR = '/data/.baileys_auth';
  const targetCreds = path.join(SESSION_DIR, `session-${DEFAULT_USER_ID}`, 'creds.json');
  if (!fs.existsSync(targetCreds) && fs.existsSync(DEFAULT_AUTH_DIR)) {
    try {
      fs.cpSync(DEFAULT_AUTH_DIR, SESSION_DIR, { recursive: true });
      console.log('📦 Seeded persistent volume /data/.baileys_auth from repository credentials.');
    } catch (e) {
      console.warn('Could not seed /data:', e.message);
    }
  }
}

if (!fs.existsSync(SESSION_DIR)) {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
}

// Supabase Setup
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://mvuvelhinkrplfpnroth.supabase.co';
const VALID_JWT_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12dXZlbGhpbmtycGxmcG5yb3RoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5NTcxMjEwMiwiZXhwIjoyMTExMjg4MTAyfQ.cQptTpuIcAIti6OrDMSpERbcH31OlmsYJfZ3HG3xO3Q';
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY.startsWith('eyJ')) ? process.env.SUPABASE_SERVICE_ROLE_KEY : VALID_JWT_SERVICE_KEY;
const DEFAULT_USER_ID = process.env.DEFAULT_USER_ID || '73573af4-8770-4571-a442-61eabfd21f15';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const app = express();
app.use(cors());
app.use(express.json());

// Multi-tenant sessions map: userId -> { sock, state, saveCreds }
const userSessions = new Map();

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime(), activeSessions: userSessions.size, ts: new Date().toISOString() });
});

app.get('/api/whatsapp-status', (req, res) => {
  const userId = req.query.userId || DEFAULT_USER_ID;
  const session = userSessions.get(userId);
  if (!session) {
    return res.json({ linked: false, authenticating: false, pendingQr: null, pairingCode: null });
  }
  res.json({
    linked: session.state.ready,
    authenticating: session.state.authenticating || false,
    pendingQr: session.state.pendingQr,
    pairingCode: session.state.pairingCode,
    phone: session.state.phone
  });
});

app.post('/api/request-pairing-code', async (req, res) => {
  const { userId, phoneNumber } = req.body;
  const uid = userId || DEFAULT_USER_ID;
  if (!phoneNumber) {
    return res.status(400).json({ ok: false, error: 'Phone number is required' });
  }
  const cleanPhone = phoneNumber.replace(/\D/g, '');
  console.log(`📱 Requesting Baileys pairing code for user ${uid}, phone: ${cleanPhone}`);

  try {
    const existing = userSessions.get(uid);
    if (existing?.sock) {
      try { existing.sock.end(undefined); } catch {}
      userSessions.delete(uid);
    }
    const userAuthDir = path.join(SESSION_DIR, `session-${uid}`);
    if (fs.existsSync(userAuthDir)) {
      fs.rmSync(userAuthDir, { recursive: true, force: true });
    }

    const session = await initBaileysClient(uid);
    await delay(3000);
    const code = await session.sock.requestPairingCode(cleanPhone);
    session.state.pairingCode = code;
    console.log(`✅ Baileys pairing code generated for ${cleanPhone}: ${code}`);

    res.json({ ok: true, pairingCode: code });
  } catch (err) {
    console.error('Pairing code generation error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/reset-session', async (req, res) => {
  const { userId } = req.body;
  const uid = userId || DEFAULT_USER_ID;
  const existing = userSessions.get(uid);
  if (existing?.sock) {
    try { existing.sock.end(undefined); } catch {}
    userSessions.delete(uid);
  }
  const userAuthDir = path.join(SESSION_DIR, `session-${uid}`);
  if (fs.existsSync(userAuthDir)) {
    fs.rmSync(userAuthDir, { recursive: true, force: true });
  }
  res.json({ ok: true, message: 'Session reset successfully' });
});

app.post('/api/send-message', async (req, res) => {
  const { userId, conversationId, message } = req.body;
  const uid = userId || DEFAULT_USER_ID;
  if (!conversationId || !message) {
    return res.status(400).json({ ok: false, error: 'conversationId and message are required' });
  }
  const session = userSessions.get(uid);
  if (!session || !session.state.ready) {
    return res.status(400).json({ ok: false, error: 'WhatsApp is not connected for your account.' });
  }
  try {
    const { data: convo } = await supabase.from('conversations').select('*').eq('id', conversationId).maybeSingle();
    if (!convo) return res.status(404).json({ ok: false, error: 'Conversation not found' });

    const phoneMatch = convo.title?.match(/\+(\d+)/) || convo.title?.match(/WhatsApp:\s*(\d+)/);
    const targetPhone = phoneMatch ? phoneMatch[1] : null;
    if (!targetPhone) return res.status(400).json({ ok: false, error: 'Could not extract WhatsApp phone from conversation title' });

    const jid = `${targetPhone}@s.whatsapp.net`;
    await session.sock.sendMessage(jid, { text: message });
    await supabase.from('chat_messages').insert({
      user_id: uid,
      conversation_id: conversationId,
      role: 'assistant',
      content: message,
      channel: 'whatsapp',
      metadata: { whatsapp_phone: targetPhone, whatsapp_jid: jid }
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

async function initBaileysClient(userId) {
  if (userSessions.has(userId)) return userSessions.get(userId);

  const userAuthDir = path.join(SESSION_DIR, `session-${userId}`);
  if (!fs.existsSync(userAuthDir)) fs.mkdirSync(userAuthDir, { recursive: true });

  const { state: authState, saveCreds } = await useMultiFileAuthState(userAuthDir);
  const { version } = await fetchLatestBaileysVersion();

  const state = { ready: false, authenticating: false, phone: null, name: null, pendingQr: null, pairingCode: null };

  const sock = makeWASocket({
    version,
    auth: authState,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    browser: ['Ubuntu', 'Chrome', '20.0.04']
  });

  const sessionObj = { sock, state, saveCreds };
  userSessions.set(userId, sessionObj);

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      try { state.pendingQr = await QRCode.toDataURL(qr); } catch {}
    }
    if (connection === 'open') {
      const myJid = sock.user?.id || '';
      const myPhone = myJid.split(':')[0] || myJid.split('@')[0];
      console.log(`✅ Baileys WhatsApp READY for user ${userId} | Phone: ${myPhone}`);
      state.ready = true;
      state.authenticating = false;
      state.phone = myPhone;
      state.pendingQr = null;
      state.pairingCode = null;

      try {
        const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', userId).maybeSingle();
        const name = profile?.display_name || 'Business Owner';
        const { data: existing } = await supabase.from('whatsapp_connections').select('*').eq('user_id', userId).eq('status', 'active').maybeSingle();
        if (!existing) {
          await supabase.from('whatsapp_connections').insert({
            user_id: userId,
            whatsapp_phone: myPhone,
            whatsapp_name: name,
            status: 'active'
          });
        }
      } catch (e) {
        console.error('Error syncing connection:', e);
      }
    } else if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(`⚠️ Baileys connection closed. Status: ${statusCode}. Reconnecting: ${shouldReconnect}`);
      state.ready = false;
      state.pendingQr = null;
      userSessions.delete(userId);
      if (shouldReconnect) {
        setTimeout(() => initBaileysClient(userId), 5000);
      } else {
        if (fs.existsSync(userAuthDir)) fs.rmSync(userAuthDir, { recursive: true, force: true });
      }
    }
  });

  const processedMsgIds = new Set();

  sock.ev.on('messages.upsert', async (m) => {
    if (m.type !== 'notify') return;
    for (const msg of m.messages) {
      if (!msg.message || msg.key.fromMe) continue;
      const msgId = msg.key.id;
      if (processedMsgIds.has(msgId)) continue;
      processedMsgIds.add(msgId);
      setTimeout(() => processedMsgIds.delete(msgId), 60000);

      const fromJid = msg.key.remoteJid;
      // STRICT FILTER: Never process or reply to groups, communities, broadcasts, or newsletters
      if (
        !fromJid ||
        fromJid.endsWith('@g.us') ||
        fromJid.includes('@g.us') ||
        fromJid.endsWith('@broadcast') ||
        fromJid.includes('@broadcast') ||
        fromJid.endsWith('@newsletter') ||
        fromJid.includes('@newsletter') ||
        fromJid.includes('@temp') ||
        Boolean(msg.key?.participant) ||
        Boolean(msg.participant) ||
        Boolean(msg.broadcast) ||
        fromJid === 'status@broadcast'
      ) {
        continue;
      }

      const fromPhone = fromJid.replace('@s.whatsapp.net', '').replace('@lid', '');
      const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      if (!body.trim()) continue;

      console.log(`💬 [User ${userId}] Incoming WhatsApp message from ${fromPhone}: "${body}"`);

      try {
        const contactName = msg.pushName || null;
        const title = contactName ? `WhatsApp: ${contactName} (${fromPhone})` : `WhatsApp: ${fromPhone}`;

        let { data: convo } = await supabase.from('conversations').select('id').eq('user_id', userId).eq('title', title).maybeSingle();
        let conversationId;
        if (convo) {
          conversationId = convo.id;
        } else {
          const { data: newConvo, error: convoErr } = await supabase.from('conversations').insert({ user_id: userId, title, title_generated: true }).select('id').single();
          if (convoErr) throw convoErr;
          conversationId = newConvo.id;
        }

        await supabase.from('chat_messages').insert({
          user_id: userId,
          conversation_id: conversationId,
          role: 'user',
          content: body,
          channel: 'whatsapp',
          metadata: { whatsapp_phone: fromPhone, whatsapp_name: contactName, whatsapp_jid: fromJid }
        });

        const { data: globalPref } = await supabase.from('preferences').select('value').eq('user_id', userId).eq('key', 'wa_global_auto_reply_disabled').maybeSingle();
        if (globalPref && (globalPref.value === true || globalPref.value?.disabled === true)) {
          console.log(`🤖 Auto-reply disabled for user ${userId}.`);
          await supabase.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', conversationId);
          continue;
        }

        const { data: autoReplyPref } = await supabase.from('preferences').select('value').eq('user_id', userId).eq('key', `wa_auto_reply_disabled:${conversationId}`).maybeSingle();
        if (autoReplyPref && (autoReplyPref.value === true || autoReplyPref.value?.disabled === true)) {
          console.log(`🤖 Auto-reply disabled for convo ${conversationId}.`);
          await supabase.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', conversationId);
          continue;
        }

        const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', userId).maybeSingle();
        const ownerName = profile?.display_name || 'Francisco';

        const { data: history } = await supabase.from('chat_messages').select('role, content').eq('conversation_id', conversationId).order('created_at', { ascending: true }).limit(50);
        const formattedMessages = (history ?? []).map((h) => ({ role: h.role === 'assistant' ? 'assistant' : 'user', content: h.content }));
        const detectedLanguage = detectLanguage(body);

        // Check if this is the first assistant message in this conversation
        const assistantMsgCount = (history ?? []).filter((h) => h.role === 'assistant').length;
        const isFirstAssistantReply = assistantMsgCount === 0;

        // Stage 1: Extract Working Memory & Topic Context
        const workingMemory = extractWorkingMemory(formattedMessages, body);

        // Stage 2: Intent Classification & Contextual Short-Message Resolution
        const intentData = classifyIntent(body, workingMemory, formattedMessages);
        console.log(`🧠 [User ${userId}] Intent: ${intentData.intent} | Topic: ${workingMemory.currentTopic} | Mood: ${workingMemory.userMood}`);

        const { data: kbPref } = await supabase.from('preferences').select('value').eq('user_id', userId).eq('key', 'business_knowledge_base').maybeSingle();
        const kb = kbPref?.value;
        const businessKnowledge = kb ? `\n=== BUSINESS KNOWLEDGE BASE ===\nCompany Name: ${kb.companyName || ownerName}\nAI Tone: ${kb.persona || 'Friendly & Professional'}\nServices: ${kb.description || ''}\nFAQs & Pricing:\n${kb.faqs || ''}\n=================================\n` : '';

        // Stage 3: Build Cognitive System Prompt
        const cognitiveSystemPrompt = buildCognitivePrompt({
          detectedLanguage,
          isFirstAssistantReply,
          contactName: contactName || fromPhone,
          workingMemory,
          intentData,
          businessKnowledge,
          ownerName
        });

        const currentMsg = body.trim();
        const historyWithoutCurrent = formattedMessages.filter((h, i) => !(i === formattedMessages.length - 1 && h.role === 'user' && h.content === currentMsg));
        const messagesForAI = [...historyWithoutCurrent.slice(-14), { role: 'user', content: currentMsg }];

        // Stage 4: Multi-Model Orchestration with Failover
        const groqKey = process.env.GROQ_API_KEY;
        const executionResult = await executeMultiModelCall(
          [{ role: 'system', content: cognitiveSystemPrompt }, ...messagesForAI],
          groqKey
        );

        let candidateReply = executionResult?.text || null;

        // Stage 5: Response Quality Critic & Safety Validator
        const recentAssistantMessages = formattedMessages
          .filter(m => m.role === 'assistant')
          .slice(-3)
          .map(m => m.content);

        const validation = validateResponse(candidateReply, intentData, workingMemory, recentAssistantMessages);
        let finalReply;

        if (validation.valid) {
          finalReply = validation.text;
        } else {
          console.warn(`⚠️ Candidate response rejected: ${validation.reason}. Generating targeted correction...`);
          const correctionPrompt = `${cognitiveSystemPrompt}\n\nCORRECTION REQUIRED: Your previous attempt was rejected because: "${validation.reason}". Provide a natural, direct, context-aware 1-2 sentence response without any canned phrases.`;
          const correctedResult = await executeMultiModelCall(
            [{ role: 'system', content: correctionPrompt }, ...messagesForAI],
            groqKey,
            ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b']
          );
          if (correctedResult?.text) {
            finalReply = correctedResult.text;
          } else {
            finalReply = getIntelligentFallback(intentData, workingMemory, isFirstAssistantReply, ownerName);
          }
        }

        await supabase.from('chat_messages').insert({
          user_id: userId, conversation_id: conversationId, role: 'assistant', content: finalReply, channel: 'whatsapp', metadata: { whatsapp_phone: fromPhone, whatsapp_jid: fromJid }
        });
        await supabase.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', conversationId);

        await sock.sendMessage(fromJid, { text: finalReply });
        console.log(`📨 [User ${userId}] Sent WhatsApp reply to ${fromPhone}: ${finalReply}`);
      } catch (err) {
        console.error('Error handling message:', err);
      }
    }
  });

  return sessionObj;
}

// Auto-start Baileys client on boot if session credentials exist
setTimeout(() => {
  const userAuthDir = path.join(SESSION_DIR, `session-${DEFAULT_USER_ID}`);
  if (fs.existsSync(userAuthDir) && fs.existsSync(path.join(userAuthDir, 'creds.json'))) {
    console.log(`🚀 Auto-starting Baileys client for ${DEFAULT_USER_ID} from existing credentials...`);
    initBaileysClient(DEFAULT_USER_ID);
  }
}, 3000);

function detectLanguage(text) {
  if (!text) return 'English';
  const lower = text.toLowerCase().trim();
  if (/[\u0600-\u06FF]/.test(text)) return 'Arabic';
  if (/[\u0400-\u04FF]/.test(text)) return 'Russian';
  if (/[\u4E00-\u9FFF]/.test(text)) return 'Chinese';
  const swahili = ['jambo', 'habari', 'asante', 'nakuja', 'sawa', 'tafadhali', 'mzuri', 'ndio', 'hapana', 'kazi', 'shilingi', 'pesa', 'nini', 'wapi', 'mambo'];
  if (swahili.some((w) => lower.includes(w))) return 'Swahili';
  const spanish = ['hola', 'gracias', 'buenos', 'por favor', 'amigo', 'cuanto', 'donde'];
  if (spanish.some((w) => lower.includes(w))) return 'Spanish';
  return 'English';
}


app.listen(API_PORT, '0.0.0.0', () => {
  console.log(`🌐 Baileys WhatsApp Server listening on http://0.0.0.0:${API_PORT}`);
});

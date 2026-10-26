import { v4 as uuidv4 } from 'uuid';
import { AuthUser } from '../auth/auth.middleware.js';
import { query } from '../database/db.js';
import { assertConversationAccess, getConversationMessages } from '../messages/messages.service.js';

export interface AiConfigResponse {
  configured: boolean;
  provider: string;
  model: string;
  systemPrompt: string;
  isActive: boolean;
  maskedKey: string | null;
  updatedAt?: string;
}

/**
 * Retrieve current AI configuration for the organisation.
 */
export async function getAiConfig(organisationId?: string): Promise<AiConfigResponse> {
  const res = await query(
    `SELECT provider, api_key, model, system_prompt, is_active, updated_at 
     FROM ai_settings 
     ${organisationId ? 'WHERE organisation_id = $1' : ''} 
     ORDER BY updated_at DESC LIMIT 1`,
    organisationId ? [organisationId] : []
  );

  if (res.rows.length > 0) {
    const row = res.rows[0];
    const key = row.api_key || '';
    const maskedKey = key.length > 8 
      ? `${key.slice(0, 4)}...${key.slice(-4)}`
      : '••••••••';

    return {
      configured: Boolean(key && row.is_active),
      provider: row.provider || 'openai',
      model: row.model || 'gpt-4o-mini',
      systemPrompt: row.system_prompt || 'You are the intelligent AI Assistant for AI Automation Labs Connect.',
      isActive: Boolean(row.is_active),
      maskedKey,
      updatedAt: row.updated_at,
    };
  }

  // Fallback to process.env if present
  const envKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY || '';
  if (envKey) {
    return {
      configured: true,
      provider: 'openai',
      model: 'gpt-4o-mini',
      systemPrompt: 'You are the intelligent AI Assistant for AI Automation Labs Connect.',
      isActive: true,
      maskedKey: `${envKey.slice(0, 4)}...${envKey.slice(-4)}`,
    };
  }

  return {
    configured: false,
    provider: 'openai',
    model: 'gpt-4o-mini',
    systemPrompt: 'You are the intelligent AI Assistant for AI Automation Labs Connect. You assist with customer communication, internal summaries, reply drafting, and task management.',
    isActive: false,
    maskedKey: null,
  };
}

/**
 * Save or update AI Provider & API Key (Owner/Admin only).
 */
export async function saveAiConfig(
  user: AuthUser,
  payload: {
    provider: string;
    apiKey: string;
    model?: string;
    systemPrompt?: string;
    isActive?: boolean;
  }
) {
  if (user.role !== 'owner' && user.role !== 'admin') {
    throw new Error('Only the Workspace Owner or Administrator can configure the AI API Key.');
  }

  const provider = (payload.provider || 'openai').toLowerCase().trim();
  const apiKey = (payload.apiKey || '').trim();
  const model = (payload.model || (provider === 'gemini' ? 'gemini-1.5-flash' : provider === 'anthropic' ? 'claude-3-5-sonnet-20241022' : 'gpt-4o-mini')).trim();
  const systemPrompt = payload.systemPrompt?.trim() || 'You are the intelligent AI Assistant for AI Automation Labs Connect.';
  const isActive = payload.isActive !== false;

  // Retrieve organisation ID
  const orgRes = await query('SELECT id FROM organisations LIMIT 1');
  const orgId = orgRes.rows[0]?.id;
  if (!orgId) {
    throw new Error('Organisation not found. Ensure the platform is bootstrapped.');
  }

  // If apiKey is omitted and row exists, keep existing key
  let finalKey = apiKey;
  if (!finalKey) {
    const existing = await query('SELECT api_key FROM ai_settings WHERE organisation_id = $1', [orgId]);
    if (existing.rows.length > 0 && existing.rows[0].api_key) {
      finalKey = existing.rows[0].api_key;
    } else {
      throw new Error('An API Key is required to activate the AI service.');
    }
  }

  const id = uuidv4();
  await query(
    `INSERT INTO ai_settings (id, organisation_id, provider, api_key, model, system_prompt, is_active, updated_by, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
     ON CONFLICT (organisation_id) DO UPDATE SET
       provider = EXCLUDED.provider,
       api_key = EXCLUDED.api_key,
       model = EXCLUDED.model,
       system_prompt = EXCLUDED.system_prompt,
       is_active = EXCLUDED.is_active,
       updated_by = EXCLUDED.updated_by,
       updated_at = NOW()`,
    [id, orgId, provider, finalKey, model, systemPrompt, isActive, user.id]
  );

  return {
    success: true,
    message: 'AI Provider & API Key configured successfully!',
    configured: true,
    provider,
    model,
    maskedKey: `${finalKey.slice(0, 4)}...${finalKey.slice(-4)}`,
  };
}

/**
 * Perform actual external LLM call to configured provider.
 */
async function callLlm(
  provider: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  conversationContext?: string
): Promise<string> {
  const contextBlock = conversationContext 
    ? `\n\n--- Conversation Context ---\n${conversationContext}\n--- End Context ---\n` 
    : '';

  if (provider === 'gemini') {
    const geminiModel = model || 'gemini-1.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;
    
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: `${systemPrompt}${contextBlock}\n\nUser Question:\n${userPrompt}` }
            ]
          }
        ]
      })
    });

    const data: any = await res.json();
    if (!res.ok) {
      const msg = data.error?.message || res.statusText;
      throw new Error(`Google Gemini API Error (${res.status}): ${msg}`);
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return reply || 'No response returned from Gemini.';
  }

  if (provider === 'anthropic') {
    const claudeModel = model || 'claude-3-5-sonnet-20241022';
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: claudeModel,
        system: systemPrompt,
        max_tokens: 1024,
        messages: [
          { role: 'user', content: `${contextBlock}\n\n${userPrompt}` }
        ]
      })
    });

    const data: any = await res.json();
    if (!res.ok) {
      const msg = data.error?.message || res.statusText;
      throw new Error(`Anthropic Claude API Error (${res.status}): ${msg}`);
    }

    return data.content?.[0]?.text || 'No response returned from Claude.';
  }

  // OpenAI / OpenRouter (Default)
  const endpoint = provider === 'openrouter' 
    ? 'https://openrouter.ai/api/v1/chat/completions'
    : 'https://api.openai.com/v1/chat/completions';
  
  const openAiModel = model || (provider === 'openrouter' ? 'openai/gpt-4o-mini' : 'gpt-4o-mini');

  const messages: any[] = [
    { role: 'system', content: `${systemPrompt}${contextBlock}` },
    { role: 'user', content: userPrompt }
  ];

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: openAiModel,
      messages,
      temperature: 0.7,
      max_tokens: 1000,
    })
  });

  const data: any = await res.json();
  if (!res.ok) {
    const msg = data.error?.message || res.statusText;
    throw new Error(`OpenAI API Error (${res.status}): ${msg}`);
  }

  return data.choices?.[0]?.message?.content || 'No response returned from OpenAI.';
}

/**
 * Interactive AI Chatbot Endpoint
 */
export async function chatWithAi(
  user: AuthUser,
  prompt: string,
  conversationId?: string
) {
  if (!prompt || !prompt.trim()) {
    throw new Error('Prompt cannot be empty.');
  }

  // Fetch actual API configuration
  const configRes = await query('SELECT provider, api_key, model, system_prompt, is_active FROM ai_settings WHERE is_active = true LIMIT 1');
  let provider = 'openai';
  let apiKey = '';
  let model = 'gpt-4o-mini';
  let systemPrompt = 'You are the intelligent AI Assistant for AI Automation Labs Connect.';

  if (configRes.rows.length > 0) {
    provider = configRes.rows[0].provider;
    apiKey = configRes.rows[0].api_key;
    model = configRes.rows[0].model;
    systemPrompt = configRes.rows[0].system_prompt;
  } else {
    apiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY || '';
  }

  if (!apiKey) {
    return {
      configured: false,
      response: `⚠️ **AI API Key Not Configured**\n\nThe AI Chatbot requires an API Key from the platform Owner.\n\n👉 **To configure:**\n1. Click **✨ AI Assistant** in the top navigation bar.\n2. Switch to the **API Configuration** tab.\n3. Enter your **OpenAI**, **Google Gemini**, or **Anthropic** API Key and click **Save Key**.\n\nOnce entered, the chatbot and copilots will respond live!`,
      provider,
      model,
      generatedAt: new Date().toISOString(),
    };
  }

  let conversationContext = '';
  if (conversationId) {
    try {
      await assertConversationAccess(user, conversationId);
      const history = await getConversationMessages(user, conversationId, { limit: 15 });
      conversationContext = history.messages
        .map((m: any) => `[${m.authorName || 'User'}]: ${m.body}`)
        .join('\n');
    } catch {
      // If no conversation access, proceed without conversation context
    }
  }

  try {
    const reply = await callLlm(provider, apiKey, model, systemPrompt, prompt, conversationContext);
    return {
      configured: true,
      response: reply,
      provider,
      model,
      generatedAt: new Date().toISOString(),
    };
  } catch (err: any) {
    return {
      configured: true,
      error: true,
      response: `❌ **AI Execution Error**:\n\n${err.message}\n\nPlease verify your API Key and model permissions in AI Settings.`,
      provider,
      model,
      generatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Test AI Connection with provided credentials
 */
export async function testAiConnection(
  user: AuthUser,
  payload: { provider: string; apiKey?: string; model?: string }
) {
  if (user.role !== 'owner' && user.role !== 'admin') {
    throw new Error('Only the Workspace Owner can test AI API keys.');
  }

  let apiKey = payload.apiKey?.trim();
  if (!apiKey) {
    const existing = await query('SELECT api_key FROM ai_settings LIMIT 1');
    apiKey = existing.rows[0]?.api_key;
  }

  if (!apiKey) {
    throw new Error('Please enter an API Key to test the connection.');
  }

  const provider = (payload.provider || 'openai').toLowerCase().trim();
  const model = payload.model || (provider === 'gemini' ? 'gemini-1.5-flash' : provider === 'anthropic' ? 'claude-3-5-sonnet-20241022' : 'gpt-4o-mini');

  const testReply = await callLlm(
    provider,
    apiKey,
    model,
    'You are an AI diagnostic service. Respond strictly with: "AI Connected Successfully!"',
    'Ping connection check'
  );

  return {
    success: true,
    provider,
    model,
    message: testReply.trim(),
  };
}

/**
 * Contextual Conversation AI Assistant (Summaries, Reply Drafts, Task Extraction)
 */
export async function generateAiAssistance(
  user: AuthUser,
  conversationId: string,
  mode: 'summarize' | 'draft_reply' | 'extract_tasks'
) {
  await assertConversationAccess(user, conversationId);

  const history = await getConversationMessages(user, conversationId, { limit: 20 });
  const messages = history.messages;

  if (messages.length === 0) {
    return {
      mode,
      summary: 'No messages available in this conversation to analyze.',
      suggestedReply: 'Hello! How can we assist you today?',
      suggestedTasks: [],
    };
  }

  const transcript = messages
    .map((m: any) => `[${m.authorName || 'User'}]: ${m.body}`)
    .join('\n');

  // Check if live AI is configured
  const configRes = await query('SELECT provider, api_key, model, system_prompt, is_active FROM ai_settings WHERE is_active = true LIMIT 1');
  const hasKey = configRes.rows.length > 0 && configRes.rows[0].api_key;

  if (hasKey) {
    const { provider, api_key, model, system_prompt } = configRes.rows[0];
    try {
      let prompt = '';
      if (mode === 'summarize') {
        prompt = `Please provide a concise, structured bulleted summary of this conversation (${history.conversation.title}). Include key customer requirements, current status, and next steps.`;
        const aiSummary = await callLlm(provider, api_key, model, system_prompt, prompt, transcript);
        return {
          mode: 'summarize',
          summary: aiSummary,
          generatedAt: new Date().toISOString(),
        };
      }
      if (mode === 'draft_reply') {
        prompt = `Draft a polite, professional, and clear response from AI Automation Labs to the customer's latest request in this conversation.`;
        const aiDraft = await callLlm(provider, api_key, model, system_prompt, prompt, transcript);
        return {
          mode: 'draft_reply',
          suggestedReply: aiDraft,
          generatedAt: new Date().toISOString(),
        };
      }
      if (mode === 'extract_tasks') {
        prompt = `Extract up to 4 clear action items or tasks from this conversation. Format as a clean numbered list with priority (High/Normal/Low).`;
        const aiTasks = await callLlm(provider, api_key, model, system_prompt, prompt, transcript);
        return {
          mode: 'extract_tasks',
          suggestedTasks: [
            { title: aiTasks.split('\n')[0] || 'Review customer requirements', priority: 'high' }
          ],
          rawResponse: aiTasks,
          generatedAt: new Date().toISOString(),
        };
      }
    } catch (err: any) {
      console.warn('[AI Assistance Live Error, fallbacking to template]:', err.message);
    }
  }

  // Fallback response if no key yet configured
  if (mode === 'summarize') {
    return {
      mode: 'summarize',
      summary: `📋 **Conversation Summary (${history.conversation.title})**:\n• Total messages: ${messages.length}\n• Status: ${history.conversation.status.toUpperCase()}\n• Key focus: Customer requirements and project workflows.\n\n💡 *Tip: Enter an OpenAI/Gemini API Key in topbar AI Settings for dynamic live AI analysis.*`,
      generatedAt: new Date().toISOString(),
    };
  }

  if (mode === 'extract_tasks') {
    return {
      mode: 'extract_tasks',
      suggestedTasks: [
        { title: `Follow up on ${history.conversation.title} action items`, priority: 'high' },
        { title: `Verify client requirements and schedule milestone sync`, priority: 'normal' }
      ],
      generatedAt: new Date().toISOString(),
    };
  }

  const lastMsg = messages[messages.length - 1];
  return {
    mode: 'draft_reply',
    suggestedReply: `Hello! Thank you for the update. Our team at AI Automation Labs has received your message and is reviewing the details. We will share the next milestone shortly.`,
    context: `Drafted in response to: "${lastMsg.body.slice(0, 80)}..."`,
    generatedAt: new Date().toISOString(),
  };
}

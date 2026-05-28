const axios = require('axios');
const config = require('../config.json');
const { getContext, addContextMessage } = require('./contextMemory');

async function askAI(username, question) {
  if (!config.ai.enabled) return 'AI 未开启';
  const { apiKey, model, endpoint, systemPrompt, contextMemory } = config.ai;
  if (!apiKey || !endpoint) return 'AI 配置不完整';
  try {
    let messages = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    if (contextMemory) {
      const history = getContext(username);
      messages.push(...history);
    }
    messages.push({ role: 'user', content: question });
    const resp = await axios.post(endpoint, { model, messages, temperature: 0.7, max_tokens: 200 }, {
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      timeout: 12000
    });
    const reply = resp.data.choices?.[0]?.message?.content?.trim() || '(无回复)';
    if (contextMemory) {
      addContextMessage(username, 'user', question);
      addContextMessage(username, 'assistant', reply);
    }
    return reply;
  } catch (e) { return 'AI 暂时不可用'; }
}

module.exports = { askAI };
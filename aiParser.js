const axios = require('axios');
const config = require('./config');
const actionExecutor = require('./actionExecutor');
const { sleep, randomDelay } = require('./utils');

function processRelativeCoords(command, bot) {
  if (!config.features.enableRelativeCoords) return command;
  const pos = bot.entity.position;
  const hasNumbers = /\d+/.test(command);
  if ((command.includes('我') || command.includes('脚下')) && !hasNumbers) {
    const coordStr = `${pos.x.toFixed(1)} ${pos.y.toFixed(1)} ${pos.z.toFixed(1)}`;
    command = command.replace(/我|脚下/g, coordStr);
  }
  return command;
}

async function parseCommand(command, bot) {
  const { apiKey, model, apiUrl } = config.ai;
  const playerPos = bot.entity.position;
  const ownerName = config.bot.owner;
  const ownerEntity = Object.values(bot.entities).find(e => e.type === 'player' && e.username === ownerName);
  const ownerPos = ownerEntity ? ownerEntity.position : null;

  const systemPrompt = `你是一个Minecraft机器人命令解析器。请将用户的自然语言指令解析为JSON动作数组。

当前机器人位置: (${playerPos.x.toFixed(1)}, ${playerPos.y.toFixed(1)}, ${playerPos.z.toFixed(1)})
玩家"${ownerName}"的位置: ${ownerPos ? `(${ownerPos.x.toFixed(1)}, ${ownerPos.y.toFixed(1)}, ${ownerPos.z.toFixed(1)})` : '未知'}

可用的动作：
1. 移动到坐标: {"action":"moveTo", "x":数字, "y":数字, "z":数字}
2. 跟随玩家: {"action":"follow", "target":"玩家名"}
3. 聊天: {"action":"chat", "message":"字符串"}
4. 私聊: {"action":"whisper", "target":"玩家名", "message":"字符串"}
5. 挖掘: {"action":"digBlock", "x":数字, "y":数字, "z":数字}
6. 放置: {"action":"placeBlock", "x":数字, "y":数字, "z":数字, "blockName":"方块ID"}
7. 攻击: {"action":"attack", "target":"玩家名"}
8. 使用物品: {"action":"useItem", "item":"物品名"}
9. 打开箱子: {"action":"openChest", "x":数字, "y":数字, "z":数字}

重要：只返回JSON数组，不要任何额外文字。对于"过来"、"跟随"等，使用 follow。坐标必须为数字。

示例：
"过来" -> [{"action":"follow","target":"zwzzxy"}]
"走到100 64 200" -> [{"action":"moveTo","x":100,"y":64,"z":200}]
"说大家好" -> [{"action":"chat","message":"大家好"}]
"私聊 zwzzxy 说秘密" -> [{"action":"whisper","target":"zwzzxy","message":"秘密"}]`;

  try {
    const response = await axios.post(apiUrl, {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: command }
      ],
      temperature: 0.1
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    });

    const content = response.data.choices[0].message.content;
    console.log(`🧠 AI: ${content}`);
    let actions;
    try {
      actions = JSON.parse(content);
    } catch {
      const jsonMatch = content.match(/\[.*\]/s);
      if (jsonMatch) actions = JSON.parse(jsonMatch[0]);
      else throw new Error('Invalid JSON');
    }
    if (!Array.isArray(actions)) throw new Error('Not array');
    return actions;
  } catch (error) {
    console.error('❌ AI失败:', error.message);
    throw new Error('AI解析失败');
  }
}

async function parseAndExecute(bot, command, options = {}) {
  const { isWhisper = false, from = null } = options;
  try {
    const processed = processRelativeCoords(command, bot);
    const actions = await parseCommand(processed, bot);
    console.log(`✅ 解析 ${actions.length} 个动作`);
    for (const action of actions) {
      await actionExecutor.execute(bot, action);
      await sleep(randomDelay());
    }
    const msg = '主人，命令执行完毕！';
    if (isWhisper && from) bot.whisper(from, msg);
    else bot.chat(msg);
  } catch (err) {
    console.error('❌ 执行失败:', err.message);
    const msg = `主人，命令处理失败: ${err.message}`;
    if (isWhisper && from) bot.whisper(from, msg);
    else bot.chat(msg);
  }
}

module.exports = { parseAndExecute };
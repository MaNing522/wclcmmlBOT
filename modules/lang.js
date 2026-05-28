const fs = require('fs');
const path = require('path');

let translations = {};
let reverseTranslations = {};

// 1. 优先从项目 assets 目录加载官方汉化文件
const assetsLangPath = path.join(__dirname, '..', 'assets', 'minecraft', 'lang', 'zh_cn.json');
if (fs.existsSync(assetsLangPath)) {
  try {
    const raw = JSON.parse(fs.readFileSync(assetsLangPath, 'utf8'));
    for (const [key, value] of Object.entries(raw)) {
      const match = key.match(/^(block|item)\.minecraft\.(.+)$/);
      if (match) {
        const englishName = match[2];
        translations[englishName] = value;
        reverseTranslations[value] = englishName;
      }
    }
    console.log(`已从 assets 加载 ${Object.keys(translations).length} 条官方汉化`);
  } catch (e) {
    console.error('加载 assets 官方汉化失败:', e.message);
  }
}

// 2. 回退：加载内置小型汉化词典
if (Object.keys(translations).length === 0) {
  const fallbackPath = path.join(__dirname, 'translations.json');
  if (fs.existsSync(fallbackPath)) {
    try {
      translations = JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
      for (const [english, chinese] of Object.entries(translations)) {
        reverseTranslations[chinese] = english;
      }
      console.log(`已加载 ${Object.keys(translations).length} 条内置汉化`);
    } catch (e) {}
  }
}

function translate(itemName) {
  return translations[itemName] || itemName;
}

function reverseTranslate(chineseName) {
  return reverseTranslations[chineseName] || null;
}

module.exports = { translate, reverseTranslate };
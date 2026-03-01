// 测试 Wiki HTML 解析

const testHtml = `
<h3><span class="mw-headline" id="Minions">Minions</span></h3>
<p>1x <span id="Viscount"><b>Viscount</b></span> - power 5 - Ongoing: Once per turn, after you play a fusion and use its Action ability, you may give this minion +2 power until the end of the turn OR place a +1 power counter on it.</p>

<h3><span class="mw-headline" id="Actions">Actions</span></h3>
<p>1x <span id="Go,_Gerald!"><b>Go, Gerald!</b></span> - Choose a base. Give each of your minions played there this turn +2 power until the end of the turn.</p>
<p>1x <span id="Now_You_Know:_Home_Safety"><b>Now You Know: Home Safety</b></span> - Play an extra minion of power 2 or less. If it is a fusion, you may also use its Action ability.</p>

<h3><span class="mw-headline" id="Fusions">Fusions</span></h3>
<p>1x <span id="M.O.W.A.T."><b>M.O.W.A.T.</b></span> - power 2 - Minion: You may give another minion +1 power until the end of the turn.|Action: Give a minion +3 power until the end of the turn.</p>
<p>2x <span id="Can-Do"><b>Can-Do</b></span> - power 4 - Minion: You may play an extra minion of power 2 or less here, or an extra action.|Action: You may play an extra minion of power 2 or less, and an extra action.</p>
`;

function parseCards(html) {
  const cards = [];
  
  // 通用解析函数
  function parseSection(sectionName, type) {
    console.log(`\n解析 ${sectionName} 部分...`);
    
    // 查找章节标题
    const sectionRegex = new RegExp(`<h3[^>]*>.*?${sectionName}.*?</h3>([\\s\\S]*?)(?=<h3|$)`, 'i');
    const sectionMatch = html.match(sectionRegex);
    
    if (!sectionMatch) {
      console.log(`  未找到 ${sectionName} 章节`);
      return;
    }
    
    const sectionHtml = sectionMatch[1];
    console.log(`  章节 HTML 长度: ${sectionHtml.length}`);
    
    // 匹配所有段落中的卡牌
    const paragraphs = sectionHtml.match(/<p>.*?<\/p>/gi) || [];
    console.log(`  找到 ${paragraphs.length} 个段落`);
    
    for (const p of paragraphs) {
      console.log(`\n  处理段落: ${p.substring(0, 100)}...`);
      
      // 提取数量
      const countMatch = p.match(/(\d+)x/);
      if (!countMatch) {
        console.log(`    未找到数量`);
        continue;
      }
      console.log(`    数量: ${countMatch[1]}`);
      
      // 提取名称
      const nameMatch = p.match(/<b>([^<]+)<\/b>/);
      if (!nameMatch) {
        console.log(`    未找到名称`);
        continue;
      }
      console.log(`    名称: ${nameMatch[1]}`);
      
      // 提取 power（如果有）
      const powerMatch = p.match(/power\s+(\d+)/i);
      if (powerMatch) {
        console.log(`    Power: ${powerMatch[1]}`);
      }
      
      // 提取描述
      const descMatch = p.match(/<\/b><\/span>\s*-\s*(.+?)<\/p>/);
      let description = '';
      if (descMatch) {
        description = descMatch[1]
          .replace(/<[^>]+>/g, '')
          .replace(/&[^;]+;/g, '')
          .trim()
          .substring(0, 100);
        console.log(`    描述: ${description}...`);
      }
      
      cards.push({
        name: nameMatch[1].trim(),
        count: parseInt(countMatch[1]),
        type: type,
        power: powerMatch ? parseInt(powerMatch[1]) : undefined,
        description: description
      });
    }
  }
  
  // 解析各个部分
  parseSection('Minions', 'minion');
  parseSection('Actions', 'action');
  parseSection('Fusions', 'fusion');
  
  return cards;
}

const cards = parseCards(testHtml);

console.log('\n\n=== 解析结果 ===');
cards.forEach(card => {
  console.log(`${card.count}x ${card.name} (${card.type}${card.power ? `, power ${card.power}` : ''})`);
  if (card.description) {
    console.log(`  ${card.description}`);
  }
});

console.log(`\n总计: ${cards.length} 种卡牌，共 ${cards.reduce((sum, c) => sum + c.count, 0)} 张`);

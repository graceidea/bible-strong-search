// ==========================================
// 1. 生成表格 HTML 與精準編號染色邏輯（密集日誌調試版：揪出死循環）
// ==========================================
function buildSectionsHtml(groups, keyword, isSimplifiedMode) {
  console.log("%c>>> 进入 buildSectionsHtml 函数 <<<", "color: green; font-weight: bold; font-size: 14px;");
  console.log("-> 传入关键字 (keyword):", keyword);
  console.log("-> 传入的分组键 (StrongIds):", Object.keys(groups));

  let html = "";
  const cleanGroups = {};
  
  // 🎯 阶段 1：深度清洗与数据过滤
  console.log("%c【开始阶段 1：清洗无关编号】", "color: #ff9900; font-weight: bold;");
  
  Object.keys(groups).forEach(strongId => {
    const verses = groups[strongId];
    const validVerses = [];
    const targetStrong = strongId.trim().toUpperCase();

    console.log(` -> [开始检查编号] ${strongId} | 该编号下共有经文 ${verses.length} 节`);

    verses.forEach((v, idx) => {
      console.log(`    -> [章节循环] 正在处理第 ${idx + 1}/${verses.length} 节: ${v.book_name} ${v.chapter}:${v.verse}`);
      
      const currentDb = isSimplifiedMode ? bibleSimpData : bibleData;
      
      if (!currentDb) {
        console.error("    🚨 [错误] 找不到对应的圣经数据库变量(bibleSimpData/bibleData)");
        return;
      }

      const originalEntry = currentDb.find(s => 
        parseInt(s.book, 10) === v.book_id && 
        parseInt(s.chapter, 10) === parseInt(v.chapter, 10) && 
        parseInt(s.verse, 10) === parseInt(v.verse, 10)
      );

      if (originalEntry && originalEntry.text) {
        const rawText = originalEntry.text;
        const upperText = rawText.toUpperCase();
        
        console.log(`    -> 数据库带编号原文: "${rawText}"`);
        
        if (upperText.includes(targetStrong)) {
          console.log(`    -> [命中编号] 原文包含目标编号 ${targetStrong}，开始执行字串切分...`);
          
          const parts = upperText.split(targetStrong);
          const leftSegment = parts[0]; 
          
          console.log(`    -> 切分后的左侧片段: "${leftSegment}"`);
          
          const tailText = leftSegment.substring(Math.max(0, leftSegment.length - 8));
          console.log(`    -> 提取左侧末尾段落(限长8字): "${tailText}"`);

          if (tailText.includes(keyword)) {
            console.log(`    ✅ [有效经文] 该编号左侧包含关键字 "${keyword}"，保留此节经文`);
            validVerses.push(v);
          } else {
            console.log(`    ❌ [剔除经文] 该编号左侧不包含关键字 "${keyword}"，放弃此节`);
          }
        } else {
          console.log(`    ⚠️ [编号未对齐] 传入了该编号但在原文中未找到对齐节点`);
        }
      } else {
        console.log(`    ⚠️ [无编号数据] 触发 Fallback 保守保留校验`);
        if (v.text && v.text.includes(keyword)) {
          validVerses.push(v);
        }
      }
    });

    if (validVerses.length > 0) {
      console.log(` 🏆 [编号处理完毕] 编号 ${strongId} 通过清洗，有效经文数: ${validVerses.length}`);
      cleanGroups[strongId] = validVerses;
    } else {
      console.log(` 🗑️ [编号完全剔除] 编号 ${strongId} 下无任何相关字绑定，彻底丢弃此表格`);
    }
  });

  // 🎯 阶段 2：进行排序与网页渲染
  console.log("%c【开始阶段 2：数据渲染排版】", "color: #ff9900; font-weight: bold;");
  const sortedKeys = Object.keys(cleanGroups).sort(sortStrongIds);
  console.log("-> 最终保留并参与渲染的 StrongIds:", sortedKeys);

  if (sortedKeys.length === 0) {
    console.log("-> 渲染结果: 没有任何有效结果");
    return "<div class='no-result' style='padding: 20px; text-align: center; color: #999;'>未找到符合原文綁定條件的經文。</div>";
  }

  sortedKeys.forEach(strongId => {
    let verses = cleanGroups[strongId];
    const targetStrong = strongId.trim().toUpperCase();
    
    console.log(` -> [开始渲染表格] 原文编号: ${strongId}`);

    verses.sort((a, b) => {
      if (a.book_id !== b.book_id) return a.book_id - b.book_id;
      if (parseInt(a.chapter, 10) !== parseInt(b.chapter, 10)) return parseInt(a.chapter, 10) - parseInt(b.chapter, 10);
      return parseInt(a.verse, 10) - parseInt(b.verse, 10);
    });

    const definitionHtml = getLocalStrongsDefinitionHtml(strongId);
    const isNewTestament = strongId.trim().toUpperCase().startsWith('G');
    const ntClass = isNewTestament ? 'nt-group' : '';

    html += `
      <div class='group-title ${ntClass}'>
        <span>原文編號: <strong>${strongId}</strong>${definitionHtml}</span>
        <span class="summary-badge">共 ${verses.length} 節</span>
      </div>
      <table>
        <thead>
          <tr><th style='width:25%'>書卷</th><th style='width:20%'>章節</th><th>經文內容</th></tr>
        </thead>
        <tbody>
    `;

    verses.forEach((v, idx) => {
      console.log(`    -> [渲染经文行] ${idx + 1}/${verses.length}: ${v.book_name}`);
      const currentDb = isSimplifiedMode ? bibleSimpData : bibleData;
      const originalEntry = currentDb ? currentDb.find(s => 
        parseInt(s.book, 10) === v.book_id && 
        parseInt(s.chapter, 10) === parseInt(v.chapter, 10) && 
        parseInt(s.verse, 10) === parseInt(v.verse, 10)
      ) : null;

      let highlightedText = "";
      
      if (originalEntry && originalEntry.text) {
        let rawText = originalEntry.text;
        const upperText = rawText.toUpperCase();
        
        if (upperText.includes(targetStrong)) {
          const startIndex = upperText.indexOf(targetStrong);
          const leftText = rawText.substring(0, startIndex);
          const rightText = rawText.substring(startIndex);
          
          console.log("       -> [开始指针对齐定位]");
          let wordStart = leftText.length - 1;
          
          // 🛠️ 重点防御：防止无限循环的回溯指针防御锁
          let loopCount = 0;
          while (wordStart >= 0 && /[^\x00-\xff]/.test(leftText[wordStart])) {
            wordStart--;
            loopCount++;
            if (loopCount > 200) { 
              console.error("       🚨 [指针死循环预警] 回溯指针打破上限！"); 
              break; 
            }
          }
          wordStart++; 
          
          const targetWord = leftText.substring(wordStart);
          const remainLeft = leftText.substring(0, wordStart);
          
          console.log(`       -> 定位到属于当前编号的中文词组为: "${targetWord}"`);

          if (targetWord.includes(keyword)) {
            rawText = remainLeft + `__RED_START__${targetWord}__RED_END__` + rightText;
          }
        }

        console.log("       -> [清洗正则] 执行非高亮大清除...");
        // 🎯 重点防御：检查是不是原有的全局大清洗正则卡死
        rawText = rawText.replace(/[<{ ]*[GH]\d+[a-zA-Z]?[>} ]*/gi, '');
        rawText = rawText.replace(/[<>{}[\]]/g, '');

        rawText = rawText.split("__RED_START__").join(`<span style="color: red; font-weight: bold;">`);
        rawText = rawText.split("__RED_END__").join(`</span>`);
        highlightedText = rawText;
        
      } else {
        const safeText = typeof escapeHtml === 'function' ? escapeHtml(v.text) : v.text;
        highlightedText = safeText.split(keyword).join(`<span style="color: red; font-weight: bold;">${keyword}</span>`);
      }

      html += `
        <tr>
          <td>${v.book_name}</td>
          <td>${v.chapter}:${v.verse}</td>
          <td>${highlightedText}</td>
        </tr>
      `;
    });

    html += `</tbody></table><hr class='group-divider'>`;
  });

  console.log("%c<<< buildSectionsHtml 渲染完毕，安全输出 >>>", "color: green; font-weight: bold;");
  return html;
}

// ==========================================
// 2. 獲取本地辭典定義 HTML
// ==========================================
function getLocalStrongsDefinitionHtml(strongId) {
  const dict = typeof strongsDict !== 'undefined' ? strongsDict : window.strongsDict;
  if (!dict || !dict[strongId]) return "";

  const rawText = dict[strongId];
  let lemma = "";
  let content = rawText;

  const safeEscape = typeof escapeHtml === 'function' ? escapeHtml : function(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  };

  if (rawText.includes('|')) {
    const parts = rawText.split('|');
    lemma = `<span class="dict-lemma" style="color: #4a90e2; font-weight: bold; margin-left: 5px;">${safeEscape(parts[0].trim())}</span>`;
    content = parts.slice(1).join('|').trim();
  }

  let formattedContent = safeEscape(content).replace(/\n/g, '<br>');

  if (formattedContent.length > 150) {
    formattedContent = formattedContent.substring(0, 150) + "...";
  }

  return `
    <div class="strongs-tooltip" style="display: inline-block; margin-left: 10px; position: relative; font-size: 14px;">
      <span class="tooltip-trigger" style="cursor: pointer; background: #eef2f7; padding: 2px 6px; border-radius: 4px; color: #555; border: 1px solid #ddd;">ℹ️ 字典定義</span>
      <div class="tooltip-content" style="display: none; position: absolute; left: 0; top: 25px; background: white; border: 1px solid #ccc; padding: 10px; width: 320px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 999; border-radius: 6px; font-weight: normal; color: #333; text-align: left; line-height: 1.4;">
        <div class="dict-header" style="border-bottom: 1px solid #eee; padding-bottom: 5px; margin-bottom: 5px; font-weight: bold; color: #000;">
          ${safeEscape(strongId)} ${lemma}
        </div>
        <div class="dict-body" style="max-height: 200px; overflow-y: auto; font-size: 13px;">
          ${formattedContent}
        </div>
      </div>
    </div>
  `;
}

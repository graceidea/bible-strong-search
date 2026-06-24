// ==========================================
// 1. 生成表格 HTML 與精準編號染色邏輯（100% 安全、剔除無關編號、絕不死循環版）
// ==========================================
function buildSectionsHtml(groups, keyword, isSimplifiedMode) {
  let html = "";
  
  // 🎯 1. 建立一個乾淨的儲存容器
  const cleanGroups = {};
  
  // 遍歷所有原始強編號
  Object.keys(groups).forEach(strongId => {
    const verses = groups[strongId];
    const validVerses = [];
    const escapedStrong = strongId.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    
    // 構造一個局部無死循環的安全正則：只負責提取該 strongId 左邊的中文詞組
    // 去掉了全球匹配修飾符 'g'，杜絕 lastIndex 導致的死循環
    const matchRegex = new RegExp(`([^\\x00-\\xff\\s<{|\\[]*)(?=[\\s<{|\\[]*${escapedStrong}\\b)`, "i");

    verses.forEach(v => {
      const currentDb = isSimplifiedMode ? bibleSimpData : bibleData;
      const originalEntry = currentDb ? currentDb.find(s => 
        parseInt(s.book, 10) === v.book_id && 
        parseInt(s.chapter, 10) === parseInt(v.chapter, 10) && 
        parseInt(s.verse, 10) === parseInt(v.verse, 10)
      ) : null;

      if (originalEntry && originalEntry.text) {
        const rawText = originalEntry.text;
        const matchResult = rawText.match(matchRegex);
        
        // 只要當前強編號左側緊鄰的中文詞組（例如 [0] 是 "你所愛的人"、"愛心" 等）確實包含關鍵字
        if (matchResult && matchResult[0] && matchResult[0].includes(keyword)) {
          validVerses.push(v);
        }
      } else {
        // Fallback 安全回退：若無編號數據庫，只要純文字包含關鍵字就保留
        if (v.text && v.text.includes(keyword)) {
          validVerses.push(v);
        }
      }
    });

    // 🎯 只有當這個原文編號下，存在真正與關鍵字綁定的經文時，才保留這個 StrongId 表格
    if (validVerses.length > 0) {
      cleanGroups[strongId] = validVerses;
    }
  });

  // 🎯 2. 使用安全清洗後的數據進行排序與渲染
  const sortedKeys = Object.keys(cleanGroups).sort(sortStrongIds);

  if (sortedKeys.length === 0) {
    return "<div class='no-result' style='padding: 20px; text-align: center; color: #999;'>未找到符合原文綁定條件的經文。</div>";
  }

  sortedKeys.forEach(strongId => {
    let verses = cleanGroups[strongId];
    
    // 按卷、章、節排序
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

    verses.forEach(v => {
      const currentDb = isSimplifiedMode ? bibleSimpData : bibleData;
      const originalEntry = currentDb ? currentDb.find(s => 
        parseInt(s.book, 10) === v.book_id && 
        parseInt(s.chapter, 10) === parseInt(v.chapter, 10) && 
        parseInt(s.verse, 10) === parseInt(v.verse, 10)
      ) : null;

      let highlightedText = "";
      
      if (originalEntry && originalEntry.text) {
        let rawText = originalEntry.text;
        const escapedStrong = strongId.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        
        // 渲染時使用非全局的精準匹配替換，配合循環確保安全
        const renderRegex = new RegExp(`([^\\x00-\\xff\\s<{|\\[]*${keyword}[^\\x00-\\xff\\s<{|\\[]*)(?=[\\s<{|\\[]*${escapedStrong}\\b)`, "i");
        
        // 使用 while 替換，安全無感，絕不卡死
        let match;
        while ((match = rawText.match(renderRegex)) !== null) {
          const matchedText = match[1];
          // 臨時標記防二次重複匹配
          rawText = rawText.replace(renderRegex, `__RED_START__${matchedText}__RED_END__`);
        }

        // 大掃除：徹底蒸發經文裡的所有原文編號與殘留括號
        rawText = rawText.replace(/[<{ ]*[GH]\d+[a-zA-Z]?[>} ]*/gi, '');
        rawText = rawText.replace(/[<>{}[\]]/g, '');

        // 還原紅色標籤
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
    lemma = `<span class="dict-lemma" style="color: #4a90e2; font-weight: bold; margin-left: 5px;">${safeEscape(parts.trim())}</span>`;
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

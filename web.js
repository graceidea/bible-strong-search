// ==========================================
// 1. 生成表格 HTML 與精準編號染色邏輯（柔和局部清洗、真愛回歸純淨版）
// ==========================================
function buildSectionsHtml(groups, keyword, isSimplifiedMode) {
  let html = "";
  const cleanGroups = {};
  
  // 🎯 1. 柔和清洗與數據過濾
  Object.keys(groups).forEach(strongId => {
    const verses = groups[strongId];
    const validVerses = [];
    const targetStrong = strongId.trim().toUpperCase();

    verses.forEach(v => {
      const currentDb = isSimplifiedMode ? bibleSimpData : bibleData;
      const originalEntry = currentDb ? currentDb.find(s => 
        parseInt(s.book, 10) === v.book_id && 
        parseInt(s.chapter, 10) === parseInt(v.chapter, 10) && 
        parseInt(s.verse, 10) === parseInt(v.verse, 10)
      ) : null;

      if (originalEntry && originalEntry.text) {
        const rawText = originalEntry.text;
        const upperText = rawText.toUpperCase();
        
        if (upperText.includes(targetStrong)) {
          const idx = upperText.indexOf(targetStrong);
          const leftPart = rawText.substring(0, idx);
          
          // 🛠️ 核心修正：捕獲緊鄰該編號左側的連續漢字詞組
          const wordMatch = leftPart.match(/([^\x00-\xff]+)[<\s{\[]*$/);
          
          if (wordMatch) {
            const exactBoundWord = wordMatch[1]; // 拿到緊挨著這個編號的中文詞（例如 "愛我"、"你所愛的人"）
            
            // 只要這個詞組裡確實包含關鍵字（如“愛”），這節經文就是有效的真愛！
            if (exactBoundWord.includes(keyword)) {
              validVerses.push(v);
            }
          }
        }
      } else {
        if (v.text && v.text.includes(keyword)) {
          validVerses.push(v);
        }
      }
    });

    // 只有當這個原文編號下存在真正跟“愛”字有關的經文時，才保留這個 StrongId 表格
    if (validVerses.length > 0) {
      cleanGroups[strongId] = validVerses;
    }
  });

  // 🎯 2. 使用清洗後的純淨數據進行網頁渲染
  const sortedKeys = Object.keys(cleanGroups).sort(sortStrongIds);

  if (sortedKeys.length === 0) {
    return "<div class='no-result' style='padding: 20px; text-align: center; color: #999;'>未找到符合原文綁定條件的經文。</div>";
  }

  sortedKeys.forEach(strongId => {
    let verses = cleanGroups[strongId];
    const targetStrong = strongId.trim().toUpperCase();
    
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
        const upperText = rawText.toUpperCase();
        
        if (upperText.includes(targetStrong)) {
          const startIndex = upperText.indexOf(targetStrong);
          const leftText = rawText.substring(0, startIndex);
          const rightText = rawText.substring(startIndex);
          
          const wordMatch = leftText.match(/([^\x00-\xff]+)([<\s{\[]*)$/);
          if (wordMatch) {
            const targetWord = wordMatch[1]; // 拿到例如 "愛心"、"愛我"、"你所愛的人"
            const symbols = wordMatch[2];    
            const remainLeft = leftText.substring(0, leftText.length - wordMatch[0].length);
            
            if (targetWord.includes(keyword)) {
              // 🎯 【高亮微調】：只在詞組內的“愛”字兩邊包上紅色標籤，其餘字（如 “我”）維持正常黑色
              const redPart = targetWord.split(keyword).join(`__RED_START__${keyword}__RED_END__`);
              rawText = remainLeft + redPart + symbols + rightText;
            }
          }
        }

        // 大掃除
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

  if (typeof rawText === 'string' && rawText.includes('|')) {
    const pipeIndex = rawText.indexOf('|');
    const firstPart = rawText.substring(0, pipeIndex).trim();
    const secondPart = rawText.substring(pipeIndex + 1).trim();
    
    lemma = `<span class="dict-lemma" style="color: #4a90e2; font-weight: bold; margin-left: 5px;">${safeEscape(firstPart)}</span>`;
    content = secondPart;
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

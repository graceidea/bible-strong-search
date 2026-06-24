// ==========================================
// 1. 生成表格 HTML 與精準編號染色邏輯（動態關鍵字白名單控制、極致純淨通用版）
// ==========================================
function buildSectionsHtml(groups, keyword, isSimplifiedMode) {
  let html = "";
  
  // 取得全域的字典物件（兼容跨文件調用，若找不到則嘗試去 window 找）
  const dict = typeof strongsDict !== 'undefined' ? strongsDict : window.strongsDict;
  
  // 🎯 【核心突破】根據輸入的關鍵字，動態建立專屬的原文編號白名單 (Dynamic StrongList)
  const dynamicStrongList = new Set();
  
  if (dict && keyword) {
    Object.keys(dict).forEach(strongId => {
      const dictText = dict[strongId];
      // 只要這個編號在原文字典裡的定義包含了使用者搜尋的關鍵字（如「愛」或「信」等），就加入白名單
      if (typeof dictText === 'string' && dictText.includes(keyword)) {
        dynamicStrongList.add(strongId.trim().toUpperCase());
      }
    });
  }

  const cleanGroups = {};
  
  // 🎯 動態白名單大清洗：只要不在動態白名單內的編號（如鄰近詞 G444, G846 等）直接整塊驅逐，不生成表格
  Object.keys(groups).forEach(strongId => {
    const cleanId = strongId.trim().toUpperCase();
    
    // 檢查目前強編號是否在動態生成的白名單中（相容帶有字母尾碼如 G25a 的情況）
    let isValidCode = dynamicStrongList.has(cleanId);
    
    if (!isValidCode) {
      // 進行模糊前綴匹配（防禦 G25a 這種尾碼）
      isValidCode = Array.from(dynamicStrongList).some(validId => cleanId.startsWith(validId));
    }
    
    if (isValidCode) {
      cleanGroups[strongId] = groups[strongId]; // 只有真正定義相關的原文編號會被保留
    }
  });

  // 🎯 使用清洗後的純淨真愛數據進行排序與網頁渲染
  const sortedKeys = Object.keys(cleanGroups).sort(sortStrongIds);

  if (sortedKeys.length === 0) {
    return `<div class='no-result' style='padding: 20px; text-align: center; color: #999;'>
              未找到字典釋義包含「${keyword}」的原文編號經文。
            </div>`;
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

        // 大掃除：徹底蒸發經文裡的所有原文編號與殘留括號
        rawText = rawText.replace(/[<{ ]*[GH]\d+[a-zA-Z]?[>} ]*/gi, '');
        rawText = rawText.replace(/[<>{}[\]]/g, '');

        // 🎯 極致純淨染色：只將搜尋的關鍵字（如「愛」）染成紅色，別的任何字（包括“心”、“我”等鄰近漢字）都不要變
        // 使用 split 和 join 是 JavaScript 中最穩固、絕無任何正則回溯死循環風險的染色法
        highlightedText = rawText.split(keyword).join(`<span style="color: red; font-weight: bold;">${keyword}</span>`);
        
      } else {
        // Fallback 安全回退機制
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
// 2. 獲取本地辭典定義 HTML（徹底移除陣列操作，100% 避坑防崩潰版）
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

  // 🎯 採用更安全的字串原生截取，不使用 split 陣列，完美防禦任何未知資料格式，徹底解決 TypeError
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

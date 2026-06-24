// ==========================================
// 1. 生成表格 HTML 與精準編號染色邏輯（帶有偵錯輸出 Log 版）
// ==========================================
function buildSectionsHtml(groups, keyword, isSimplifiedMode) {
  let html = "";
  const sortedKeys = Object.keys(groups).sort(sortStrongIds);

  sortedKeys.forEach(strongId => {
    let verses = groups[strongId];
    
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
      
      // 🎯 [偵錯日誌] 輸出目前檢查的經文節數
      console.log(`%c【正在調試】${v.book_name} ${v.chapter}:${v.verse} | 當前區塊原文編號: ${strongId}`, "color: #4a90e2; font-weight: bold;");

      if (originalEntry && originalEntry.text) {
        let rawText = originalEntry.text;
        const escapedStrong = strongId.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

        // 🎯 [偵錯日誌] 輸出資料庫裡未清洗前的原始文字（帶有強編號的模樣）
        console.log("-> 數據庫原始文本(帶編號):", rawText);

        // 升級版超精準攔截正則
        const redRegex = new RegExp(`((?:${keyword}心|${keyword}))(?=[\\s<{|\\[]*${escapedStrong}\\b)`, "gi");
        
        // 🎯 [偵錯日誌] 看看正則表達式到底有沒有成功撈到東西
        const matches = rawText.match(redRegex);
        console.log("-> 正則表達式匹配到的文字結果:", matches);

        rawText = rawText.replace(redRegex, function(match) {
          console.log("-> [成功攔截] 進入替換回呼函數，匹配到的目標是:", match);
          return `__RED_START__${match}__RED_END__`;
        });

        // 大掃除
        rawText = rawText.replace(/[<{ ]*[GH]\d+[a-zA-Z]?[>} ]*/gi, '');
        rawText = rawText.replace(/[<>{}[\]]/g, '');

        // 還原標籤
        rawText = rawText.split("__RED_START__").join(`<span style="color: red; font-weight: bold;">`);
        rawText = rawText.split("__RED_END__").join(`</span>`);
        highlightedText = rawText;
        
        console.log("-> 最終生成的 HTML 經文內容:", highlightedText);
        
      } else {
        // 🎯 [偵錯日誌] 如果進入了這裏，代表在帶編號數據庫(bibleData)中根本找不到這一節！
        console.warn(`-> [警告] 無法在帶編號數據庫中找到該節，觸發了 Fallback 安全回退機制。`);
        
        const safeText = typeof escapeHtml === 'function' ? escapeHtml(v.text) : v.text;
        console.log("-> 回退機制的輸入純文字:", safeText);

        if (safeText.includes(`${keyword}心`)) {
          console.log(`-> [回退成功] 純文字中包含「${keyword}心」，執行整體切換`);
          highlightedText = safeText.split(`${keyword}心`).join(`<span style="color: red; font-weight: bold;">${keyword}</span>`);
        } else {
          highlightedText = safeText.split(keyword).join(`<span style="color: red; font-weight: bold;">${keyword}</span>`);
        }
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


// ==========================================
// 2. 獲取本地辭典定義 HTML（與純文字結構相容）
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

  // 解析 "Α | 意義: ..." 結構
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



// ========================================== //
// 2. 獲取本地辭典定義 HTML （已修復純文字結構相容性）
// ========================================== //
function getLocalStrongsDefinitionHtml(strongId) {
    // 兼容跨文件调用：如果 main.js 里的变量名是 strongsDict，而当前作用域找不到，尝试去 window 找
    const dict = typeof strongsDict !== 'undefined' ? strongsDict : window.strongsDict;
    
    if (!dict || !dict[strongId]) return "";

    // 拿到原始的純文字字串
    const rawText = dict[strongId]; 
    
    let lemma = "";
    let content = rawText;

    // 安全處理：確保有些環境下有自訂的 escapeHtml 函數
    const safeEscape = typeof escapeHtml === 'function' ? escapeHtml : function(str) {
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    };

    // 🎯 核心解析邏輯：將 "Α | 意義: ..." 用「|」切開
    if (rawText.includes('|')) {
        const parts = rawText.split('|');
        lemma = `<span class="dict-lemma" style="color: #4a90e2; font-weight: bold; margin-left: 5px;">${safeEscape(parts[0].trim())}</span>`;
        content = parts.slice(1).join('|').trim(); // 剩下一整段都是定義
    }

    // 將字串中的 \n 換行符號轉為網頁的 <br> 標籤
    let formattedContent = safeEscape(content).replace(/\n/g, '<br>');

    // 字數太長時做截斷（保留 150 字），避免彈窗撐爆
    if (formattedContent.length > 150) {
        formattedContent = formattedContent.substring(0, 150) + "...";
    }

    // 返回渲染的 HTML 結構（帶有簡單的樣式，滑鼠移上去或點擊可以查看全貌）
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


// ==========================================
// 1. 生成表格 HTML 與精準編號染色邏輯
// ==========================================
// ==========================================
// 1. 生成表格 HTML 與精準編號染色邏輯（包含完整偵錯輸出）
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
            // 1. 沿用原有的簡繁體資料庫對齊
            const currentDb = isSimplifiedMode ? bibleSimpData : bibleData;
            
            const originalEntry = currentDb.find(s => 
                parseInt(s.book, 10) === v.book_id && 
                parseInt(s.chapter, 10) === parseInt(v.chapter, 10) && 
                parseInt(s.verse, 10) === parseInt(v.verse, 10)
            );
            
            let highlightedText = "";

            if (originalEntry && originalEntry.text) {
                let rawText = originalEntry.text;

                // 🎯【偵錯點 1】：觀察資料庫撈出來的原始經文格式與目標 StrongId
                console.log(`%c[經文原始內容] ${v.book_name} ${v.chapter}:${v.verse}`, "background: #222; color: #bada55; padding: 2px 5px;");
                console.log("👉 原始文字內容:", JSON.stringify(rawText));
                console.log("👉 目前處理的 StrongId 區塊:", JSON.stringify(strongId));

                // 🎯【切片正則】：精準切出「中文組+編號」或「純標點符號與空白」
                const tokenPattern = /([\u4e00-\u9fa5\w]+(?:[<{ ]*[GH]\d+[a-zA-Z]?[>} ]*)+)|([^\u4e00-\u9fa5\w<>{}]+)/g;
                let tokens = rawText.match(tokenPattern) || [rawText];
                
                // 🎯【偵錯點 2】：觀察切片後的陣列成果，看兩個愛字有沒有被成功拆到不同盒子
                console.log("👉 切片後的 Tokens 陣列:", JSON.stringify(tokens));

                let processedLine = "";

                tokens.forEach((token, index) => {
                    const hasStrong = /[<{ ]*[GH]\d+[a-zA-Z]?[>} ]*/i.test(token);

                    if (hasStrong) {
                        // 提取純中文字
                        let chineseChar = token.replace(/[<{ ]*[GH]\d+[a-zA-Z]?[>} ]*/g, '')
                                               .replace(/[<>{}[\]]/g, '').trim();

                        if (chineseChar && chineseChar.includes(keyword)) {
                            // ⭐【精準比對】：檢查當前 strongId 是否出現在這個 token 的尾巴
                            const escapedStrong = strongId.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                            const endWithStrongRegex = new RegExp(`[<{ ]*${escapedStrong}[>} ]*$`, "i");

                            // 🎯【偵錯點 3】：觀察每一個包含關鍵字的 Token 判定過程
                            const isMatch = endWithStrongRegex.test(token.trim());
                            console.log(`  [Token #${index}] 檢查字組: ${JSON.stringify(token)}`);
                            console.log(`    - 純中文字: "${chineseChar}" (包含關鍵字 "${keyword}")`);
                            console.log(`    - 測試正則: ${endWithStrongRegex.toString()}`);
                            console.log(`    - 🔥 比對結果:`, isMatch ? "%cTRUE (染紅)" : "%cFALSE (染黃)", isMatch ? "color: red; font-weight: bold;" : "color: orange;");

                            if (isMatch) {
                                // 🎯 目前編號的關鍵字：紅色粗體
                                let coloredWord = chineseChar.split(keyword).join(`<span style="color: red; font-weight: bold;">${keyword}</span>`);
                                processedLine += coloredWord;
                            } else {
                                // ⚠️ 別人編號的關鍵字：黃色常規高亮
                                let highlightedWord = chineseChar.split(keyword).join(`<span class="hl">${keyword}</span>`);
                                processedLine += highlightedWord;
                            }
                        } else {
                            // 雖然帶有編號，但不含關鍵字，直接輸出純文字
                            processedLine += chineseChar;
                        }
                    } else {
                        // 3. 符號與空白還原邏輯：直接原樣接回，保留所有標點與空白空格
                        processedLine += token;
                    }
                });

                highlightedText = processedLine;
                console.log("👉 本行最終生成的 HTML 結果:", JSON.stringify(highlightedText));
                console.log("%c==========================================", "color: #888;");
            } else {
                const safeText = typeof escapeHtml === 'function' ? escapeHtml(v.text) : v.text;
                highlightedText = safeText.split(keyword).join(`<span class='hl'>${keyword}</span>`);
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


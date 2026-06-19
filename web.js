// ==========================================
// 1. 生成表格 HTML 與精準編號染色邏輯（編號全隱藏、只留精準紅字版）
// ==========================================
function buildSectionsHtml(groups, keyword, isSimplifiedMode) {
    let html = "";
    const sortedKeys = Object.keys(groups).sort(sortStrongIds);

    sortedKeys.forEach(strongId => {
        // 🛑 過濾機制：如果發現是 G0 或 H0 這種異常編號，直接跳過不生成表格
        if (strongId.trim().toUpperCase() === "G0" || strongId.trim().toUpperCase() === "H0") {
            return;
        }

        let verses = groups[strongId];
        const currentTargetStrong = strongId.trim().toUpperCase();

        // 按卷、章、節排序
        verses.sort((a, b) => {
            if (a.book_id !== b.book_id) return a.book_id - b.book_id;
            if (parseInt(a.chapter, 10) !== parseInt(b.chapter, 10)) return parseInt(a.chapter, 10) - parseInt(b.chapter, 10);
            return parseInt(a.verse, 10) - parseInt(b.verse, 10);
        });

        const definitionHtml = getLocalStrongsDefinitionHtml(strongId);
        const isNewTestament = currentTargetStrong.startsWith('G');
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
            
            const originalEntry = currentDb.find(s => 
                parseInt(s.book, 10) === v.book_id && 
                parseInt(s.chapter, 10) === parseInt(v.chapter, 10) && 
                parseInt(s.verse, 10) === parseInt(v.verse, 10)
            );
            
            let highlightedText = "";

            if (originalEntry && originalEntry.text) {
                let rawText = originalEntry.text;

                // 🎯【全新精準雙軌正則】：將經文拆解為「文字」與「標點/括號」兩大類，100% 留住所有歷史字碎片
                const tokenPattern = /([^\s{}<>]+)|([^{}<>\s]+)|([{}<>])/g;
                let tokens = rawText.match(tokenPattern) || [rawText];
                
                let processedLine = "";

                tokens.forEach((token) => {
                    // 偵測這個單字字組是否包含原文編號 (不論前面連了多少中文字)
                    const hasStrong = /[{<][GH]\d+[a-zA-Z]?[>}]/i.test(token);

                    if (hasStrong) {
                        // 1. 精準拔出這個 Token 的最後一個 Strong 編號
                        const strongPartMatch = token.match(/[{<]([GH]\d+[a-zA-Z]?)[>}]/i);
                        const tokenStrongId = (strongPartMatch && strongPartMatch[1]) ? strongPartMatch[1].toUpperCase() : "";
                        
                        // 2. 徹底清洗掉這個 Token 內所有暴露的 {Gxxx} 或 <Hxxx> 編號
                        let chineseChar = token.replace(/[{<][GH]\d+[a-zA-Z]?[>}]/gi, '').trim();

                        if (chineseChar && chineseChar.includes(keyword)) {
                            // 🎯 核心分流：只有當前處理的編號對上了，才允許染紅
                            if (tokenStrongId === currentTargetStrong) {
                                let coloredWord = chineseChar.split(keyword).join(`<span style="color: red; font-weight: bold;">${keyword}</span>`);
                                processedLine += coloredWord;
                            } else {
                                // 屬於別人的編號：直接顯示正常中文字（全黑）
                                processedLine += chineseChar;
                            }
                        } else {
                            // 不含搜尋關鍵字，直接還原中文字（全黑）
                            processedLine += chineseChar;
                        }
                    } else {
                        // 純標點、數字或原本就沒帶編號的文字，原樣接回
                        processedLine += token;
                    }
                });

                highlightedText = processedLine;
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


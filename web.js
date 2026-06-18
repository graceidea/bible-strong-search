// ==========================================
// 1. 生成表格 HTML 與精準編號染色邏輯
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
            
            const originalEntry = currentDb.find(s => 
                parseInt(s.book, 10) === v.book_id && 
                parseInt(s.chapter, 10) === parseInt(v.chapter, 10) && 
                parseInt(s.verse, 10) === parseInt(v.verse, 10)
            );
            
            let highlightedText = "";

            if (originalEntry && originalEntry.text) {
                let rawText = originalEntry.text;

                // 保留你原有的設計：巨觀拆解正則
                const tokenPattern = /([^\w{}<>]+(?:[<{ ]*[GH]\d+[a-zA-Z]?[>} ]*)+)|([^\w{}<>]+|[^ \u4e00-\u9fa5\w{}<>]+)/g;
                let tokens = rawText.match(tokenPattern) || [rawText];
                let processedLine = "";

                tokens.forEach(token => {
                    // 提取純中文與符號
                    let chineseChar = token.replace(/[<{ ]*[GH]\d+[a-zA-Z]?[>} ]*/g, '');
                    chineseChar = chineseChar.replace(/[<>{}[\]]/g, '').trim();

                    if (chineseChar && chineseChar.includes(keyword)) {
                        
                        // ⭐【終極微觀二次切片演算法】
                        // 不再對整個 token 進行暴力的 split().join()。
                        // 我們把這個 token 裡面的每一個字單獨拆開處理，精準隔離！
                        let charArray = chineseChar.split("");
                        let reassembledToken = "";

                        charArray.forEach(char => {
                            if (char === keyword) {
                                // 針對這「單一個字」，建立極度嚴格的雷達正則檢查：
                                // 檢查在這個 token 裡面，這個字後面是不是緊跟著目前的 strongId
                                const escapedStrong = strongId.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                                const strictCheckPattern = new RegExp(char + `[<{ ]*` + escapedStrong, "i");

                                if (strictCheckPattern.test(token)) {
                                    // 🎯 只有這個字後面黏著當前編號，才變紅！
                                    reassembledToken += `<span style="color: red; font-weight: bold;">${char}</span>`;
                                } else {
                                    // 🟡 雖然是同一個字，但後面黏的是別人的編號，退回黃色！
                                    reassembledToken += `<span class="hl">${char}</span>`;
                                }
                            } else {
                                // 不是關鍵字（例如“你”、“我”），原樣接回去
                                reassembledToken += char;
                            }
                        });

                        processedLine += reassembledToken;
                    } else {
                        // 標點符號與其餘文字原封不動拼回，保證不丟失標點
                        processedLine += chineseChar;
                    }
                });

                highlightedText = processedLine;
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


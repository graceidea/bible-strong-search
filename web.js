// ==========================================
// 1. 生成表格 HTML 與精準編號染色邏輯
// ==========================================
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
            // 🎯【修復】直接使用從 main.js 傳過來的簡繁體狀態，精確對齊資料庫
            const currentDb = isSimplifiedMode ? bibleSimpData : bibleData;
            
            const originalEntry = currentDb.find(s => 
                parseInt(s.book, 10) === v.book_id && 
                parseInt(s.chapter, 10) === parseInt(v.chapter, 10) && 
                parseInt(s.verse, 10) === parseInt(v.verse, 10)
            );
            
            let highlightedText = "";

            if (originalEntry && originalEntry.text) {
                let rawText = originalEntry.text;

                // 🎯【修復】支援萬國碼（包含標點符號、跨年齡註解）的字串晶片拆解正則表達式
                const tokenPattern = /([^\w{}<>]+(?:[<{ ]*[GH]\d+[a-zA-Z]?[>} ]*)+)|([^\w{}<>]+|[^ \u4e00-\u9fa5\w{}<>]+)/g;
                let tokens = rawText.match(tokenPattern) || [rawText];
                let processedLine = "";

                tokens.forEach(token => {
                    // 提取純中文字
                    let chineseChar = token.replace(/[<{ ]*[GH]\d+[a-zA-Z]?[>} ]*/g, '');
                    chineseChar = chineseChar.replace(/[<>{}[\]]/g, '').trim();

                    if (chineseChar && chineseChar.includes(keyword)) {
                        // 驗證這個字片組裡面，是否包含我們當前正在查看的原文編號
                        if (token.toUpperCase().includes(strongId.toUpperCase())) {
                            // 🎯 完美符合目前編號：字組內的關鍵字精準染成【紅色粗體】
                            let coloredWord = chineseChar.split(keyword).join(`<span style="color: red; font-weight: bold;">${keyword}</span>`);
                            processedLine += coloredWord;
                        } else {
                            // ⚠️ 編號是別人的：標記為【黃色常規高亮】
                            let highlightedWord = chineseChar.split(keyword).join(`<span class="hl">${keyword}</span>`);
                            processedLine += highlightedWord;
                        }
                    } else {
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
function getLocalStrongsDefinitionHtml(strongId) {
    if (!strongsDict || !strongsDict[strongId]) return "";
    
    const item = strongsDict[strongId];
    
    // 1. Safely escape and format header pieces to prevent XSS
    let lemma = item.lemma ? `<span class="dict-lemma">${escapeHtml(item.lemma)}</span>` : "";
    let pronounce = item.pronunciation ? `<span class="dict-pronounce">/${escapeHtml(item.pronunciation)}/</span>` : "";
    
    // 2. Fallback handling for description/definition
    let content = item.description || item.definition || "";
    
    // 3. Escape before structural manipulation or ensure clean cutoffs
    content = escapeHtml(content);
    if (content.length > 150) {
        content = content.substring(0, 150) + "...";
    }
    
    // 4. Return the template literal with decoded emoji string
    return `
        <div class="strongs-tooltip">
            <div class="tooltip-trigger">ℹ️ 字典</div>
            <div class="tooltip-content">
                <div class="dict-header">${escapeHtml(strongId)} ${lemma} ${pronounce}</div>
                <div class="dict-body">${content}</div>
            </div>
        </div>
    `;
}


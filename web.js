// ==========================================
// 1. 生成表格 HTML 與精準編號染色邏輯（徹底去括號、去編號、純淨文字版）
// ==========================================
function buildSectionsHtml(groups, keyword, isSimplifiedMode) {
    let html = "";
    const sortedKeys = Object.keys(groups).sort(sortStrongIds);

    sortedKeys.forEach(strongId => {
        const currentTargetStrong = strongId.trim().toUpperCase();
        
        // 🛑 1. 攔截機制：如果發現是 G0 或 H0 這種異常編號，直接跳過不生成任何表格
        if (currentTargetStrong === "G0" || currentTargetStrong === "H0") {
            return;
        }

        let verses = groups[strongId];


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


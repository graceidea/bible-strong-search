// ==========================================
// 1. 初始化與異步加載三大 JSON 資料庫
// ==========================================

// 使用 DOMContentLoaded 而不是 window.onload，更可靠
document.addEventListener('DOMContentLoaded', function() { 
    const statusElement = document.getElementById('status');
    if (statusElement) {
        statusElement.innerText = "正在載入聖經資料庫與原文辭典...";
    }
    
    Promise.all([ 
        fetch('./chinesetrad.json').then(res => { 
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`); 
            return res.json(); 
        }), 
        fetch('./chinesesimp.json').then(res => { 
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`); 
            return res.json(); 
        }), 
        fetch('./strongs_dict.json').then(res => { 
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`); 
            return res.json(); 
        }) 
    ]) 
    .then(([bibleTrad, bibleSimp, dict]) => { 
        // 赋值给全局变量
        bibleData = bibleTrad;      
        bibleSimpData = bibleSimp;  
        strongsDict = dict; 
        
        console.log(`✅ 數據加載完成: 繁體 ${bibleData.length} 節, 簡體 ${bibleSimpData.length} 節, 字典 ${Object.keys(strongsDict).length} 個詞條`);
        
        // 🔥 初始化搜索构建器（新增）
        initSearchBuilder();
        
        // 動態填充 66 卷書與範圍選項到選單中
        populateBookFilter();
        
        if (statusElement) {
            statusElement.innerText = "所有資料庫載入完成，可以開始搜尋！";
            statusElement.style.color = '#2ecc71';
        }
    }) 
    .catch(err => { 
        console.error('❌ 載入失敗:', err);
        const statusElement = document.getElementById('status');
        if (statusElement) {
            statusElement.innerText = `錯誤: 載入 JSON 失敗 (${err.message})，請確認檔案路徑是否正確。`;
            statusElement.style.color = '#e74c3c';
        }
    }); 
});

/**
 * 填充書卷過濾選單
 */
function populateBookFilter() {
    const filterSelect = document.getElementById('book-filter');
    if (!filterSelect) return;
    
    filterSelect.innerHTML = '<option value="all">🔍 所有書卷（全部）</option>';
    filterSelect.innerHTML += '<option value="ot_all">✨ 舊約全部 (創世記 - 瑪拉基書)</option>';
    filterSelect.innerHTML += '<option value="nt_all">✨ 新約全部 (馬太福音 - 啟示錄)</option>';
    filterSelect.innerHTML += '<option value="disabled" disabled>----------------------------------</option>';

    Object.keys(BOOK_MAP).forEach(id => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = BOOK_MAP[id];
        filterSelect.appendChild(option);
    });
}

// ==========================================
// 2. 關鍵字搜尋核心業務邏輯
// ==========================================

function runSearch() {
    const keywordInput = document.getElementById('keyword');
    if (!keywordInput) return;
    
    let rawKeyword = keywordInput.value.trim();
    if (!rawKeyword) {
        alert("請輸入要搜尋的關鍵字！");
        return;
    }
    
    if (bibleData.length === 0 || bibleSimpData.length === 0) {
        alert("資料庫尚未加載完成，請稍後再試。");
        return;
    }
    
    const selectedBookFilter = document.getElementById('book-filter') ? 
        document.getElementById('book-filter').value : 'all';
    
    // 簡繁轉換
    let tradKeyword = rawKeyword;
    let simpKeyword = rawKeyword;
    if (typeof s2t_t2s === 'object') {
        if (typeof s2t_t2s.s2t === 'function') tradKeyword = s2t_t2s.s2t(rawKeyword);
        if (typeof s2t_t2s.t2s === 'function') simpKeyword = s2t_t2s.t2s(rawKeyword);
    }
    
    // 判斷是否為簡體模式
    let isSimplified = false;
    if (/[爱创造圣经国门们时后会种样里个乐]/g.test(rawKeyword) || tradKeyword !== rawKeyword) {
        isSimplified = true;
    }
    
    const currentBibleDatabase = isSimplified ? bibleSimpData : bibleData;
    
    const statusElement = document.getElementById('status');
    if (statusElement) statusElement.innerText = "搜尋中...";

    // 動態建立書名對照表
    const currentBookMap = {};
    for (const [id, tradName] of Object.entries(BOOK_MAP)) {
        if (isSimplified && typeof s2t_t2s === 'object' && typeof s2t_t2s.t2s === 'function') {
            currentBookMap[id] = s2t_t2s.t2s(tradName);
        } else {
            currentBookMap[id] = tradName;
        }
    }

    // 搜尋邏輯
    let otGroups = {};
    let ntGroups = {};
    let otTotalVerses = 0;
    let ntTotalVerses = 0;

    currentBibleDatabase.forEach(entry => {
        const bookId = parseInt(entry.book, 10);
        
        // 書卷過濾
        if (selectedBookFilter !== 'all') {
            if (selectedBookFilter === 'ot_all' && bookId > 39) return;
            if (selectedBookFilter === 'nt_all' && bookId <= 39) return;
            if (selectedBookFilter !== 'ot_all' && selectedBookFilter !== 'nt_all' && 
                bookId !== parseInt(selectedBookFilter, 10)) return;
        }
        
        const rawText = entry.text || "";
        const cleanText = cleanStrongs(rawText);
        
        // 關鍵字匹配
        let matchedKeyword = "";
        if (cleanText.includes(simpKeyword)) {
            matchedKeyword = simpKeyword;
        } else if (cleanText.includes(tradKeyword)) {
            matchedKeyword = tradKeyword;
        } else {
            return;
        }
        
        // 提取 Strong 編號
        let strongIds = [];
        const fallbackPattern = /[GH]\d+[a-zA-Z]?/g;
        const allMatches = rawText.match(fallbackPattern);
        if (allMatches) {
            strongIds = [...new Set(allMatches)];
        }
        if (strongIds.length === 0) return;

        const verseData = {
            book_id: bookId,
            book_name: currentBookMap[bookId] || `未知(${bookId})`,
            chapter: entry.chapter,
            verse: entry.verse,
            text: cleanText
        };

        strongIds.forEach(strongId => {
            if (bookId <= 39) {
                if (!otGroups[strongId]) otGroups[strongId] = [];
                otGroups[strongId].push({...verseData});
                otTotalVerses++;
            } else {
                if (!ntGroups[strongId]) ntGroups[strongId] = [];
                ntGroups[strongId].push({...verseData});
                ntTotalVerses++;
            }
        });
    });

    // 更新計數
    const otCountElement = document.getElementById('ot-count');
    const ntCountElement = document.getElementById('nt-count');
    if (otCountElement) otCountElement.innerText = `（找到 ${otTotalVerses} 筆）`;
    if (ntCountElement) ntCountElement.innerText = `（找到 ${ntTotalVerses} 筆）`;

    const renderKeyword = isSimplified ? simpKeyword : tradKeyword;

    // 🔥 使用新的 buildSectionsHtml（已整合到 data.js）
    const otHtml = Object.keys(otGroups).length ? 
        buildSectionsHtml(otGroups, renderKeyword, isSimplified, { debugMode: false }) : 
        "<p class='no-result'>無結果</p>";
    const ntHtml = Object.keys(ntGroups).length ? 
        buildSectionsHtml(ntGroups, renderKeyword, isSimplified, { debugMode: false }) : 
        "<p class='no-result'>無結果</p>";

    const otResults = document.getElementById('ot-results');
    const ntResults = document.getElementById('nt-results');
    const resultsArea = document.getElementById('results-area');
    
    if (otResults) otResults.innerHTML = otHtml;
    if (ntResults) ntResults.innerHTML = ntHtml;
    if (resultsArea) resultsArea.style.display = 'block';
    
    if (statusElement) statusElement.innerText = "搜尋完畢！";
    
    // 📊 GA4 數據統計
    if (typeof gtag === 'function') {
        gtag('event', 'bible_keyword_search', {
            'keyword': rawKeyword,
            'is_simplified': isSimplified,
            'book_filter': selectedBookFilter,
            'ot_results': otTotalVerses,
            'nt_results': ntTotalVerses
        });
    }
}

// ==========================================
// 3. 頁籤切換功能
// ==========================================

function switchMode(mode) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.search-panel').forEach(p => p.classList.remove('active'));
    
    if (mode === 'keyword') {
        const btns = document.querySelectorAll('.tab-btn');
        if (btns[0]) btns[0].classList.add('active');
        const panel = document.getElementById('panel-keyword');
        if (panel) panel.classList.add('active');
    } else {
        const btns = document.querySelectorAll('.tab-btn');
        if (btns[1]) btns[1].classList.add('active');
        const panel = document.getElementById('panel-reverse');
        if (panel) panel.classList.add('active');
    }
}

// ==========================================
// 4. 原文反查功能
// ==========================================

function runReverseSearch() {
    const rawInputText = document.getElementById('reverse-text')?.value?.trim() || '';
    const targetWord = document.getElementById('reverse-target')?.value?.trim() || '';

    if (!rawInputText || !targetWord) {
        alert("請輸入參考經文與要反查的特定中文字！");
        return;
    }
    
    // 檢查數據是否已加載
    if (bibleData.length === 0 || bibleSimpData.length === 0) {
        alert("資料庫尚未加載完成，請稍後再試。");
        return;
    }
    
    // TODO: 實現真正的反查邏輯
    alert(`【功能開發中】\n你希望在輸入的內文中，找出「${targetWord}」對應的希臘文或希伯來文編號。`);
    
    // 📊 GA4 數據統計上報反查次數
    if (typeof gtag === 'function') {
        gtag('event', 'bible_reverse_search_click', {
            'target_word': targetWord
        });
    }
}

// ==========================================
// 5. 鍵盤快捷鍵支持
// ==========================================

// 按 Enter 鍵觸發搜索
document.addEventListener('DOMContentLoaded', function() {
    const keywordInput = document.getElementById('keyword');
    if (keywordInput) {
        keywordInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                runSearch();
            }
        });
    }
});

// ==========================================
// 6. 導出（如果使用模塊系統）
// ==========================================

// 如果使用 ES Modules
// export { runSearch, switchMode, runReverseSearch };

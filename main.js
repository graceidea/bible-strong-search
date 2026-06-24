// ==========================================
// main.js - 使用StrongSearchBuilder的新策略
// ==========================================

document.addEventListener('DOMContentLoaded', function() { 
    const statusElement = document.getElementById('status');
    if (statusElement) {
        statusElement.innerText = "正在載入聖經資料庫與原文辭典...";
    }
    
    Promise.all([ 
        fetch('./chinesetrad.json').then(res => { 
            if (!res.ok) throw new Error(`HTTP ${res.status}`); 
            return res.json(); 
        }), 
        fetch('./chinesesimp.json').then(res => { 
            if (!res.ok) throw new Error(`HTTP ${res.status}`); 
            return res.json(); 
        }), 
        fetch('./strongs_dict.json').then(res => { 
            if (!res.ok) throw new Error(`HTTP ${res.status}`); 
            return res.json(); 
        }) 
    ]) 
    .then(([bibleTrad, bibleSimp, dict]) => { 
        bibleData = bibleTrad;      
        bibleSimpData = bibleSimp;  
        strongsDict = dict; 
        
        console.log(`✅ 數據加載完成`);
        console.log(`📚 繁體: ${bibleData.length} 節`);
        console.log(`📚 簡體: ${bibleSimpData.length} 節`);
        console.log(`📖 字典: ${Object.keys(strongsDict).length} 個詞條`);
        
        // 🔥 初始化搜索构建器
        initSearchBuilder();
        
        // 填充書卷過濾選單
        populateBookFilter();
        
        if (statusElement) {
            statusElement.innerText = "✅ 所有資料庫載入完成，可以開始搜尋！";
            statusElement.style.color = '#2ecc71';
        }
    }) 
    .catch(err => { 
        console.error('❌ 載入失敗:', err);
        const statusElement = document.getElementById('status');
        if (statusElement) {
            statusElement.innerText = `❌ 錯誤: 載入 JSON 失敗 (${err.message})`;
            statusElement.style.color = '#e74c3c';
        }
    }); 
});

function populateBookFilter() {
    const filterSelect = document.getElementById('book-filter');
    if (!filterSelect) return;
    
    filterSelect.innerHTML = '<option value="all">🔍 所有書卷（全部）</option>';
    filterSelect.innerHTML += '<option value="ot_all">✨ 舊約全部</option>';
    filterSelect.innerHTML += '<option value="nt_all">✨ 新約全部</option>';
    filterSelect.innerHTML += '<option value="disabled" disabled>─────────────────</option>';

    Object.keys(BOOK_MAP).forEach(id => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = BOOK_MAP[id];
        filterSelect.appendChild(option);
    });
}

// ==========================================
// 🔥 核心搜索函数 - 使用新策略
// ==========================================

function runSearch() {
    const keywordInput = document.getElementById('keyword');
    if (!keywordInput) return;
    
    let rawKeyword = keywordInput.value.trim();
    if (!rawKeyword) {
        alert("請輸入要搜尋的關鍵字！");
        return;
    }
    
    // ==========================================
    // 🔥 调试代码 - 检查数据
    // ==========================================
    console.log('=== 调试信息 ===');
    console.log('1. 关键词:', rawKeyword);
    console.log('2. bibleData 长度:', bibleData?.length || 0);
    console.log('3. bibleSimpData 长度:', bibleSimpData?.length || 0);
    console.log('4. strongsDict 键数量:', Object.keys(strongsDict || {}).length);
    
    // 检查字典中是否有包含"爱"的条目
    let foundInDict = 0;
    const sampleMatches = [];
    for (const [key, value] of Object.entries(strongsDict || {})) {
        if (value && value.includes('爱')) {
            foundInDict++;
            if (sampleMatches.length < 5) {
                sampleMatches.push({ key, value: value.substring(0, 50) });
            }
        }
    }
    console.log('5. 字典中包含"爱"的条目数:', foundInDict);
    console.log('6. 示例匹配:', sampleMatches);
    
    if (foundInDict === 0) {
        // 检查字典前几个条目
        const sample = Object.entries(strongsDict || {}).slice(0, 3);
        console.log('7. 字典样例:', sample);
        alert(`❌ 字典中未找到包含"爱"的条目！\n字典共有 ${Object.keys(strongsDict || {}).length} 个条目。\n请检查 strongs_dict.json 是否正确加载。`);
        return;
    }    
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
    
    const selectedBookFilter = document.getElementById('book-filter')?.value || 'all';
    
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
    if (statusElement) statusElement.innerText = "🔍 搜尋中...";

    // 動態建立書名對照表
    const currentBookMap = {};
    for (const [id, tradName] of Object.entries(BOOK_MAP)) {
        if (isSimplified && typeof s2t_t2s === 'object' && typeof s2t_t2s.t2s === 'function') {
            currentBookMap[id] = s2t_t2s.t2s(tradName);
        } else {
            currentBookMap[id] = tradName;
        }
    }

    // ==========================================
    // 🔥 第一步：建立Strong编号索引
    // ==========================================
    const builder = getSearchBuilder();
    if (!builder) {
        alert("搜索引擎未初始化，請刷新頁面重試。");
        return;
    }
    
    // 获取"关键词"的Strong编号索引
    const strongIndex = builder.getStrongIndex(rawKeyword);
    
    console.log(`📊 關鍵字"${rawKeyword}"的Strong索引:`, Array.from(strongIndex));
    console.log(`📊 索引大小: ${strongIndex.size} 個編號`);
    
    if (strongIndex.size === 0) {
        document.getElementById('ot-results').innerHTML = 
            `<div class='no-result' style='padding: 30px; text-align: center;'>
                <div style='font-size: 20px;'>🔍</div>
                <div>未找到包含「${rawKeyword}」的原文編號</div>
            </div>`;
        document.getElementById('nt-results').innerHTML = '';
        document.getElementById('results-area').style.display = 'block';
        if (statusElement) statusElement.innerText = "✅ 搜尋完成（無結果）";
        return;
    }

    // ==========================================
    // 🔥 第二步：用索引检索经文
    // ==========================================
    
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
        
        // 🔥 检查经文是否包含关键词
        const containsKeyword = cleanText.includes(simpKeyword) || cleanText.includes(tradKeyword);
        if (!containsKeyword) return;
        
        // 🔥 提取经文中的所有Strong编号
        let allStrongIds = [];
        const fallbackPattern = /[GH]\d+[a-zA-Z]?/g;
        const matches = rawText.match(fallbackPattern);
        if (matches) {
            allStrongIds = [...new Set(matches)];
        }
        if (allStrongIds.length === 0) return;
        
        // 🔥 关键：只保留在索引中的Strong编号
        const relevantStrongIds = allStrongIds.filter(id => {
            const cleanId = id.trim().toUpperCase();
            return strongIndex.has(cleanId);
        });
        
        // 如果没有相关的Strong编号，跳过
        if (relevantStrongIds.length === 0) return;

        const verseData = {
            book_id: bookId,
            book_name: currentBookMap[bookId] || `未知(${bookId})`,
            chapter: entry.chapter,
            verse: entry.verse,
            text: cleanText
        };

        // 只关联相关的Strong编号
        relevantStrongIds.forEach(strongId => {
            const cleanId = strongId.trim().toUpperCase();
            if (bookId <= 39) {
                if (!otGroups[cleanId]) otGroups[cleanId] = [];
                otGroups[cleanId].push({...verseData});
                otTotalVerses++;
            } else {
                if (!ntGroups[cleanId]) ntGroups[cleanId] = [];
                ntGroups[cleanId].push({...verseData});
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

    // 使用buildSectionsHtml显示结果（传入索引信息）
    const otHtml = Object.keys(otGroups).length ? 
        buildSectionsHtml(otGroups, renderKeyword, isSimplified, { 
            debugMode: false,
            strongIndex: strongIndex  // 传递索引用于显示
        }) : 
        "<p class='no-result' style='padding: 20px; text-align: center; color: #999;'>📭 舊約中無結果</p>";
    
    const ntHtml = Object.keys(ntGroups).length ? 
        buildSectionsHtml(ntGroups, renderKeyword, isSimplified, { 
            debugMode: false,
            strongIndex: strongIndex
        }) : 
        "<p class='no-result' style='padding: 20px; text-align: center; color: #999;'>📭 新約中無結果</p>";

    const otResults = document.getElementById('ot-results');
    const ntResults = document.getElementById('nt-results');
    const resultsArea = document.getElementById('results-area');
    
    if (otResults) otResults.innerHTML = otHtml;
    if (ntResults) ntResults.innerHTML = ntHtml;
    if (resultsArea) resultsArea.style.display = 'block';
    
    if (statusElement) {
        statusElement.innerText = `✅ 搜尋完畢！找到 ${otTotalVerses + ntTotalVerses} 節經文，關聯 ${strongIndex.size} 個原文編號`;
    }
    
    // 📊 GA4 數據統計
    if (typeof gtag === 'function') {
        gtag('event', 'bible_keyword_search', {
            'keyword': rawKeyword,
            'is_simplified': isSimplified,
            'book_filter': selectedBookFilter,
            'strong_matches': strongIndex.size,
            'ot_results': otTotalVerses,
            'nt_results': ntTotalVerses
        });
    }
}

// ==========================================
// 頁籤切換功能
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

function runReverseSearch() {
    const rawInputText = document.getElementById('reverse-text')?.value?.trim() || '';
    const targetWord = document.getElementById('reverse-target')?.value?.trim() || '';

    if (!rawInputText || !targetWord) {
        alert("請輸入參考經文與要反查的特定中文字！");
        return;
    }
    
    if (bibleData.length === 0 || bibleSimpData.length === 0) {
        alert("資料庫尚未加載完成，請稍後再試。");
        return;
    }
    
    alert(`【功能開發中】\n你希望在輸入的內文中，找出「${targetWord}」對應的希臘文或希伯來文編號。`);
    
    if (typeof gtag === 'function') {
        gtag('event', 'bible_reverse_search_click', {
            'target_word': targetWord
        });
    }
}

// ==========================================
// 鍵盤快捷鍵
// ==========================================

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

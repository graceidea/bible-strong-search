// ==========================================
// 1. 初始化與異步加載三大 JSON 資料庫
// ==========================================
window.onload = function() { 
    document.getElementById('status').innerText = "正在載入聖經資料庫與原文辭典..."; 
    
    Promise.all([ 
        fetch('./chinesetrad.json').then(res => { if (!res.ok) throw new Error(); return res.json(); }), 
        fetch('./chinesesimp.json').then(res => { if (!res.ok) throw new Error(); return res.json(); }), 
        fetch('./strongs_dict.json').then(res => { if (!res.ok) throw new Error(); return res.json(); }) 
    ]) 
    .then(([bibleTrad, bibleSimp, dict]) => { 
        bibleData = bibleTrad;      
        bibleSimpData = bibleSimp;  
        strongsDict = dict; 
        
        // 動態填充 66 卷書與範圍選項到選單中
        const filterSelect = document.getElementById('book-filter');
        if (filterSelect) {
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

        document.getElementById('status').innerText = "所有資料庫載入完成，可以開始搜尋！"; 
    }) 
    .catch(err => { 
        document.getElementById('status').innerText = "錯誤: 載入 JSON 失敗，請確認檔案路徑是否正確。"; 
        console.error(err); 
    }); 
};

// ==========================================
// 2. 關鍵字搜尋核心業務邏輯
// ==========================================
function runSearch() {
    let rawKeyword = document.getElementById('keyword').value.trim();
    if (!rawKeyword) return;
    if (bibleData.length === 0 || bibleSimpData.length === 0) {
        alert("資料庫尚未加載完成。");
        return;
    }
    const selectedBookFilter = document.getElementById('book-filter') ? document.getElementById('book-filter').value : 'all';
    let tradKeyword = rawKeyword;
    let simpKeyword = rawKeyword;
    if (typeof s2t_t2s === 'object') {
        if (typeof s2t_t2s.s2t === 'function') tradKeyword = s2t_t2s.s2t(rawKeyword);
        if (typeof s2t_t2s.t2s === 'function') simpKeyword = s2t_t2s.t2s(rawKeyword);
    }
    let isSimplified = false;
    if (/[爱创造圣经国门们时后会种样里个乐]/g.test(rawKeyword) || tradKeyword !== rawKeyword) {
        isSimplified = true;
    }
    const currentBibleDatabase = isSimplified ? bibleSimpData : bibleData;
    document.getElementById('status').innerText = "搜尋中...";

    // 【優化】動態建立本次搜尋適用的書名對照表，解決簡體模式下書名仍顯示繁體的 Bug
    const currentBookMap = {};
    for (const [id, tradName] of Object.entries(BOOK_MAP)) {
        if (isSimplified && typeof s2t_t2s === 'object' && typeof s2t_t2s.t2s === 'function') {
            currentBookMap[id] = s2t_t2s.t2s(tradName);
        } else {
            currentBookMap[id] = tradName;
        }
    }

    let otGroups = {};
    let ntGroups = {};
    let otTotalVerses = 0;
    let ntTotalVerses = 0;

    currentBibleDatabase.forEach(entry => {
        const bookId = parseInt(entry.book, 10);
        if (selectedBookFilter !== 'all') {
            if (selectedBookFilter === 'ot_all' && bookId > 39) return;
            if (selectedBookFilter === 'nt_all' && bookId <= 39) return;
            if (selectedBookFilter !== 'ot_all' && selectedBookFilter !== 'nt_all' && bookId !== parseInt(selectedBookFilter, 10)) return;
        }
        const rawText = entry.text || "";
        const cleanText = cleanStrongs(rawText);
        let matchedKeyword = "";
        if (cleanText.includes(simpKeyword)) {
            matchedKeyword = simpKeyword;
        } else if (cleanText.includes(tradKeyword)) {
            matchedKeyword = tradKeyword;
        } else {
            return;
        }
        let strongIds = [];
        const fallbackPattern = /[GH]\d+[a-zA-Z]?/g;
        const allMatches = rawText.match(fallbackPattern);
        if (allMatches) {
            strongIds = [...new Set(allMatches)];
        }
        if (strongIds.length === 0) return;

        // 【核心修改】將原始帶有標籤的 rawText 一併打包傳入
        const verseData = {
            book_id: bookId,
            book_name: currentBookMap[bookId] || `未知(${bookId})`,
            chapter: entry.chapter,
            verse: entry.verse,
            rawText: rawText, // 👈 保留標籤文字供精準高亮使用
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

    document.getElementById('ot-count').innerText = `（找到 ${otTotalVerses} 筆）`;
    document.getElementById('nt-count').innerText = `（找到 ${ntTotalVerses} 筆）`;

    // 👈 注意：這裡改為傳遞 isSimplified 狀態，不再盲目傳遞中文關鍵字
    const otHtml = Object.keys(otGroups).length ? buildSectionsHtml(otGroups, isSimplified) : "<p class='no-result'>無結果</p>";
    const ntHtml = Object.keys(ntGroups).length ? buildSectionsHtml(ntGroups, isSimplified) : "<p class='no-result'>無結果</p>";

    document.getElementById('ot-results').innerHTML = otHtml;
    document.getElementById('nt-results').innerHTML = ntHtml;
    document.getElementById('results-area').style.display = 'block';
    document.getElementById('status').innerText = "搜尋完畢！";
}

// ==========================================
// 3. 頁籤切換功能
// ==========================================
function switchMode(mode) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.search-panel').forEach(p => p.classList.remove('active'));
    
    if (mode === 'keyword') {
        document.querySelectorAll('.tab-btn')[0].classList.add('active');
        document.getElementById('panel-keyword').classList.add('active');
    } else {
        document.querySelectorAll('.tab-btn')[1].classList.add('active');
        document.getElementById('panel-reverse').classList.add('active');
    }
}

// 原文反查留空，你可以直接把你原本的 runReverseSearch() 代碼貼在下方
function runReverseSearch() {
    // 貼上你原本的反查程式碼...
    const rawInputText = document.getElementById('reverse-text').value.trim();
    const targetWord = document.getElementById('reverse-target').value.trim();

    if (!rawInputText || !targetWord) {
        alert("請輸入參考經文與要反查的特定中文字！");
        return;
    }
    alert(`【功能開發中】\n你希望在輸入的內文中，找出「${targetWord}」對應的希臘文或希伯來文編號。`);
    
    // 📊 GA4 數據統計上報反查次數
    if (typeof gtag === 'function') {
        gtag('event', 'bible_reverse_search_click', {
            'target_word': targetWord
        });
    }
}

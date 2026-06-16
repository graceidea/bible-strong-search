const BOOK_MAP = {
    1: "創世記", 2: "出埃及記", 3: "利未記", 4: "民數記", 5: "申命記", 6: "約書亞記", 7: "士師記", 8: "路得記", 9: "撒母耳記上", 10: "撒母耳記下", 11: "列王紀上", 12: "列王紀下", 13: "歷代志上", 14: "歷代志下", 15: "以斯拉記", 16: "尼希米記", 17: "以斯帖記", 18: "約伯記", 19: "詩篇", 20: "箴言", 21: "傳道書", 22: "雅歌", 23: "賽亞書", 24: "耶利米書", 25: "耶利米哀歌", 26: "以西結書", 27: "但以理書", 28: "何西阿書", 29: "約珥書", 30: "阿摩司書", 31: "俄巴底亞書", 32: "約拿書", 33: "彌迦書", 34: "那鴻書", 35: "哈巴谷書", 36: "西番雅書", 37: "哈該書", 38: "撒迦利亞書", 39: "瑪拉基書", 40: "馬太福音", 41: "馬可福音", 42: "路加福音", 43: "約翰福音", 44: "使徒行傳", 45: "羅馬書", 46: "哥林多前書", 47: "哥林多後書", 48: "加拉太書", 49: "以弗所書", 50: "腓立比書", 51: "歌羅西書", 52: "帖撒羅尼迦前書", 53: "帖撒羅尼迦後書", 54: "提摩太前書", 55: "提摩太後書", 56: "提多書", 57: "腓利門書", 58: "希伯來書", 59: "雅各書", 60: "彼得前書", 61: "彼得後書", 62: "約翰一書", 63: "約翰二書", 64: "約翰三書", 65: "猶大書", 66: "啟示錄"
};

let bibleData = [];     // 繁體字庫 (chinesetrad.json)
let bibleSimpData = []; // 簡體字庫 (chinesesimp.json)
let strongsDict = {};   // 原文辭典資料 (strongs_dict.json)

window.onload = function() { 
    document.getElementById('status').innerText = "正在載入聖經資料庫與原文辭典..."; 
    
    Promise.all([ 
        // 1. 載入繁體庫
        fetch('./chinesetrad.json').then(res => { if (!res.ok) throw new Error(); return res.json(); }), 
        // 2. 載入新增的簡體庫
        fetch('./chinesesimp.json').then(res => { if (!res.ok) throw new Error(); return res.json(); }), 
        // 3. 載入辭典
        fetch('./strongs_dict.json').then(res => { if (!res.ok) throw new Error(); return res.json(); }) 
    ]) 
    .then(([bibleTrad, bibleSimp, dict]) => { 
        bibleData = bibleTrad;      
        bibleSimpData = bibleSimp;  
        strongsDict = dict; 
        document.getElementById('status').innerText = "所有資料庫載入完成，可以開始搜尋！"; 
    }) 
    .catch(err => { 
        document.getElementById('status').innerText = "錯誤: 載入 JSON 失敗，請確認檔案路徑是否正確（包含 chinesetrad.json、chinesesimp.json 與 strongs_dict.json）。"; 
        console.error(err); 
    }); 
};

function switchMode(mode) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.search-panel').forEach(panel => panel.classList.remove('active'));
    
    if(mode === 'keyword') {
        document.querySelectorAll('.tab-btn')[0].classList.add('active');
        document.getElementById('panel-keyword').classList.add('active');
    } else {
        document.querySelectorAll('.tab-btn')[1].classList.add('active');
        document.getElementById('panel-reverse').classList.add('active');
    }
}

function cleanStrongs(text) {
    if (!text) return "";
    let t = String(text);
    // 同時清洗掉 {H1234}, <G1234>, <{H1234}> 等所有可能的原文編號標籤
    t = t.replace(/[<{]?[GH]\d+[a-zA-Z]?[>}]?/g, '');
    // 移除可能殘留的空括號或特殊符號
    t = t.replace(/[<>{}[\]]/g, '');
    return t.trim();
}

function findAllStrongs(rawText, keyword) {
    // 1. 先把關鍵字安全轉義
    const escaped = keyword.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    
    // 2. 💡 超強力正則：匹配 關鍵字 + 後面可能帶有的 <, {, 或直接緊跟著的 G/H 編號
    // 這個設計完美適配 "创造{H1254}" 或 "創造<{G1234}>"
    const pattern = new RegExp(escaped + "(?:[<{ ]*)([GH]\\d+[a-zA-Z]?)(?:[>} ]*)", "g");
    
    let strongs = [];
    let match;
    
    // 3. 循環找出所有匹配的原文編號
    while ((match = pattern.exec(rawText)) !== null) {
        if (match[1]) {
            strongs.push(match[1]); // 提取出純粹的 "H7225" 或 "G430"
        }
    }
    
    // 4. 如果上面的嚴格鄰近比對沒抓到，啟動「保底後備方案」：
    // 只要這行經文裡包含關鍵字，我們就把這行經文裡出現的所有 Strong 編號通通抓出來歸類！
    if (strongs.length === 0) {
        const fallbackPattern = /[GH]\d+[a-zA-Z]?/g;
        const allMatches = rawText.match(fallbackPattern);
        if (allMatches) {
            strongs.push(...allMatches);
        }
    }
    
    return [...new Set(strongs)]; // 去除重複的編號
}


function strongSortKey(s) {
    const match = s.match(/([GH])(\d+)/);
    if (!match) return { type: 'Z', num: 999999 };
    return { type: match[1], num: parseInt(match[2], 10) };
}

function sortStrongIds(a, b) {
    const keyA = strongSortKey(a);
    const keyB = strongSortKey(b);
    if (keyA.type !== keyB.type) return keyA.type.localeCompare(keyB.type);
    return keyA.num - keyB.num;
}

function escapeHtml(string) {
    return String(string).replace(/[&<>"']/g, function (s) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s];
    });
}

function getLocalStrongsDefinitionHtml(strongId) {
    const rawEntry = strongsDict[strongId];
    if (!rawEntry) {
        return " ── <span style='color:#999; font-weight:normal; font-size:12px;'>（辭典中未錄入此編號）</span>";
    }

    try {
        const parts = rawEntry.split('|');
        const lemma = parts[0] ? parts[0].trim() : strongId;
        let definition = parts[1] ? parts[1].replace('意義:', '').trim() : "暫無釋義";
        definition = escapeHtml(definition).replace(/\n/g, '<br>');
        return ` ── <span class="original-word">${escapeHtml(lemma)}</span> <span class="english-def">${definition}</span>`;
    } catch (e) {
        return ` ── <span class="english-def">${escapeHtml(rawEntry)}</span>`;
    }
}

function buildSectionsHtml(groups, keyword) {
    let html = "";
    const sortedKeys = Object.keys(groups).sort(sortStrongIds);
    
    sortedKeys.forEach(strongId => {
        let verses = groups[strongId];
        
        verses.sort((a, b) => {
            if (a.book_id !== b.book_id) return a.book_id - b.book_id;
            if (parseInt(a.chapter) !== parseInt(b.chapter)) return parseInt(a.chapter) - parseInt(b.chapter);
            return parseInt(a.verse) - parseInt(b.verse);
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
            const safeText = escapeHtml(v.text);
            const safeKeyword = escapeHtml(keyword);
            const highlighted = safeText.split(safeKeyword).join(`<span class='hl'>${safeKeyword}</span>`);
            
            html += `
                <tr>
                    <td>${v.book_name}</td>
                    <td>${v.chapter}:${v.verse}</td>
                    <td>${highlighted}</td>
                </tr>
            `;
        });

        html += `</tbody></table><hr class='group-divider'>`;
    });
    return html;
}



function runSearch() { 
    let rawKeyword = document.getElementById('keyword').value.trim(); 
    if (!rawKeyword) return; 

    if (bibleData.length === 0 || bibleSimpData.length === 0) {
        alert("資料庫尚未加載完成。"); 
        return; 
    } 

    // 💡 步驟 1：同時準備好這組字的「繁體版」與「簡體版」
    let tradKeyword = rawKeyword;
    let simpKeyword = rawKeyword;

    if (typeof s2t_t2s === 'object') {
        if (typeof s2t_t2s.s2t === 'function') tradKeyword = s2t_t2s.s2t(rawKeyword); // 確保拿到繁體（如：喜樂）
        if (typeof s2t_t2s.t2s === 'function') simpKeyword = s2t_t2s.t2s(rawKeyword); // 確保拿到簡體（如：喜乐）
    }

    // 💡 步驟 2：字體特徵偵測，決定顯示哪種字體
    let isSimplified = false;
    if (/[爱创造圣经国门们时后会种样里个乐]/g.test(rawKeyword) || tradKeyword !== rawKeyword) {
        isSimplified = true;
    }

    // 根據偵測結果，挑選主要翻找的字庫
    const currentBibleDatabase = isSimplified ? bibleSimpData : bibleData;

    document.getElementById('status').innerText = "搜尋中..."; 
    let otGroups = {}; 
    let ntGroups = {}; 
    let otTotalVerses = 0; 
    let ntTotalVerses = 0; 

    // 💡 步驟 3：雙軌搜尋！只要經文包含繁體「或」簡體，通通抓出來！
    currentBibleDatabase.forEach(entry => { 
        const rawText = entry.text || ""; 
        
        // ⭐ 這裡是最關鍵的容錯：經文包含繁體關鍵字，或者包含簡體關鍵字，都算中！
        let matchedKeyword = "";
        if (rawText.includes(simpKeyword)) {
            matchedKeyword = simpKeyword;
        } else if (rawText.includes(tradKeyword)) {
            matchedKeyword = tradKeyword;
        } else {
            return; // 都不包含就跳過
        }

        const bookId = parseInt(entry.book, 10); 
        
        // 用成功匹配到的那個中文字組去抓 Strong 編號
        const strongIds = findAllStrongs(rawText, matchedKeyword); 
        if (strongIds.length === 0) return; 

        const verseData = { 
            book_id: bookId, 
            book_name: BOOK_MAP[bookId] || `未知(${bookId})`, 
            chapter: entry.chapter, 
            verse: entry.verse, 
            text: cleanStrongs(rawText) 
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

    // 💡 步驟 4：高亮時同時相容繁簡體
    const otHtml = Object.keys(otGroups).length ? buildSectionsHtml(otGroups, simpKeyword) : "<p class='no-result'>無結果</p>"; 
    const ntHtml = Object.keys(ntGroups).length ? buildSectionsHtml(ntGroups, simpKeyword) : "<p class='no-result'>無結果</p>"; 

    // 呼叫修補工具，確保畫面上的「喜乐」和「喜樂」都能變黃色高亮
    document.getElementById('ot-results').innerHTML = htmlFontFix(otHtml, tradKeyword, simpKeyword);
    document.getElementById('nt-results').innerHTML = htmlFontFix(ntHtml, tradKeyword, simpKeyword);
    document.getElementById('results-area').style.display = 'block'; 
    document.getElementById('status').innerText = "搜尋完畢！"; 
}

// 💡 繁簡高亮輔助工具（如果原本的 buildSectionsHtml 漏掉了其中一種字體，這裡強制補上黃色高亮）
function htmlFontFix(htmlStr, trad, simp) {
    if (!htmlStr) return htmlStr;
    let res = htmlStr;
    const safeTrad = String(trad).replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]));
    const safeSimp = String(simp).replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]));
    
    res = res.split(safeTrad).join(`<span class='hl'>${safeTrad}</span>`);
    if (safeTrad !== safeSimp) {
        res = res.split(safeSimp).join(`<span class='hl'>${safeSimp}</span>`);
    }
    return res;
}



 

// 💡 輔助高亮修正函式：確保繁體和簡體字在表格裡都能變成黃色高亮
function htmlFontFix(htmlStr, trad, simp) {
    if (!htmlStr) return htmlStr;
    let res = htmlStr;
    if (trad && trad !== simp) {
        // 如果經文裡輸出的是簡體，而原本只高亮了繁體，這裡補上簡體高亮
        const safeSimp = escapeHtml(simp);
        res = res.split(safeSimp).join(`<span class='hl'>${safeSimp}</span>`);
    }
    return res;
}

function runReverseSearch() {
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







        
    


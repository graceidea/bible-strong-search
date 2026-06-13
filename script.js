const BOOK_MAP = {
    1: "創世記", 2: "出埃及記", 3: "利未記", 4: "民數記", 5: "申命記", 6: "約書亞記", 7: "士師記", 8: "路得記", 9: "撒母耳記上", 10: "撒母耳記下", 11: "列王紀上", 12: "列王紀下", 13: "歷代志上", 14: "歷代志下", 15: "以斯拉記", 16: "尼希米記", 17: "以斯帖記", 18: "約伯記", 19: "詩篇", 20: "箴言", 21: "傳道書", 22: "雅歌", 23: "賽亞書", 24: "耶利米書", 25: "耶利米哀歌", 26: "以西結書", 27: "但以理書", 28: "何西阿書", 29: "約珥書", 30: "阿摩司書", 31: "俄巴底亞書", 32: "約拿書", 33: "彌迦書", 34: "那鴻書", 35: "哈巴谷書", 36: "西番雅書", 37: "哈該書", 38: "撒迦利亞書", 39: "瑪拉基書", 40: "馬太福音", 41: "馬可福音", 42: "路加福音", 43: "約翰福音", 44: "使徒行傳", 45: "羅馬書", 46: "哥林多前書", 47: "哥林多後書", 48: "加拉太書", 49: "以弗所書", 50: "腓立比書", 51: "歌羅西書", 52: "帖撒羅尼迦前書", 53: "帖撒羅尼迦後書", 54: "提摩太前書", 55: "提摩太後書", 56: "提多書", 57: "腓利門書", 58: "希伯來書", 59: "雅各書", 60: "彼得前書", 61: "彼得後書", 62: "約翰一書", 63: "約翰二書", 64: "約翰三書", 65: "猶大書", 66: "啟示錄"
};

let bibleData = [];

// 網頁開啟時下載資料
window.onload = function() {
    fetch('./chinesetrad.json')
        .then(res => {
            if (!res.ok) throw new Error("無法讀取 chinesetrad.json");
            return res.json();
        })
        .then(data => {
            bibleData = data;
            document.getElementById('status').innerText = "資料庫載入完成，可以開始搜尋！";
        })
        .catch(err => {
            document.getElementById('status').innerText = "錯誤: 加載 JSON 失敗，請確認檔案路徑。";
            console.error(err);
        });
};

// 模式切換邏輯
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

// 清理 Strong's 編號
function cleanStrongs(text) {
    if (!text) return "";
    let t = String(text);
    t = t.replace(/[<{][GH]\d+[a-zA-Z]?[>}]/g, '');
    t = t.replace(/\b[GH]\d+[a-zA-Z]?\b/g, '');
    return t.trim();
}

// 尋找 Strong's 編號
function findAllStrongs(rawText, keyword) {
    const escaped = keyword.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const pattern = new RegExp(escaped + "((?:[<{][GH]\\d+[a-zA-Z]?[>}])+)", "g");
    
    let strongs = [];
    let match;
    while ((match = pattern.exec(rawText)) !== null) {
        const block = match[1];
        const subMatches = block.match(/[GH]\d+[a-zA-Z]?/g);
        if (subMatches) {
            strongs.push(...subMatches);
        }
    }
    return [...new Set(strongs)]; 
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

        html += `
            <div class='group-title'> 
                <span>原文編號: <strong>${strongId}</strong></span>
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

/* =========================================================
   模式一：關鍵字查詢 (已預留未來「簡繁轉換」的擴充點)
   ========================================================= */
function runSearch() {
    let keyword = document.getElementById('keyword').value.trim();
    if (!keyword) return;
    if (bibleData.length === 0) { alert("資料庫尚未加載完成。"); return; }

    document.getElementById('status').innerText = "搜尋中...";

    // 💡 【未來擴充點】在這裡加入簡繁體字典轉換
    // 範例：if (isSimplified(keyword)) keyword = convertToTraditional(keyword);
    
    let otGroups = {};
    let ntGroups = {};
    let otTotalVerses = 0;
    let ntTotalVerses = 0;

    bibleData.forEach(entry => {
        const rawText = entry.text || "";
        
        // 💡 如果未來做了轉換，這裡的 includes 就能順利比對繁體資料庫
        if (!rawText.includes(keyword)) return;

        const bookId = parseInt(entry.book, 10);
        const strongIds = findAllStrongs(rawText, keyword);
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

    const otHtml = Object.keys(otGroups).length ? buildSectionsHtml(otGroups, keyword) : "<p class='no-result'>無結果</p>";
    const ntHtml = Object.keys(ntGroups).length ? buildSectionsHtml(ntGroups, keyword) : "<p class='no-result'>無結果</p>";

    document.getElementById('ot-results').innerHTML = otHtml;
    document.getElementById('nt-results').innerHTML = ntHtml;
    document.getElementById('results-area').style.display = 'block';
    document.getElementById('status').innerText = "搜尋完畢！";
}

/* =========================================================
   模式二：原文反查模式 (目前先做基礎偵測提示，供你未來擴充)
   ========================================================= */
function runReverseSearch() {
    const rawInputText = document.getElementById('reverse-text').value.trim();
    const targetWord = document.getElementById('reverse-target').value.trim();

    if (!rawInputText || !targetWord) {
        alert("請輸入參考經文與要反查的特定中文字！");
        return;
    }

    alert(`【功能開發中】\n你希望在輸入的內文中，找出「${targetWord}」對應的希臘文或希伯來文編號。\n目前架構已就緒，下一步我們可以匯入編號字典檔來進行精準比對。`);
    
    // 💡 【未來擴充邏輯】
    // 1. 解析 rawInputText，將其與 bibleData 的章節內容進行模糊比對，找出它是哪一卷哪一章哪一節。
    // 2. 找到對應的經文原始資料（帶有 Strong's 編號的 rawText）。
    // 3. 用正則表達式撈出 targetWord 後面接著的 [Gxxxx] 或 [Hxxxx]。
    // 4. 將結果彈出或呈現在結果區！
}

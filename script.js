const BOOK_MAP = {
    1: "創世記", 2: "出埃及記", 3: "利未記", 4: "民數記", 5: "申命記", 6: "約書亞記", 7: "士師記", 8: "路得記", 9: "撒母耳記上", 10: "撒母耳記下", 11: "列王紀上", 12: "列王紀下", 13: "歷代志上", 14: "歷代志下", 15: "以斯拉記", 16: "尼希米記", 17: "以斯帖記", 18: "約伯記", 19: "詩篇", 20: "箴言", 21: "傳道書", 22: "雅歌", 23: "賽亞書", 24: "耶利米書", 25: "耶利米哀歌", 26: "以西結書", 27: "但以理書", 28: "何西阿書", 29: "約珥書", 30: "阿摩司書", 31: "俄巴底亞書", 32: "約拿書", 33: "彌迦書", 34: "那鴻書", 35: "哈巴谷書", 36: "西番雅書", 37: "哈該書", 38: "撒迦利亞書", 39: "瑪拉基書", 40: "馬太福音", 41: "馬可福音", 42: "路加福音", 43: "約翰福音", 44: "使徒行傳", 45: "羅馬書", 46: "哥林多前書", 47: "哥林多後書", 48: "加拉太書", 49: "以弗所書", 50: "腓立比書", 51: "歌羅西書", 52: "帖撒羅尼迦前書", 53: "帖撒羅尼迦後書", 54: "提摩太前書", 55: "提摩太後書", 56: "提多書", 57: "腓利門書", 58: "希伯來書", 59: "雅各書", 60: "彼得前書", 61: "彼得後書", 62: "約翰一書", 63: "約翰二書", 64: "約翰三書", 65: "猶大書", 66: "啟示錄"
};

let bibleData = [];

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
    t = t.replace(/[<{][GH]\d+[a-zA-Z]?[>}]/g, '');
    t = t.replace(/\b[GH]\d+[a-zA-Z]?\b/g, '');
    return t.trim();
}

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

/**
 * 💡 新增功能：從公開的精簡版 Strong's 字典 API 異步獲取原文和英文定義
 * 支援舊約希伯來文 (H) 與新約希臘文 (G)
 */
function fetchStrongsDefinition(strongId) {
    const isHebrew = strongId.startsWith('H');
    // 去除編號前綴字母，補足為四位數（例如 H2655 -> 2655，符合開源字典 API 的路徑規範）
    const num = strongId.substring(1).padStart(4, '0');
    const testament = isHebrew ? 'hebrew' : 'greek';
    
    // 使用開源的 BDB (希伯來) / Thayer (希臘) 字典庫路徑
    const url = `https://raw.githubusercontent.com/skorespace/OpenGNT/master/data/strongs/${testament}/${num}.json`;

    fetch(url)
        .then(res => {
            if (!res.ok) throw new Error();
            return res.json();
        })
        .then(data => {
            // 根據開源聖經 JSON 結構抓取字根與英文釋義
            const lemma = data.lemma || data.word || "未知字根";
            const definition = data.derivation || data.definition || data.strongs_def || "暫無英文釋義";
            
            // 動態更新網頁上對應 ID 的元素內容
            const infoElem = document.getElementById(`info-${strongId}`);
            if (infoElem) {
                infoElem.innerHTML = ` ── <span class="original-word">${lemma}</span> <span class="english-def">(${definition})</span>`;
            }
        })
        .catch(() => {
            // 如果開源庫沒抓到，嘗試備用開源地址
            const fallbackUrl = `https://openbibleinfo.github.io/strongs/${testament}/${parseInt(num, 10)}.json`;
            fetch(fallbackUrl)
                .then(res => res.json())
                .then(data => {
                    const infoElem = document.getElementById(`info-${strongId}`);
                    if (infoElem) {
                        infoElem.innerHTML = ` ── <span class="original-word">${data.transliteration || ''}</span> <span class="english-def">(${data.definition || 'No definition found'})</span>`;
                    }
                })
                .catch(() => {
                    const infoElem = document.getElementById(`info-${strongId}`);
                    if (infoElem) infoElem.innerHTML = " ── <span style='color:#999; font-weight:normal; font-size:12px;'>（未尋得雲端原文定義）</span>";
                });
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

        // 💡 修改點：在 title 裡預留一個 span 容器 (id="info-H2655")，稍後透過 API 把查詢到的原文與英文塞進去
        html += `
            <div class='group-title'> 
                <span>原文編號: <strong>${strongId}</strong><span id="info-${strongId}"><span class="loading-text"> ── 正在查詢雲端字根...</span></span></span>
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

        // 💡 渲染完 HTML 骨架後，立刻呼叫非同步函式去網路上抓這個編號的定義
        setTimeout(() => { fetchStrongsDefinition(strongId); }, 50);
    });
    return html;
}

function runSearch() {
    let keyword = document.getElementById('keyword').value.trim();
    if (!keyword) return;
    if (bibleData.length === 0) { alert("資料庫尚未加載完成。"); return; }

    document.getElementById('status').innerText = "搜尋中...";
    
    let otGroups = {};
    let ntGroups = {};
    let otTotalVerses = 0;
    let ntTotalVerses = 0;

    bibleData.forEach(entry => {
        const rawText = entry.text || "";
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

function runReverseSearch() {
    const rawInputText = document.getElementById('reverse-text').value.trim();
    const targetWord = document.getElementById('reverse-target').value.trim();

    if (!rawInputText || !targetWord) {
        alert("請輸入參考經文與要反查的特定中文字！");
        return;
    }
    alert(`【功能開發中】\n你希望在輸入的內文中，找出「${targetWord}」對應的希臘文或希伯來文編號。`);
}


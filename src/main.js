// ==========================================
// main.js - 使用StrongSearchBuilder的新策略
// ==========================================

document.addEventListener('DOMContentLoaded', function () {
  const statusElement = document.getElementById('status');
  if (statusElement) {
    statusElement.innerText = "正在載入聖經資料庫與原文辭典...";
  }

  // 1. 智能获取项目的根目录路径（自动剔除文件名，保留目录结构）
  let basePath = window.location.pathname;
  if (basePath.endsWith('.html')) {
    // 如果路径带有 index.html，则截取到最后一层斜杠
    basePath = basePath.substring(0, basePath.lastIndexOf('/') + 1);
  } else if (!basePath.endsWith('/')) {
    // 如果不带斜杠结尾，自动补齐斜杠
    basePath += '/';
  }

  // 2. 加载所有 JSON 文件
  Promise.all([
    fetch(`${basePath}data/chinesetrad.json`).then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    }),
    fetch(`${basePath}data/chinesesimp.json`).then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    }),
    fetch(`${basePath}data/strongs_dict.json`).then(res => {
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
    // 💡 建议补上异常捕获，这样万一出错，能立刻在界面和控制台给出清晰提示
    console.error("❌ 載入失敗:", err);
    if (statusElement) {
      statusElement.innerText = `❌ 錯誤: ${err.message}`;
      statusElement.style.color = '#e74c3c';
    }
  });
});

function populateBookFilter() {
    const filterSelect = document.getElementById('book-filter');
    if (!filterSelect) return;

    // 1. 清空并初始化顶部全局选项
    filterSelect.innerHTML = `
    <option value="all">🔍 所有書卷（全部）</option>
    <option value="ot_all">✨ 舊約全部</option>
    <option value="nt_all">✨ 新約全部</option>
  `;

    // 2. 创建旧约和新约的分组标签
    const otGroup = document.createElement('optgroup');
    otGroup.label = "📜 ————— 舊約 —————";

    const ntGroup = document.createElement('optgroup');
    ntGroup.label = "📖 ————— 新約 —————";

    // 3. 遍历书籍并按编号/索引归类
    // 假设你的 BOOK_MAP 的 key/id 是按圣经顺序排列的（例如 1-39 是旧约，40-66 是新约）
    // 或者你也可以根据 id 的前缀、或通过计数器来判断
    let index = 0;
    Object.keys(BOOK_MAP).forEach(id => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = BOOK_MAP[id];

        // 判断依据：前39卷划入旧约，后27卷划入新约
        if (index < 39) {
            otGroup.appendChild(option);
        } else {
            ntGroup.appendChild(option);
        }
        index++;
    });

    // 4. 将分组正式追加到下拉菜单中
    filterSelect.appendChild(otGroup);
    filterSelect.appendChild(ntGroup);
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

    if (!bibleData) {
        alert("資料庫尚未加載完成，請稍後再試。");
        return;
    }

    const selectedBookFilter = document.getElementById('book-filter')?.value || 'all';

    // ==========================================
    // ✅ 简繁转换
    // ==========================================
    let searchKeyword = rawKeyword;
    if (rawKeyword === '爱') {
        searchKeyword = '愛';
    }
    const simpToTradMap = {
        '创造': '創造',
        '圣经': '聖經',
        '耶稣': '耶穌',
        '基督': '基督',
        '约翰': '約翰',
        '福音': '福音',
        '世界': '世界'
    };
    for (const [simp, trad] of Object.entries(simpToTradMap)) {
        if (rawKeyword.includes(simp)) {
            searchKeyword = rawKeyword.replaceAll(simp, trad);
        }
    }

    console.log('🔍 原始輸入:', rawKeyword);
    console.log('🔍 搜索關鍵詞:', searchKeyword);

    // ==========================================
    // ✅ 執行搜索
    // ==========================================
    const results = {
        ot: [],
        nt: [],
        total: 0
    };

    let bookIds = Object.keys(BOOK_MAP);
    if (selectedBookFilter !== 'all') {
        if (selectedBookFilter === 'ot_all') {
            bookIds = Object.keys(BOOK_MAP).slice(0, 39);
        } else if (selectedBookFilter === 'nt_all') {
            bookIds = Object.keys(BOOK_MAP).slice(39);
        } else {
            bookIds = [selectedBookFilter];
        }
    }

    const bookIdSet = new Set();
    bookIds.forEach(id => {
        bookIdSet.add(String(id));
        bookIdSet.add(Number(id));
    });

    bibleData.forEach(verse => {
        if (!bookIdSet.has(verse.book) && !bookIdSet.has(String(verse.book)) && !bookIdSet.has(Number(verse.book))) {
            return;
        }

        const verseText = verse.text || '';

        if (verseText.includes(searchKeyword)) {
            const bookIdNum = parseInt(verse.book);
            if (bookIdNum <= 39) {
                results.ot.push(verse);
            } else {
                results.nt.push(verse);
            }
            results.total++;
        }
    });

    console.log('✅ 搜索結果:', results.total, '條');

    // ==========================================
    // ✅ 顯示結果（按强号分组，鼠标悬停显示解释）
    // ==========================================
    const resultsArea = document.getElementById('results-area');
    const otContainer = document.getElementById('ot-results');
    const ntContainer = document.getElementById('nt-results');
    const otCount = document.getElementById('ot-count');
    const ntCount = document.getElementById('nt-count');

    if (resultsArea) {
        resultsArea.style.display = 'block';
        if (otCount) otCount.textContent = results.ot.length;
        if (ntCount) ntCount.textContent = results.nt.length;

        // ==========================================
        // ✅ 分组渲染函数（带 tooltip）
        // ==========================================
        const renderGroupedVerses = (verses) => {
            if (!verses || verses.length === 0) return '<p class="no-result">📭 無結果</p>';

            // 按强号分组
            const grouped = {};
            verses.forEach(v => {
                const text = v.text || '';
                const strongMatches = text.match(/[GH]\d+/g) || [];
                const key = strongMatches.length > 0 ? strongMatches[0] : '其他';
                if (!grouped[key]) {
                    grouped[key] = [];
                }
                grouped[key].push(v);
            });

            // 排序
            const sortedKeys = Object.keys(grouped).sort((a, b) => {
                if (a === '其他') return 1;
                if (b === '其他') return -1;
                const aType = a[0];
                const bType = b[0];
                if (aType !== bType) {
                    return aType === 'G' ? -1 : 1;
                }
                return parseInt(a.substring(1)) - parseInt(b.substring(1));
            });

            let html = '';
            sortedKeys.forEach(key => {
                const items = grouped[key];
                const isHebrew = key.startsWith('H');
                const badgeColor = isHebrew ? '#d35400' : '#2980b9';
                const langText = isHebrew ? '📜 希伯來文' : '📖 希臘文';

                // 获取强号解释（用于 tooltip）
                let definition = '';
                let hasDefinition = false;
                if (key !== '其他' && strongsDict && strongsDict[key]) {
                    const rawDef = strongsDict[key];
                    const match = rawDef.match(/\|\s*意義:\s*([^()]+)/);
                    if (match) {
                        definition = match[1].trim();
                        hasDefinition = true;
                    } else {
                        definition = rawDef.replace(/\n/g, ' ').substring(0, 60).trim();
                        hasDefinition = true;
                    }
                }

                html += `
                    <div style="margin: 12px 0 8px 0; padding: 8px 12px; background: ${badgeColor}; color: white; border-radius: 4px; font-weight: bold; display: flex; align-items: center; justify-content: space-between;">
                        <span>
                            ${langText} <span style="font-family: monospace;">${key}</span>
                            ${hasDefinition ? `
                                <span class="strong-tooltip" style="position: relative; display: inline-block; cursor: help; margin-left: 8px;">
                                    <span style="display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; background: rgba(255,255,255,0.25); border-radius: 50%; font-size: 12px; font-weight: bold; color: white; border: 1px solid rgba(255,255,255,0.3);">i</span>
                                    <span style="display: none; position: absolute; left: 50%; transform: translateX(-50%); bottom: 30px; background: #1a1a2e; color: #fff; padding: 8px 14px; border-radius: 6px; font-size: 13px; font-weight: normal; white-space: nowrap; max-width: 450px; overflow: hidden; text-overflow: ellipsis; z-index: 1000; box-shadow: 0 4px 16px rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1);">
                                        ${definition}
                                        <span style="position: absolute; bottom: -8px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 8px solid transparent; border-right: 8px solid transparent; border-top: 8px solid #1a1a2e;"></span>
                                    </span>
                                </span>
                            ` : ''}
                        </span>
                        <span style="font-weight: normal; font-size: 14px;">${items.length} 節</span>
                    </div>
                `;

                items.forEach(v => {
                    const bookName = BOOK_MAP[String(v.book)] || `書卷 ${v.book}`;
                    let text = v.text || '';

                    // 移除所有 Strong number
                    text = text.replace(/\{[GH]\d+\}/g, '');
                    text = text.replace(/\s+/g, ' ').trim();

                    // 高亮关键词
                    text = text.replaceAll(searchKeyword, `<span style="background: #ffeb3b; padding: 0 2px; border-radius: 2px; font-weight: bold;">${searchKeyword}</span>`);

                    html += `
                        <div style="padding: 6px 12px; border-bottom: 1px solid #eee; margin-left: 16px; line-height: 1.8;">
                            <span style="font-weight: bold; color: #2c3e50;">${bookName} ${v.chapter}:${v.verse}</span>
                            <span style="margin-left: 8px;">${text}</span>
                        </div>
                    `;
                });
            });

            // Tooltip hover 样式
            html += `
                <style>
                    .strong-tooltip:hover > span:last-child {
                        display: block !important;
                    }
                </style>
            `;

            return html;
        };

        otContainer.innerHTML = renderGroupedVerses(results.ot);
        ntContainer.innerHTML = renderGroupedVerses(results.nt);
    }

    const statusElement = document.getElementById('status');
    if (statusElement) {
        statusElement.innerText = `✅ 搜尋完成，找到 ${results.total} 節經文`;
        statusElement.style.color = '#2ecc71';
    }
}
/**
 * 渲染搜索结果
 */
function renderSearchResults(results, tradKeyword, simpKeyword) {
    const resultsArea = document.getElementById('results-area');
    const otContainer = document.getElementById('ot-results');
    const ntContainer = document.getElementById('nt-results');
    const otCount = document.getElementById('ot-count');
    const ntCount = document.getElementById('nt-count');

    if (!resultsArea || !otContainer || !ntContainer) return;

    // 顯示結果區域
    resultsArea.style.display = 'block';

    // 更新計數
    if (otCount) otCount.textContent = results.ot.length;
    if (ntCount) ntCount.textContent = results.nt.length;

    // 渲染舊約結果
    if (results.ot.length === 0) {
        otContainer.innerHTML = '<p class="no-result">📭 無結果</p>';
    } else {
        otContainer.innerHTML = results.ot.map(verse => {
            return formatVerseHtml(verse, tradKeyword, simpKeyword);
        }).join('');
    }

    // 渲染新約結果
    if (results.nt.length === 0) {
        ntContainer.innerHTML = '<p class="no-result">📭 無結果</p>';
    } else {
        ntContainer.innerHTML = results.nt.map(verse => {
            return formatVerseHtml(verse, tradKeyword, simpKeyword);
        }).join('');
    }
}

/**
 * 格式化單節經文 HTML
 */
function formatVerseHtml(verse, tradKeyword, simpKeyword) {
    const bookName = BOOK_MAP[verse.book] || `書卷 ${verse.book}`;
    let text = verse.text || '';

    // 高亮關鍵詞（同時高亮繁簡體）
    if (tradKeyword && tradKeyword.length > 0) {
        text = text.replace(new RegExp(tradKeyword, 'g'), `<span class="highlight">${tradKeyword}</span>`);
    }
    if (simpKeyword && simpKeyword.length > 0 && simpKeyword !== tradKeyword) {
        text = text.replace(new RegExp(simpKeyword, 'g'), `<span class="highlight">${simpKeyword}</span>`);
    }

    return `
        <div class="verse-item" style="padding: 10px; border-bottom: 1px solid #eee; margin-bottom: 5px;">
            <span style="font-weight: bold; color: #2980b9;">${bookName} ${verse.chapter}:${verse.verse}</span>
            <span style="margin-left: 10px;">${text}</span>
        </div>
    `;
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

    if (typeof gtag === 'function') {
        gtag('event', 'bible_reverse_search_click', { 'target_word': targetWord });
    }

    // ========================================================
    // 🔥 超強容錯機制：只提取純中文字符進行比對
    // ========================================================

    // 1. 定義一個清洗函數：移除所有括號、英文、數字、空格、標點符號以及特殊符號（如 ¶）
    // 只保留中文字符：[\u4e00-\u9fa5]
    const cleanToPureChinese = (str) => {
        if (!str) return '';
        const matches = str.match(/[\u4e00-\u9fa5]/g);
        return matches ? matches.join('') : '';
    };

    // 清洗用戶輸入的經文
    const cleanInputText = cleanToPureChinese(rawInputText);

    if (!cleanInputText) {
        alert("請在參考經文中包含至少一個中文字！");
        return;
    }

    // 2. 在繁體/簡體數據庫中匹配經文（同樣用純中文字符比對）
    let matchedVerses = [];

    bibleData.forEach(verse => {
        if (verse.text) {
            const pureVerseText = cleanToPureChinese(verse.text);
            if (pureVerseText.includes(cleanInputText)) {
                matchedVerses.push(verse);
            }
        }
    });

    if (matchedVerses.length === 0) {
        bibleSimpData.forEach(verse => {
            if (verse.text) {
                const pureVerseText = cleanToPureChinese(verse.text);
                if (pureVerseText.includes(cleanInputText)) {
                    matchedVerses.push(verse);
                }
            }
        });
    }

    // 3. 依舊找不到的提示
    if (matchedVerses.length === 0) {
        alert(`❌ 在資料庫中找不到包含「${rawInputText.substring(0, 10)}...」的經文。\n(提示：請嘗試輸入更短的核心字句，例如「起初」或「創造天地」)`);
        return;
    }

    // 4. 精準提取：在匹配到的經文原句中，找出帶有目標字（如「天」）的強氏編號
    const foundStrongsNumbers = new Set();

    // 改良的正則表達式：更安全地捕捉「中文字{編號}」
    const regex = new RegExp(`([^\\{\\}\\s]*${targetWord}[^\\{\\}\\s]*)\\{([HG]\\d+)\\}`, 'g');

    matchedVerses.forEach(verse => {
        let match;
        regex.lastIndex = 0;
        while ((match = regex.exec(verse.text)) !== null) {
            const strongsNumber = match[2]; // 捕獲組 2 為 H8064
            foundStrongsNumbers.add(strongsNumber);
        }
    });

    // 5. 保底機制：字典模糊搜索
    if (foundStrongsNumbers.size === 0) {
        console.log(`⚠️ 經文中未精確提取到編號，切換至字典模糊搜尋「${targetWord}」...`);
        /*
        for (const [sn, dictValue] of Object.entries(strongsDict || {})) {
            if (dictValue && dictValue.includes(targetWord)) {
                foundStrongsNumbers.add(sn);
            }
        }
        */
    }

    // 6. 渲染結果
    renderReverseResults(Array.from(foundStrongsNumbers), targetWord);
}



// ==========================================
// 鍵盤快捷鍵
// ==========================================

document.addEventListener('DOMContentLoaded', function () {
    const keywordInput = document.getElementById('keyword');
    if (keywordInput) {
        keywordInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                runSearch();
            }
        });
    }
});

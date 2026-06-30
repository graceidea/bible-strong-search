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

  // 提示：你贴出来的原始代码到这里就结束了，我已经帮你用花括号闭合了这个函数。
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

    // Google Analytics 埋點
    if (typeof gtag === 'function') {
        gtag('event', 'bible_reverse_search_click', { 'target_word': targetWord });
    }

    // ========================================================
    // 🔥 基于你的数据结构：使用正则表达式精准解析 字{编号}
    // ========================================================
    
    // 1. 将用户输入的参考经文去除所有编号（比如用户可能从别处复制带编号的，也可能不带）
    // 确保我们只拿纯汉字去数据库里做全局比对
    const cleanInputText = rawInputText.replace(/\{[HG]\d+\}/g, '');

    // 2. 在繁体/简体数据库中匹配该段经文
    let matchedVerses = [];
    
    // 匹配时，要把数据库里带 {H1234} 的文本先剔除掉编号，再比对纯文本是否包含用户输入的句子
    bibleData.forEach(verse => {
        if (verse.text) {
            const cleanVerseText = verse.text.replace(/\{[HG]\d+\}/g, '');
            if (cleanVerseText.includes(cleanInputText)) {
                matchedVerses.push(verse);
            }
        }
    });
    
    if (matchedVerses.length === 0) {
        bibleSimpData.forEach(verse => {
            if (verse.text) {
                const cleanVerseText = verse.text.replace(/\{[HG]\d+\}/g, '');
                if (cleanVerseText.includes(cleanInputText)) {
                    matchedVerses.push(verse);
                }
            }
        });
    }

    // 3. 如果没找到这段经文，给出提示
    if (matchedVerses.length === 0) {
        alert(`❌ 在資料庫中找不到包含「${cleanInputText.substring(0, 10)}...」的經文。請確認字句是否正確。`);
        return;
    }

    // 4. 精准提取：在匹配到的经文原句中，找出带有目标字（如“神”或“创造”）的 {H/Gxxxx} 编号
    const foundStrongsNumbers = new Set();
    
    // 构建动态正则表达式。例如目标字是"神"，正则会匹配：神{H430} 或 包含"神"的词如 創造神{Hxxxx}
    // 匹配规则：[^\{\}\s]* 允许目标字前后有其他汉字，紧跟着 {H1234} 或 {G1234}
    const regex = new RegExp(`([^\\{\\}\\s]*${targetWord}[^\\{\\}\\s]*)\\{([HG]\\d+)\\}`, 'g');

    matchedVerses.forEach(verse => {
        let match;
        // 重置正则匹配索引
        regex.lastIndex = 0; 
        while ((match = regex.exec(verse.text)) !== null) {
            const strongsNumber = match[2]; // 捕获组 2 是编号，如 H430
            foundStrongsNumbers.add(strongsNumber);
        }
    });

    // 5. 保底机制：如果在经文中没提取到，去强氏字典里模糊搜索包含该字的条目
    if (foundStrongsNumbers.size === 0) {
        console.log(`⚠️ 經文中未精確提取到編號，切換至字典模糊搜尋「${targetWord}」...`);
        for (const [sn, dictValue] of Object.entries(strongsDict || {})) {
            if (dictValue && dictValue.includes(targetWord)) {
                foundStrongsNumbers.add(sn);
            }
        }
    }

    // 6. 渲染结果
    renderReverseResults(Array.from(foundStrongsNumbers), targetWord);
}

/**
 * 渲染结果的页面排版函数（保持不变）
 */
function renderReverseResults(strongsList, targetWord) {
    const resultContainer = document.getElementById('reverse-results');
    
    if (!resultContainer) {
        if (strongsList.length === 0) {
            alert(`找不到與「${targetWord}」相關的原文編號。`);
        } else {
            alert(`反查成功！「${targetWord}」可能對應的原文編號有：\n${strongsList.join(', ')}\n\n(建議在 HTML 中添加 id="reverse-results" 的 div 標籤以獲得更好的視覺排版)`);
        }
        return;
    }

    resultContainer.innerHTML = '';

    if (strongsList.length === 0) {
        resultContainer.innerHTML = `<div style="color: #e74c3c; padding: 15px; background: #fadbd8; border-radius: 4px; margin-top: 15px;">❌ 未找到「${targetWord}」在当前上下文对应的原文编号。</div>`;
        return;
    }

    let html = `<h3 style="margin-top: 20px; color: #2c3e50;">🔍 反查字「${targetWord}」的原文分析：</h3>`;
    
    strongsList.forEach(sn => {
        const dictInfo = strongsDict[sn] || "字典中暫無此編號的詳細釋義";
        const isHebrew = sn.toUpperCase().startsWith('H');
        const langText = isHebrew ? '📜 舊約希伯來文' : '📖 新約希臘文';
        const badgeColor = isHebrew ? '#d35400' : '#2980b9';
        
        html += `
            <div class="strongs-card" style="border: 1px solid #e0e0e0; padding: 15px; margin-bottom: 12px; border-radius: 6px; background: #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                <div style="font-weight: bold; font-size: 16px; margin-bottom: 8px;">
                    <span style="background: ${badgeColor}; color: white; padding: 3px 8px; border-radius: 4px; font-size: 12px; margin-right: 8px; display: inline-block; vertical-align: middle;">${langText}</span>
                    <span style="color: #2c3e50; vertical-align: middle;">編號：${sn}</span>
                </div>
                <div style="color: #555; font-size: 14px; line-height: 1.6; white-space: pre-line; background: #f9f9f9; padding: 10px; border-radius: 4px;">
                    ${dictInfo}
                </div>
            </div>
        `;
    });

    resultContainer.innerHTML = html;
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

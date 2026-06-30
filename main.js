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
    // 🔥 以下為真正實現的反查邏輯（替換原本的 alert）
    // ========================================================
    
    // 1. 在加載好的聖經數據中，尋找包含用戶輸入的「參考經文」的章節
    // 考慮到簡繁體，同時在繁體和簡體數據中匹配
    let matchedVerses = [];
    
    // 遍歷繁體經文
    bibleData.forEach(verse => {
        if (verse.text && verse.text.includes(rawInputText)) {
            matchedVerses.push(verse);
        }
    });
    
    // 如果繁體沒找到，嘗試在簡體經文中找
    if (matchedVerses.length === 0) {
        bibleSimpData.forEach(verse => {
            if (verse.text && verse.text.includes(rawInputText)) {
                matchedVerses.push(verse);
            }
        });
    }

    // 2. 如果連經文都沒匹配到，說明輸入的參考文本太模糊或有錯別字
    if (matchedVerses.length === 0) {
        alert(`❌ 在數據庫中找不到與「${rawInputText.substring(0, 10)}...」相匹配的聖經經文。請提供更精準、連續的經文字句。`);
        return;
    }

    // 3. 收集這些經文裡包含目標中文字（如「愛」）的原文編號
    const foundStrongsNumbers = new Set(); // 使用 Set 防止編號重複
    
    matchedVerses.forEach(verse => {
        // 假設你的聖經數據結構（verse）中包含 w 數組或 strongs 數組
        // 例如：verse.w = [["神", "H430"], ["愛", "H157"], ["世人", "H776"]]
        // 請根據你實際的 JSON 格式調整下方 field 名稱（如 verse.words, verse.strongs 等）
        const wordsArray = verse.w || verse.words || []; 
        
        wordsArray.forEach(item => {
            // item[0] 通常是中文詞，item[1] 是強氏編號
            if (Array.isArray(item) && item[0].includes(targetWord) && item[1]) {
                foundStrongsNumbers.add(item[1]);
            }
        });
    });

    // 4. 如果在匹配到的經文中，沒找到這個中文字對應的編號，則擴大範圍到強氏字典中模糊搜索
    if (foundStrongsNumbers.size === 0) {
        console.log(`⚠️ 經文精確匹配未找到編號，切換至強氏字典模糊搜索「${targetWord}」...`);
        for (const [sn, dictValue] of Object.entries(strongsDict || {})) {
            if (dictValue && dictValue.includes(targetWord)) {
                foundStrongsNumbers.add(sn);
            }
        }
    }

    // 5. 渲染結果到前端界面
    renderReverseResults(Array.from(foundStrongsNumbers), targetWord);
}

/**
 * 新增輔助函數：將反查到的強氏編號和字典釋義渲染到網頁上
 */
function renderReverseResults(strongsList, targetWord) {
    // 假設你的 HTML 中有一個用於顯示結果的容器，例如 id="reverse-results"
    // 如果沒有，請在 HTML 的反查面板（panel-reverse）中加入 <div id="reverse-results"></div>
    const resultContainer = document.getElementById('reverse-results');
    
    if (!resultContainer) {
        // 如果找不到容器，退回到彈窗提示，但此時彈窗顯示的是真正查到的數據
        if (strongsList.length === 0) {
            alert(`找不到與「${targetWord}」相關的原文編號。`);
        } else {
            alert(`反查成功！「${targetWord}」可能對應的原文編號有：\n${strongsList.join(', ')}\n\n(建議在 HTML 中添加 id="reverse-results" 的 div 標籤以獲得更好的視覺排版)`);
        }
        return;
    }

    resultContainer.innerHTML = ''; // 清空舊結果

    if (strongsList.length === 0) {
        resultContainer.innerHTML = `<div class="no-result">❌ 未找到「${targetWord}」對應的原文編號及字典條目。</div>`;
        return;
    }

    // 構建結果 HTML
    let html = `<h3>🔍 反查字「${targetWord}」對應的原文分析結果：</h3>`;
    
    strongsList.forEach(sn => {
        const dictInfo = strongsDict[sn] || "字典中暫無此編號的詳細釋義";
        // 判斷是希伯來文(旧约)還是希臘文(新约)
        const langText = sn.startsWith('H') ? '📜 舊約希伯來文' : '📖 新約希臘文';
        
        html += `
            <div class="strongs-card" style="border: 1px solid #ddd; padding: 10px; margin-bottom: 10px; border-radius: 4px;">
                <div style="font-weight: bold; color: #2980b9;">
                    <span style="background: #e74c3c; color: white; padding: 2px 6px; border-radius: 3px; font-size: 12px; margin-right: 5px;">${langText}</span>
                    編號：${sn}
                </div>
                <div style="margin-top: 5px; color: #34495e; font-size: 14px; white-space: pre-line;">
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

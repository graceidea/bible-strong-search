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
        for (const [sn, dictValue] of Object.entries(strongsDict || {})) {
            if (dictValue && dictValue.includes(targetWord)) {
                foundStrongsNumbers.add(sn);
            }
        }
    }

    // 6. 渲染結果
    renderReverseResults(Array.from(foundStrongsNumbers), targetWord);
}


/**
 * 🎯 精美層級排版版：自動計算多級縮進，並對編號與譯文進行顏色微調
 */
function renderReverseResults(strongsList, targetWord) {
    const resultContainer = document.getElementById('reverse-results');
    
    if (!resultContainer) {
        if (strongsList.length === 0) {
            alert(`找不到與「${targetWord}」相關的原文編號。`);
        } else {
            alert(`反查成功！「${targetWord}」可能對應的原文編號有：\n${strongsList.join(', ')}`);
        }
        return;
    }

    resultContainer.innerHTML = '';

    if (strongsList.length === 0) {
        resultContainer.innerHTML = `<div style="color: #e74c3c; padding: 15px; background: #fadbd8; border-radius: 4px; margin-top: 15px;">❌ 未找到「${targetWord}」在當前上下文對應的原文編號。</div>`;
        return;
    }

    // 💡 核心排版引擎：動態計算縮進與顏色微調
    const formatDefinitionToHierarchicalHtml = (text, badgeColor) => {
        if (!text) return '';
        
        // 1. 使用正則表達式，在所有 1), 2), 1a), 1a1) 編號前插入自定義分隔符 [SPLIT]
        let preparedText = text.replace(/(?=\b\d+[a-z]?\d*\))/g, '[SPLIT]');
        const items = preparedText.split('[SPLIT]');
        
        let finalHtml = '';
        
        items.forEach((item, index) => {
            let trimmed = item.trim();
            if (!trimmed) return;
            
            // 將英文分號替換為更顯眼、間距更好的全形分號
            trimmed = trimmed.replace(/;\s*/g, '； ');

            // 2. 匹配條目開頭的編號（如 1a1)）
            const numMatch = trimmed.match(/^(\d+[a-z]?\d*\))/);
            
            if (numMatch) {
                const fullNum = numMatch[1]; // 提取出 "1a1)"
                const content = trimmed.substring(fullNum.length).trim(); // 提取出後面的譯文文本
                
                // 3. 根據編號長度動態計算層級與縮進 (長度 2=1级, 長度 3=2级, 長度 4或以上=3级)
                let indentLevel = 0;
                if (fullNum.length === 3) indentLevel = 1;      // 例如 "1a)"
                if (fullNum.length >= 4) indentLevel = 2;      // 例如 "1a1)"
                
                const paddingLeft = indentLevel * 20; // 每多一級，向右縮進 20px
                
                // 4. 根據層級微調字體顏色與粗細 (主條目加粗加深，深層條目顏色稍淡)
                const numColor = badgeColor; // 編號顏色與卡片主題色（橘/藍）保持一致
                const textColor = indentLevel === 0 ? '#2c3e50' : (indentLevel === 1 ? '#475569' : '#64748b');
                const fontWeight = indentLevel === 0 ? 'bold' : 'normal';

                finalHtml += `
                    <div style="padding-left: ${paddingLeft}px; margin-bottom: 6px; line-height: 1.6; text-align: left;">
                        <span style="color: ${numColor}; font-weight: bold; font-family: monospace; margin-right: 6px;">• ${fullNum}</span>
                        <span style="color: ${textColor}; font-weight: ${fontWeight};">${content}</span>
                    </div>
                `;
            } else {
                // 如果是開頭的原文單詞或基礎意義（沒有編號的部分）
                finalHtml += `
                    <div style="font-size: 15px; font-weight: bold; color: #1e293b; margin-bottom: 12px; border-bottom: 1px dashed #e2e8f0; padding-bottom: 8px; text-align: left;">
                        ${trimmed}
                    </div>
                `;
            }
        });
        
        return finalHtml;
    };

    let html = `<h3 style="margin-top: 20px; color: #2c3e50;">🔍 反查字「${targetWord}」的原文分析：</h3>`;
    
    let builderInstance = null;
    if (typeof StrongSearchBuilder !== 'undefined') {
        builderInstance = StrongSearchBuilder.getInstance();
    }

    strongsList.forEach(sn => {
        let dictInfo = "字典中暫無此編號的詳細釋義";
        
        if (builderInstance && builderInstance.strongsDict && builderInstance.strongsDict[sn]) {
            dictInfo = builderInstance.strongsDict[sn];
        } else if (typeof strongsDict !== 'undefined' && strongsDict[sn]) {
            dictInfo = strongsDict[sn];
        } else if (typeof getLocalStrongsDefinitionHtml === 'function') {
            dictInfo = getLocalStrongsDefinitionHtml(sn);
        }

        const isHebrew = sn.toUpperCase().startsWith('H');
        const langText = isHebrew ? '📜 舊約希伯來文' : '📖 新約希臘文';
        const badgeColor = isHebrew ? '#d35400' : '#2980b9'; // 舊約溫暖橘，新約深邃藍
        
        // 💡 核心改動：套用全新的多級層級排版引擎
        const structuredHtml = formatDefinitionToHierarchicalHtml(dictInfo, badgeColor);

        html += `
            <div class="strongs-card" style="border: 1px solid #e2e8f0; padding: 18px; margin-bottom: 16px; border-radius: 8px; background: #fff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03);">
                <div style="font-weight: bold; font-size: 16px; margin-bottom: 14px; text-align: left;">
                    <span style="background: ${badgeColor}; color: white; padding: 4px 10px; border-radius: 4px; font-size: 12px; margin-right: 10px; display: inline-block; vertical-align: middle;">${langText}</span>
                    <span style="color: #1e293b; vertical-align: middle; letter-spacing: 0.5px;">編號：${sn}</span>
                </div>
                <div style="background: #f8fafc; padding: 16px; border-radius: 8px; border-left: 4px solid ${badgeColor}; font-size: 14px;">
                    ${structuredHtml}
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

// ==========================================
// 1. 通用工具函数
// ==========================================

/**
 * 通用简繁转换（基于常用字符映射）
 */
function getChineseVariants(keyword) {
    const variants = new Set([keyword]);
    
    // 常用简繁映射表（可扩展）
    const charMap = {
        '爱': '愛', '愛': '爱',
        '义': '義', '義': '义',
        '信': '信',
        '罪': '罪',
        '神': '神',
        '主': '主',
        '耶稣': '耶穌', '耶穌': '耶稣',
        '基督': '基督',
        '圣': '聖', '聖': '圣',
        '灵': '靈', '靈': '灵',
        '恩': '恩',
        '典': '典',
        '救': '救',
        '赎': '贖', '贖': '赎',
        '约': '約', '約': '约',
        '律': '律',
        '法': '法',
        '恶': '惡', '惡': '恶',
        '善': '善'
    };
    
    // 生成所有可能的变体组合
    let chars = keyword.split('');
    let combinations = [chars];
    
    chars.forEach((char, index) => {
        if (charMap[char]) {
            const newCombinations = [];
            combinations.forEach(combo => {
                const variant = [...combo];
                variant[index] = charMap[char];
                newCombinations.push(variant);
            });
            combinations = combinations.concat(newCombinations);
        }
    });
    
    combinations.forEach(combo => {
        variants.add(combo.join(''));
    });
    
    return Array.from(variants);
}

/**
 * 安全HTML转义
 */
function safeEscapeHtml(str) {
    if (!str) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(str).replace(/[&<>"']/g, function(m) { return map[m]; });
}

/**
 * Strong编号排序函数
 */
function sortStrongIds(a, b) {
    const aNum = parseInt(a.replace(/[^0-9]/g, '')) || 0;
    const bNum = parseInt(b.replace(/[^0-9]/g, '')) || 0;
    if (aNum !== bNum) return aNum - bNum;
    return a.localeCompare(b);
}

/**
 * 清理经文中的原文编号标记
 */
function cleanVerseText(text) {
    if (!text) return '';
    return text
        .replace(/[<{[]\s*[GH]\d+[a-zA-Z]?\s*[>}\]]/gi, '')
        .replace(/\s*[GH]\d+[a-zA-Z]?\s*/gi, ' ')
        .replace(/[<>{}[\]]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// ==========================================
// 2. 核心搜索与构建函数（修复版）
// ==========================================

/**
 * 构建搜索结果HTML（通用版）
 */
function buildSectionsHtml(groups, keyword, isSimplifiedMode, options = {}) {
    console.log(`%c>>> 搜索关键词: "${keyword}" <<<`, "color: #00bcd4; font-weight: bold; font-size: 14px;");
    console.log("📊 groups数据结构:", Object.keys(groups).length, "个编号");
    console.log("📊 前3个编号示例:", Object.keys(groups).slice(0, 3));
    
    // 配置选项
    const config = {
        maxDefinitionLength: options.maxDefinitionLength || 200,
        highlightColor: options.highlightColor || '#e74c3c',
        showTooltips: options.showTooltips !== false,
        ...options
    };
    
    // 获取字典
    const dict = typeof strongsDict !== 'undefined' ? strongsDict : window.strongsDict;
    if (!dict) {
        console.error("❌ 找不到字典对象 strongsDict！");
        return `<div class='error-message' style='padding: 20px; text-align: center; color: red;'>
            错误：未检测到斯特朗原文字典数据。
        </div>`;
    }
    
    // 🎯 1. 构建动态白名单（修复版）
    const dynamicStrongList = new Set();
    const keywordVariants = getChineseVariants(keyword);
    
    console.log(`📝 关键词变体:`, keywordVariants);
    
    // 🔥 修复：先尝试直接用groups中的编号查找
    console.log("🔍 方法1: 从字典中搜索关键词...");
    
    // 遍历字典，匹配所有关键词变体
    let matchCount = 0;
    Object.keys(dict).forEach(strongId => {
        const dictText = dict[strongId];
        if (typeof dictText === 'string') {
            const matched = keywordVariants.some(variant => 
                dictText.includes(variant)
            );
            if (matched) {
                dynamicStrongList.add(strongId.trim().toUpperCase());
                matchCount++;
                if (matchCount <= 5) {
                    console.log(`  ✅ 匹配: ${strongId} -> ${dictText.substring(0, 50)}...`);
                }
            }
        }
    });
    
    console.log(`📊 字典匹配结果: ${matchCount} 个编号`);
    
    // 🎯 2. 如果字典匹配为空，尝试从groups中提取（备用方案）
    if (dynamicStrongList.size === 0) {
        console.warn("⚠️ 字典中未找到匹配，尝试从groups数据中提取...");
        
        // 从groups的key中提取可能的编号
        Object.keys(groups).forEach(strongId => {
            const cleanId = strongId.trim().toUpperCase();
            // 直接添加所有groups中的编号（如果它们看起来是有效的Strong编号）
            if (/^[GH]\d+/.test(cleanId)) {
                dynamicStrongList.add(cleanId);
                console.log(`  添加编号: ${cleanId}`);
            }
        });
        
        console.log(`📊 从groups提取: ${dynamicStrongList.size} 个编号`);
    }
    
    // 🎯 3. 打印匹配列表
    const finalListArray = Array.from(dynamicStrongList).sort(sortStrongIds);
    console.log("%c★============================================================★", "color: #ffeb3b; font-weight: bold;");
    console.log(`%c 🔍 关键词"${keyword}"匹配的Strong编号 (共 ${finalListArray.length} 个):`, 
        "color: #fff; background: #2c3e50; padding: 4px 8px; border-radius: 4px; font-weight: bold;");
    if (finalListArray.length > 0) {
        console.log("%c" + JSON.stringify(finalListArray.slice(0, 20), null, 2), 
            "color: #2ecc71; background: #1a1a1a; padding: 8px; border-radius: 4px; font-family: monospace; font-size: 12px;");
        if (finalListArray.length > 20) {
            console.log(`  ... 还有 ${finalListArray.length - 20} 个`);
        }
    } else {
        console.warn("⚠️ 没有找到任何匹配的编号！");
    }
    console.log("%c★============================================================★", "color: #ffeb3b; font-weight: bold;");
    
    // 🎯 4. 过滤数据（修复版）
    const cleanGroups = {};
    let filteredCount = 0;
    
    Object.keys(groups).forEach(strongId => {
        const cleanId = strongId.trim().toUpperCase();
        let isValid = false;
        
        // 检查是否在白名单中
        if (dynamicStrongList.has(cleanId)) {
            isValid = true;
        }
        
        // 前缀匹配（处理带后缀的编号）
        if (!isValid) {
            isValid = finalListArray.some(validId => 
                cleanId.startsWith(validId) || validId.startsWith(cleanId)
            );
        }
        
        // 🔥 新增：如果白名单为空，保留所有数据（显示所有内容）
        if (!isValid && finalListArray.length === 0) {
            isValid = true;
            console.log(`⚠️ 白名单为空，保留所有数据: ${cleanId}`);
        }
        
        if (isValid) {
            cleanGroups[strongId] = groups[strongId];
            filteredCount++;
        }
    });
    
    console.log(`📊 过滤后: ${filteredCount} 个编号`);
    
    const sortedKeys = Object.keys(cleanGroups).sort(sortStrongIds);
    
    if (sortedKeys.length === 0) {
        console.warn(`⚠️ 未找到包含"${keyword}"的经文`);
        return `<div class='no-result' style='padding: 30px; text-align: center; color: #999;'>
            <div style='font-size: 20px; margin-bottom: 10px;'>🔍</div>
            <div>未找到字典释义包含「${keyword}」的原文编号经文</div>
            <div style='font-size: 13px; margin-top: 8px; color: #bbb;'>
                提示：尝试使用不同的关键词或检查拼写
            </div>
            <div style='font-size: 12px; margin-top: 15px; color: #ccc;'>
                调试信息：groups中有 ${Object.keys(groups).length} 个编号，字典匹配 ${dynamicStrongList.size} 个
            </div>
        </div>`;
    }
    
    // 🎯 5. 构建HTML（与原版相同，但添加调试信息）
    let html = `<div class='search-results' data-keyword="${safeEscapeHtml(keyword)}">
        <div class='result-summary' style='padding: 10px; margin-bottom: 15px; background: #f8f9fa; border-radius: 6px;'>
            找到 <strong>${sortedKeys.length}</strong> 个原文编号，共 <strong>${Object.values(cleanGroups).reduce((sum, arr) => sum + arr.length, 0)}</strong> 节经文
            <span style='font-size: 12px; color: #999; margin-left: 10px;'>
                (字典匹配: ${dynamicStrongList.size} 个编号)
            </span>
        </div>`;
    
    sortedKeys.forEach(strongId => {
        let verses = cleanGroups[strongId];
        
        // 排序
        verses.sort((a, b) => {
            if (a.book_id !== b.book_id) return a.book_id - b.book_id;
            if (parseInt(a.chapter) !== parseInt(b.chapter)) 
                return parseInt(a.chapter) - parseInt(b.chapter);
            return parseInt(a.verse) - parseInt(b.verse);
        });
        
        const definitionHtml = getLocalStrongsDefinitionHtml(strongId, config);
        const isNewTestament = strongId.trim().toUpperCase().startsWith('G');
        const ntClass = isNewTestament ? 'nt-group' : '';
        
        html += `
            <div class='group-title ${ntClass}' style='display: flex; justify-content: space-between; align-items: center; 
                padding: 10px 15px; background: ${isNewTestament ? '#e8f4f8' : '#f5f0e8'}; 
                border-radius: 6px; margin: 10px 0;'>
                <div>
                    <span style='font-weight: bold; font-size: 16px;'>${safeEscapeHtml(strongId)}</span>
                    ${definitionHtml}
                </div>
                <span class='summary-badge' style='background: #6c757d; color: white; padding: 2px 10px; border-radius: 12px; font-size: 12px;'>
                    ${verses.length} 节
                </span>
            </div>
            <table style='width: 100%; border-collapse: collapse; margin-bottom: 15px;'>
                <thead>
                    <tr style='background: #f1f3f5;'>
                        <th style='width:20%; padding: 8px; text-align: left; border: 1px solid #dee2e6;'>书卷</th>
                        <th style='width:15%; padding: 8px; text-align: left; border: 1px solid #dee2e6;'>章节</th>
                        <th style='padding: 8px; text-align: left; border: 1px solid #dee2e6;'>经文内容</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        verses.forEach(v => {
            const currentDb = isSimplifiedMode ? bibleSimpData : bibleData;
            const originalEntry = currentDb ? currentDb.find(s => 
                parseInt(s.book, 10) === v.book_id && 
                parseInt(s.chapter, 10) === parseInt(v.chapter, 10) && 
                parseInt(s.verse, 10) === parseInt(v.verse, 10)
            ) : null;
            
            let highlightedText = "";
            
            if (originalEntry && originalEntry.text) {
                let rawText = cleanVerseText(originalEntry.text);
                
                // 高亮所有关键词变体
                keywordVariants.forEach(variant => {
                    if (variant && variant.length > 0) {
                        const escapedVariant = variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        rawText = rawText.replace(
                            new RegExp(escapedVariant, 'g'), 
                            `<span style="color: ${config.highlightColor}; font-weight: bold; background: rgba(231, 76, 60, 0.1);">${safeEscapeHtml(variant)}</span>`
                        );
                    }
                });
                highlightedText = rawText;
            } else {
                // 备用方案
                const safeText = safeEscapeHtml(v.text || '');
                let text = cleanVerseText(safeText);
                keywordVariants.forEach(variant => {
                    if (variant && variant.length > 0) {
                        const escapedVariant = variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        text = text.replace(
                            new RegExp(escapedVariant, 'g'), 
                            `<span style="color: ${config.highlightColor}; font-weight: bold;">${safeEscapeHtml(variant)}</span>`
                        );
                    }
                });
                highlightedText = text;
            }
            
            html += `
                <tr>
                    <td style='padding: 8px; border: 1px solid #dee2e6;'>${safeEscapeHtml(v.book_name)}</td>
                    <td style='padding: 8px; border: 1px solid #dee2e6;'>${v.chapter}:${v.verse}</td>
                    <td style='padding: 8px; border: 1px solid #dee2e6; line-height: 1.6;'>${highlightedText}</td>
                </tr>
            `;
        });
        
        html += `</tbody></table>`;
    });
    
    html += `</div>`;
    return html;
}

// ==========================================
// 3. 字典定义HTML生成（通用版）
// ==========================================

function getLocalStrongsDefinitionHtml(strongId, config = {}) {
    const dict = typeof strongsDict !== 'undefined' ? strongsDict : window.strongsDict;
    if (!dict || !dict[strongId]) return "";
    
    const rawText = dict[strongId];
    let lemma = "";
    let content = rawText;
    const maxLen = config.maxDefinitionLength || 200;
    
    // 解析 "词源|释义" 格式
    if (typeof rawText === 'string' && rawText.includes('|')) {
        const pipeIndex = rawText.indexOf('|');
        const firstPart = rawText.substring(0, pipeIndex).trim();
        const secondPart = rawText.substring(pipeIndex + 1).trim();
        
        lemma = `<span class="dict-lemma" style="color: #4a90e2; font-weight: bold; margin-left: 5px;">
            ${safeEscapeHtml(firstPart)}
        </span>`;
        content = secondPart;
    }
    
    let formattedContent = safeEscapeHtml(content).replace(/\n/g, '<br>');
    
    // 截断过长内容
    if (formattedContent.length > maxLen) {
        formattedContent = formattedContent.substring(0, maxLen) + "...";
    }
    
    if (!config.showTooltips) {
        return `<span style="margin-left: 8px; font-size: 13px; color: #666;">${formattedContent}</span>`;
    }
    
    return `
        <div class="strongs-tooltip" style="display: inline-block; margin-left: 8px; position: relative; font-size: 13px;">
            <span class="tooltip-trigger" style="cursor: help; background: #e9ecef; padding: 2px 8px; border-radius: 4px; color: #495057; border: 1px solid #ced4da; font-size: 12px;">
                📖 定义
            </span>
            <div class="tooltip-content" style="display: none; position: absolute; left: 0; top: 28px; 
                background: white; border: 1px solid #dee2e6; padding: 12px; width: 340px; 
                box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 1000; border-radius: 8px; 
                font-weight: normal; color: #212529; text-align: left; line-height: 1.5;">
                <div class="dict-header" style="border-bottom: 2px solid #e9ecef; padding-bottom: 6px; margin-bottom: 6px; 
                    font-weight: bold; color: #000; font-size: 14px;">
                    ${safeEscapeHtml(strongId)} ${lemma}
                </div>
                <div class="dict-body" style="max-height: 250px; overflow-y: auto; font-size: 13px; color: #333;">
                    ${formattedContent}
                </div>
            </div>
        </div>
    `;
}

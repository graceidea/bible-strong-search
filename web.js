// ==========================================
// 核心搜索与构建函数（支持数组和对象）
// ==========================================

function buildSectionsHtml(groups, keyword, isSimplifiedMode, options = {}) {
    console.log(`%c>>> 搜索关键词: "${keyword}" <<<`, "color: #00bcd4; font-weight: bold; font-size: 14px;");
    
    // 🔥 修复：处理 groups 可能是数组的情况
    let groupsObj = groups;
    
    // 如果 groups 是数组，转换为对象格式
    if (Array.isArray(groups)) {
        console.log("📊 groups 是数组，正在转换...");
        groupsObj = {};
        groups.forEach(item => {
            // 假设每个 item 有 strong_id 或 strongId 字段
            const strongId = item.strong_id || item.strongId || item.id || 'unknown';
            if (!groupsObj[strongId]) {
                groupsObj[strongId] = [];
            }
            groupsObj[strongId].push(item);
        });
        console.log("📊 转换后对象键数:", Object.keys(groupsObj).length);
    }
    
    console.log("📊 最终 groups 键数:", Object.keys(groupsObj).length);
    console.log("📊 前3个编号示例:", Object.keys(groupsObj).slice(0, 3));
    
    // 如果 groups 为空，显示错误
    if (Object.keys(groupsObj).length === 0) {
        console.error("❌ groups 为空！");
        return `<div class='error-message' style='padding: 30px; text-align: center; color: #e74c3c;'>
            <div style='font-size: 24px; margin-bottom: 10px;'>⚠️</div>
            <div>没有找到任何经文数据</div>
            <div style='font-size: 13px; margin-top: 8px; color: #999;'>
                请检查数据加载是否完整
            </div>
        </div>`;
    }
    
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
    
    // 🎯 1. 构建动态白名单
    const dynamicStrongList = new Set();
    const keywordVariants = getChineseVariants(keyword);
    
    console.log(`📝 关键词变体:`, keywordVariants);
    
    // 🔥 修复：先尝试从 groups 中提取所有编号
    console.log("🔍 方法1: 从 groups 中提取编号...");
    const allStrongIds = Object.keys(groupsObj);
    console.log(`📊 groups 中有 ${allStrongIds.length} 个唯一编号`);
    
    // 🔥 修复：直接使用 groups 中的所有编号（因为数据已经预过滤了）
    // 但还是要检查字典中是否包含关键词
    let matchedFromDict = 0;
    allStrongIds.forEach(strongId => {
        const cleanId = strongId.trim().toUpperCase();
        const dictText = dict[cleanId] || dict[strongId];
        
        if (dictText && typeof dictText === 'string') {
            const matched = keywordVariants.some(variant => 
                dictText.includes(variant)
            );
            if (matched) {
                dynamicStrongList.add(cleanId);
                matchedFromDict++;
                if (matchedFromDict <= 5) {
                    console.log(`  ✅ 匹配: ${cleanId} -> ${dictText.substring(0, 40)}...`);
                }
            }
        }
    });
    
    console.log(`📊 字典匹配结果: ${matchedFromDict} 个编号`);
    
    // 🔥 修复：如果字典匹配为空，使用所有 groups 中的编号
    if (dynamicStrongList.size === 0) {
        console.warn("⚠️ 字典中未找到匹配，使用所有 groups 中的编号（显示所有数据）");
        allStrongIds.forEach(strongId => {
            const cleanId = strongId.trim().toUpperCase();
            if (/^[GH]/.test(cleanId)) {
                dynamicStrongList.add(cleanId);
            }
        });
        console.log(`📊 从 groups 提取: ${dynamicStrongList.size} 个编号`);
    }
    
    // 🎯 2. 打印匹配列表
    const finalListArray = Array.from(dynamicStrongList).sort(sortStrongIds);
    console.log("%c★============================================================★", "color: #ffeb3b; font-weight: bold;");
    console.log(`%c 🔍 关键词"${keyword}"匹配的Strong编号 (共 ${finalListArray.length} 个):`, 
        "color: #fff; background: #2c3e50; padding: 4px 8px; border-radius: 4px; font-weight: bold;");
    if (finalListArray.length > 0) {
        const displayList = finalListArray.slice(0, 30);
        console.log("%c" + JSON.stringify(displayList, null, 2), 
            "color: #2ecc71; background: #1a1a1a; padding: 8px; border-radius: 4px; font-family: monospace; font-size: 12px;");
        if (finalListArray.length > 30) {
            console.log(`  ... 还有 ${finalListArray.length - 30} 个`);
        }
    } else {
        console.warn("⚠️ 没有找到任何匹配的编号！");
    }
    console.log("%c★============================================================★", "color: #ffeb3b; font-weight: bold;");
    
    // 🎯 3. 过滤数据
    const cleanGroups = {};
    let filteredCount = 0;
    
    allStrongIds.forEach(strongId => {
        const cleanId = strongId.trim().toUpperCase();
        let isValid = false;
        
        // 检查是否在白名单中
        if (dynamicStrongList.has(cleanId)) {
            isValid = true;
        }
        
        // 前缀匹配
        if (!isValid) {
            isValid = finalListArray.some(validId => 
                cleanId.startsWith(validId) || validId.startsWith(cleanId)
            );
        }
        
        // 🔥 如果白名单为空，保留所有
        if (!isValid && finalListArray.length === 0) {
            isValid = true;
        }
        
        if (isValid) {
            cleanGroups[strongId] = groupsObj[strongId];
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
                调试信息：groups中有 ${allStrongIds.length} 个编号，字典匹配 ${dynamicStrongList.size} 个
            </div>
        </div>`;
    }
    
    // 🎯 4. 构建HTML
    let html = `<div class='search-results' data-keyword="${safeEscapeHtml(keyword)}">
        <div class='result-summary' style='padding: 10px; margin-bottom: 15px; background: #f8f9fa; border-radius: 6px; border-left: 4px solid #3498db;'>
            <strong>搜索结果</strong>：找到 <strong>${sortedKeys.length}</strong> 个原文编号，共 <strong>${Object.values(cleanGroups).reduce((sum, arr) => sum + arr.length, 0)}</strong> 节经文
            <span style='font-size: 12px; color: #999; margin-left: 10px;'>
                (字典匹配: ${dynamicStrongList.size} 个编号)
            </span>
        </div>`;
    
    sortedKeys.forEach(strongId => {
        let verses = cleanGroups[strongId];
        
        // 确保 verses 是数组
        if (!Array.isArray(verses)) {
            verses = [verses];
        }
        
        // 排序
        verses.sort((a, b) => {
            if (a.book_id !== b.book_id) return a.book_id - b.book_id;
            if (parseInt(a.chapter) !== parseInt(b.chapter)) 
                return parseInt(a.chapter) - parseInt(b.chapter);
            return parseInt(a.verse) - parseInt(b.verse);
        });
        
        const definitionHtml = getLocalStrongsDefinitionHtml(strongId, config);
        const isNewTestament = strongId.trim().toUpperCase().startsWith('G');
        
        html += `
            <div class='group-title' style='display: flex; justify-content: space-between; align-items: center; 
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

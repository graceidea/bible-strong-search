/**
 * 斯特朗经文搜索构建器
 * 策略：先建立Strong编号索引，再用索引检索经文
 */

class StrongSearchBuilder {
    // ========== 静态配置 ==========
    static DEFAULT_CONFIG = {
        maxDefinitionLength: 200,
        highlightColor: '#e74c3c',
        showTooltips: true,
        debugMode: false,
        bookMap: typeof BOOK_MAP !== 'undefined' ? BOOK_MAP : {}
    };

    // ========== 单例模式 ==========
    static getInstance(options = {}) {
        if (!StrongSearchBuilder._instance) {
            StrongSearchBuilder._instance = new StrongSearchBuilder(options);
        }
        return StrongSearchBuilder._instance;
    }

    // ========== 构造函数 ==========
    constructor(options = {}) {
        // 数据源
        this.bibleData = options.bibleData || (typeof bibleData !== 'undefined' ? bibleData : []);
        this.bibleSimpData = options.bibleSimpData || (typeof bibleSimpData !== 'undefined' ? bibleSimpData : []);
        this.strongsDict = options.strongsDict || (typeof strongsDict !== 'undefined' ? strongsDict : {});
        this.bookMap = options.bookMap || (typeof BOOK_MAP !== 'undefined' ? BOOK_MAP : {});
        
        // 配置
        this.config = {
            ...StrongSearchBuilder.DEFAULT_CONFIG,
            ...options
        };
        
        // 🔥 核心数据结构：Strong编号索引缓存
        this._strongIndexCache = new Map();  // key: 关键词, value: Set(Strong编号)
        this._verseCache = new Map();        // key: Strong编号, value: 经文数组
        
        this._validateDependencies();
    }

    // ==========================================
    // 公共API
    // ==========================================

    /**
     * 主入口：构建搜索结果的HTML
     * 策略：先建索引，再检索
     */
    buildSectionsHtml(groups, keyword, isSimplifiedMode = false, options = {}) {
        const startTime = performance.now();
        const mergedConfig = { ...this.config, ...options };
        
        try {
            // 🔥 步骤1: 建立"关键词"的Strong编号索引
            const strongIndex = this._buildStrongIndex(keyword);
            
            if (this.config.debugMode) {
                console.log(`📊 关键词"${keyword}"的Strong索引:`, Array.from(strongIndex));
                console.log(`📊 索引大小: ${strongIndex.size} 个编号`);
            }
            
            // 如果没有匹配的Strong编号，返回空结果
            if (strongIndex.size === 0) {
                return this._buildNoResultHtml(keyword, {}, strongIndex);
            }
            
            // 🔥 步骤2: 标准化groups数据
            const normalizedGroups = this._normalizeGroups(groups);
            if (this._isEmpty(normalizedGroups)) {
                return this._buildEmptyResultHtml();
            }
            
            // 🔥 步骤3: 用索引过滤经文
            const filteredGroups = this._filterGroupsByIndex(normalizedGroups, strongIndex);
            
            if (this._isEmpty(filteredGroups)) {
                return this._buildNoResultHtml(keyword, normalizedGroups, strongIndex);
            }
            
            // 🔥 步骤4: 构建HTML
            const result = this._buildResultsHtml(
                filteredGroups, 
                keyword, 
                strongIndex,
                mergedConfig, 
                isSimplifiedMode
            );

            if (mergedConfig.debugMode) {
                const duration = (performance.now() - startTime).toFixed(2);
                console.log(`⏱️ 搜索构建耗时: ${duration}ms`);
            }

            return result;

        } catch (error) {
            console.error('❌ 构建搜索结果失败:', error);
            return this._buildErrorHtml(error.message);
        }
    }

    /**
     * 🔥 核心方法：建立关键词的Strong编号索引
     * 返回: Set 包含所有匹配的Strong编号
     */
    _buildStrongIndex(keyword) {
        // 检查缓存
        const cacheKey = keyword;
        if (this._strongIndexCache.has(cacheKey)) {
            if (this.config.debugMode) {
                console.log(`✅ 使用缓存的索引: "${keyword}"`);
            }
            return this._strongIndexCache.get(cacheKey);
        }

        const index = new Set();
        const keywordVariants = this._getChineseVariants(keyword);
        
        if (this.config.debugMode) {
            console.log(`🔍 建立索引: "${keyword}" 变体:`, keywordVariants);
        }

        // 🔥 遍历所有Strong编号，检查字典释义
        const allStrongIds = Object.keys(this.strongsDict);
        let matchedCount = 0;
        
        allStrongIds.forEach(strongId => {
            const dictText = this.strongsDict[strongId];
            if (dictText && typeof dictText === 'string') {
                // 检查字典释义是否包含任何关键词变体
                const matched = keywordVariants.some(variant => 
                    dictText.includes(variant)
                );
                if (matched) {
                    const cleanId = strongId.trim().toUpperCase();
                    index.add(cleanId);
                    matchedCount++;
                    
                    if (this.config.debugMode && matchedCount <= 10) {
                        console.log(`  ✅ 匹配: ${cleanId} -> ${dictText.substring(0, 50)}...`);
                    }
                }
            }
        });

        if (this.config.debugMode) {
            console.log(`📊 索引建立完成: 找到 ${index.size} 个匹配的Strong编号`);
        }

        // 缓存结果
        this._strongIndexCache.set(cacheKey, index);
        return index;
    }

    /**
     * 🔥 核心方法：用索引过滤经文
     * 只保留包含索引中Strong编号的经文
     */
    _filterGroupsByIndex(groups, strongIndex) {
        const result = {};
        const indexArray = Array.from(strongIndex);
        
        if (this.config.debugMode) {
            console.log(`🔍 用索引过滤经文，索引大小: ${indexArray.length}`);
        }

        Object.keys(groups).forEach(strongId => {
            const cleanId = strongId.trim().toUpperCase();
            
            // 检查这个Strong编号是否在索引中
            if (strongIndex.has(cleanId)) {
                result[strongId] = groups[strongId];
            }
        });

        if (this.config.debugMode) {
            console.log(`📊 过滤后: ${Object.keys(result).length} 个编号的经文`);
        }

        return result;
    }

    /**
     * 获取Strong编号索引（供外部使用）
     */
    getStrongIndex(keyword) {
        return this._buildStrongIndex(keyword);
    }

    /**
     * 获取搜索统计信息
     */
    getSearchStats(groups, keyword) {
        const strongIndex = this._buildStrongIndex(keyword);
        const normalizedGroups = this._normalizeGroups(groups);
        const filtered = this._filterGroupsByIndex(normalizedGroups, strongIndex);
        
        return {
            keyword: keyword,
            strongIndexSize: strongIndex.size,
            strongIndexList: Array.from(strongIndex),
            totalGroups: Object.keys(normalizedGroups).length,
            filteredGroups: Object.keys(filtered).length,
            totalVerses: Object.values(filtered).reduce((sum, arr) => sum + arr.length, 0)
        };
    }

    // ==========================================
    // 私有辅助方法
    // ==========================================

    _validateDependencies() {
        if (!this.strongsDict || Object.keys(this.strongsDict).length === 0) {
            console.warn('⚠️ strongsDict 未加载或为空');
        }
        if (!this.bibleData || this.bibleData.length === 0) {
            console.warn('⚠️ bibleData 未加载或为空');
        }
    }

    _normalizeGroups(groups) {
        if (!groups) return {};
        if (!Array.isArray(groups)) {
            return { ...groups };
        }
        
        const result = {};
        groups.forEach(item => {
            const strongId = item.strong_id || item.strongId || item.id;
            if (strongId && strongId !== 'unknown') {
                if (!result[strongId]) {
                    result[strongId] = [];
                }
                result[strongId].push(item);
            }
        });
        return result;
    }

    _isEmpty(obj) {
        return !obj || Object.keys(obj).length === 0;
    }

    _getChineseVariants(keyword) {
        if (!keyword) return [];
        const variants = [keyword];
        
        // 简繁转换映射（可扩展）
        const traditionalMap = {
            '爱': '愛',
            '神': '神',
            '信': '信',
            '望': '望',
            '义': '義',
            '约': '約',
            '经': '經',
            '书': '書',
            '灵': '靈',
            '圣': '聖'
        };
        
        if (traditionalMap[keyword]) {
            variants.push(traditionalMap[keyword]);
        }
        
        const simplifiedMap = Object.fromEntries(
            Object.entries(traditionalMap).map(([k, v]) => [v, k])
        );
        if (simplifiedMap[keyword]) {
            variants.push(simplifiedMap[keyword]);
        }
        
        return [...new Set(variants.filter(v => v && v.length > 0))];
    }

    _sortStrongIds(a, b) {
        if (typeof sortStrongIds === 'function') {
            return sortStrongIds(a, b);
        }
        let aType = a.charAt(0);
        let bType = b.charAt(0);
        if (aType !== bType) return aType.localeCompare(bType);
        let aNum = parseInt(a.substring(1)) || 0;
        let bNum = parseInt(b.substring(1)) || 0;
        return aNum - bNum;
    }

    _escapeHtml(str) {
        if (!str) return str;
        if (typeof escapeHtml === 'function') {
            return escapeHtml(str);
        }
        return String(str).replace(/[&<>"']/g, s => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[s]);
    }

    _cleanVerseText(text) {
        if (!text) return '';
        let cleaned = typeof cleanStrongs === 'function' ? cleanStrongs(text) : text;
        return cleaned.replace(/\s+/g, ' ').trim();
    }

    _getBookName(bookId) {
        return this.bookMap[bookId] || `卷${bookId}`;
    }

    // ==========================================
    // HTML构建方法
    // ==========================================

    _buildResultsHtml(groups, keyword, strongIndex, config, isSimplifiedMode) {
        const sortedKeys = Object.keys(groups).sort(this._sortStrongIds.bind(this));
        const totalVerses = Object.values(groups).reduce((sum, arr) => sum + arr.length, 0);
        
        let html = `<div class='search-results' data-keyword="${this._escapeHtml(keyword)}">
            <div class='result-summary' style='padding: 12px 16px; margin-bottom: 15px; 
                background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); 
                border-radius: 8px; border-left: 4px solid #3498db;'>
                <div style='display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap;'>
                    <div>
                        <strong style='font-size: 16px;'>🔍 搜索结果</strong>
                        <span style='margin-left: 10px;'>
                            找到 <strong style='color: #2ecc71;'>${sortedKeys.length}</strong> 个原文编号，
                            共 <strong style='color: #2ecc71;'>${totalVerses}</strong> 节经文
                        </span>
                    </div>
                    <div style='font-size: 12px; color: #6c757d;'>
                        <span style='background: #e8f4f8; padding: 2px 10px; border-radius: 12px;'>
                            📚 索引: ${strongIndex.size} 个编号
                        </span>
                    </div>
                </div>
                ${this.config.debugMode ? `<div style='font-size: 11px; color: #999; margin-top: 5px;'>
                    索引编号: ${Array.from(strongIndex).slice(0, 10).join(', ')}${strongIndex.size > 10 ? ` ... 还有 ${strongIndex.size - 10} 个` : ''}
                </div>` : ''}
            </div>`;
        
        sortedKeys.forEach(strongId => {
            const verses = this._normalizeVerses(groups[strongId]);
            html += this._buildStrongGroupHtml(strongId, verses, keyword, config, isSimplifiedMode);
        });
        
        html += `</div>`;
        return html;
    }

    _normalizeVerses(verses) {
        if (!Array.isArray(verses)) return [verses];
        return verses.sort((a, b) => {
            if (a.book_id !== b.book_id) return a.book_id - b.book_id;
            if (parseInt(a.chapter) !== parseInt(b.chapter)) 
                return parseInt(a.chapter) - parseInt(b.chapter);
            return parseInt(a.verse) - parseInt(b.verse);
        });
    }

    _buildStrongGroupHtml(strongId, verses, keyword, config, isSimplifiedMode) {
        const definitionHtml = this._getStrongsDefinitionHtml(strongId, config);
        const isNewTestament = strongId.trim().toUpperCase().startsWith('G');
        
        let html = `
            <div class='group-title' style='display: flex; justify-content: space-between; 
                align-items: center; padding: 10px 15px; 
                background: ${isNewTestament ? '#e8f4f8' : '#f5f0e8'}; 
                border-radius: 6px; margin: 10px 0;'>
                <div>
                    <span style='font-weight: bold; font-size: 18px; color: #2c3e50;'>${this._escapeHtml(strongId)}</span>
                    ${definitionHtml}
                </div>
                <span class='summary-badge' style='background: #6c757d; color: white; 
                    padding: 2px 12px; border-radius: 12px; font-size: 12px;'>
                    ${verses.length} 节
                </span>
            </div>
            <table style='width: 100%; border-collapse: collapse; margin-bottom: 15px;'>
                <thead>
                    <tr style='background: #f1f3f5;'>
                        <th style='width:20%; padding: 8px; text-align: left; border: 1px solid #dee2e6;'>书卷</th>
                        <th style='width:12%; padding: 8px; text-align: left; border: 1px solid #dee2e6;'>章节</th>
                        <th style='padding: 8px; text-align: left; border: 1px solid #dee2e6;'>经文内容</th>
                    </tr>
                </thead>
                <tbody>
        `;

        verses.forEach(v => {
            html += this._buildVerseRowHtml(v, keyword, config, isSimplifiedMode);
        });

        html += `</tbody></table>`;
        return html;
    }

    _buildVerseRowHtml(verse, keyword, config, isSimplifiedMode) {
        const currentDb = isSimplifiedMode ? this.bibleSimpData : this.bibleData;
        const originalEntry = currentDb?.find(s => 
            parseInt(s.book, 10) === verse.book_id && 
            parseInt(s.chapter, 10) === parseInt(verse.chapter, 10) && 
            parseInt(s.verse, 10) === parseInt(verse.verse, 10)
        );
        
        let text = originalEntry?.text || verse.text || '';
        const cleanedText = this._cleanVerseText(text);
        const highlightedText = this._highlightKeyword(cleanedText, keyword, config);
        
        const bookName = this._getBookName(verse.book_id);
        
        return `
            <tr>
                <td style='padding: 8px; border: 1px solid #dee2e6;'>${this._escapeHtml(bookName)}</td>
                <td style='padding: 8px; border: 1px solid #dee2e6;'>${verse.chapter}:${verse.verse}</td>
                <td style='padding: 8px; border: 1px solid #dee2e6; line-height: 1.7;'>${highlightedText}</td>
            </tr>
        `;
    }

    _highlightKeyword(text, keyword, config) {
        if (!keyword || !text) return text;
        
        const variants = this._getChineseVariants(keyword);
        const pattern = variants
            .filter(v => v && v.length > 0)
            .map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            .join('|');
        
        if (!pattern) return text;
        
        const regex = new RegExp(pattern, 'g');
        return text.replace(regex, match => 
            `<span style="color: ${config.highlightColor}; font-weight: bold; 
                background: rgba(231, 76, 60, 0.12); padding: 1px 4px; border-radius: 3px;">${this._escapeHtml(match)}</span>`
        );
    }

    _getStrongsDefinitionHtml(strongId, config) {
        const dictText = this.strongsDict?.[strongId] || this.strongsDict?.[strongId.trim().toUpperCase()];
        if (!dictText) return '';
        
        const truncated = dictText.length > config.maxDefinitionLength 
            ? dictText.substring(0, config.maxDefinitionLength) + '...' 
            : dictText;
        
        return `<span style='font-size: 13px; color: #555; margin-left: 10px;'>${this._escapeHtml(truncated)}</span>`;
    }

    _buildNoResultHtml(keyword, groups, strongIndex) {
        return `<div class='no-result' style='padding: 40px 20px; text-align: center;'>
            <div style='font-size: 48px; margin-bottom: 15px;'>🔍</div>
            <div style='font-size: 18px; color: #333; margin-bottom: 8px;'>
                未找到字典释义包含「<strong>${this._escapeHtml(keyword)}</strong>」的原文编号
            </div>
            <div style='font-size: 14px; color: #999;'>
                提示：尝试使用不同的关键词或检查拼写
            </div>
            <div style='font-size: 12px; margin-top: 15px; color: #ccc;'>
                字典中已检查 ${Object.keys(this.strongsDict).length} 个编号，匹配 ${strongIndex.size} 个
            </div>
        </div>`;
    }

    _buildEmptyResultHtml() {
        return `<div class='error-message' style='padding: 30px; text-align: center; color: #e74c3c;'>
            <div style='font-size: 24px; margin-bottom: 10px;'>⚠️</div>
            <div>没有找到任何经文数据</div>
        </div>`;
    }

    _buildErrorHtml(errorMessage) {
        return `<div class='error-message' style='padding: 20px; text-align: center; color: #e74c3c;'>
            <div>搜索出现错误：${this._escapeHtml(errorMessage)}</div>
        </div>`;
    }
}

// ========== 导出 ==========
if (typeof window !== 'undefined') {
    window.StrongSearchBuilder = StrongSearchBuilder;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StrongSearchBuilder;
}

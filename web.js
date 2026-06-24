/**
 * 斯特朗经文搜索构建器
 * 替代原有的 buildSectionsHtml 函数
 * 
 * 依赖：需要全局变量 bibleData, bibleSimpData, strongsDict
 */

class StrongSearchBuilder {
    // ========== 静态配置 ==========
    static DEFAULT_CONFIG = {
        maxDefinitionLength: 200,
        highlightColor: '#e74c3c',
        showTooltips: true,
        debugMode: false,
        // 书卷映射（从全局 BOOK_MAP 获取）
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
        // 数据源 - 优先使用传入的，否则使用全局
        this.bibleData = options.bibleData || (typeof bibleData !== 'undefined' ? bibleData : []);
        this.bibleSimpData = options.bibleSimpData || (typeof bibleSimpData !== 'undefined' ? bibleSimpData : []);
        this.strongsDict = options.strongsDict || (typeof strongsDict !== 'undefined' ? strongsDict : {});
        this.bookMap = options.bookMap || (typeof BOOK_MAP !== 'undefined' ? BOOK_MAP : {});
        
        // 配置
        this.config = {
            ...StrongSearchBuilder.DEFAULT_CONFIG,
            ...options
        };
        
        // 缓存
        this._cache = new Map();
        
        // 验证依赖
        this._validateDependencies();
    }

    // ========== 公共API ==========
    
    /**
     * 构建搜索结果的HTML（主入口）
     * 完全兼容原有的 buildSectionsHtml 函数签名
     */
    buildSectionsHtml(groups, keyword, isSimplifiedMode = false, options = {}) {
        const startTime = performance.now();
        const mergedConfig = { ...this.config, ...options };
        
        try {
            // 1. 数据标准化
            const normalizedGroups = this._normalizeGroups(groups);
            if (this._isEmpty(normalizedGroups)) {
                return this._buildEmptyResultHtml();
            }

            // 2. 构建白名单
            const whitelist = this._buildWhitelist(normalizedGroups, keyword);
            
            // 3. 过滤数据
            const filteredGroups = this._filterGroups(normalizedGroups, whitelist);
            
            // 4. 构建HTML
            if (this._isEmpty(filteredGroups)) {
                return this._buildNoResultHtml(keyword, normalizedGroups, whitelist);
            }

            const result = this._buildResultsHtml(
                filteredGroups, 
                keyword, 
                mergedConfig, 
                isSimplifiedMode
            );

            // 性能日志
            if (mergedConfig.debugMode) {
                const duration = (performance.now() - startTime).toFixed(2);
                console.log(`⏱️ 搜索构建耗时: ${duration}ms`);
                console.log(`📊 结果统计:`, this.getSearchStats(groups, keyword));
            }

            return result;

        } catch (error) {
            console.error('❌ 构建搜索结果失败:', error);
            return this._buildErrorHtml(error.message);
        }
    }

    /**
     * 获取搜索统计信息
     */
    getSearchStats(groups, keyword) {
        const normalizedGroups = this._normalizeGroups(groups);
        const whitelist = this._buildWhitelist(normalizedGroups, keyword);
        const filtered = this._filterGroups(normalizedGroups, whitelist);
        
        return {
            totalGroups: Object.keys(normalizedGroups).length,
            whitelistSize: whitelist.size,
            filteredGroups: Object.keys(filtered).length,
            totalVerses: Object.values(filtered).reduce((sum, arr) => sum + arr.length, 0),
            keywordVariants: this._getChineseVariants(keyword)
        };
    }

    /**
     * 更新配置
     */
    updateConfig(options) {
        this.config = { ...this.config, ...options };
        this._cache.clear();
        return this;
    }

    /**
     * 清除缓存
     */
    clearCache() {
        this._cache.clear();
        return this;
    }

    /**
     * 销毁实例
     */
    destroy() {
        this._cache.clear();
        if (StrongSearchBuilder._instance === this) {
            StrongSearchBuilder._instance = null;
        }
    }

    // ========== 私有方法 ==========

    /**
     * 验证依赖
     */
    _validateDependencies() {
        if (!this.strongsDict || Object.keys(this.strongsDict).length === 0) {
            console.warn('⚠️ strongsDict 未加载或为空');
        }
        if (!this.bibleData || this.bibleData.length === 0) {
            console.warn('⚠️ bibleData 未加载或为空');
        }
        if (!this.bookMap || Object.keys(this.bookMap).length === 0) {
            console.warn('⚠️ BOOK_MAP 未加载');
        }
    }

    /**
     * 标准化groups数据
     */
    _normalizeGroups(groups) {
        if (!groups) return {};
        
        // 如果已经是对象，返回副本
        if (!Array.isArray(groups)) {
            return { ...groups };
        }
        
        // 数组转对象
        if (this.config.debugMode) {
            console.log('📊 groups 是数组，正在转换...');
        }
        
        const result = {};
        groups.forEach(item => {
            // 支持多种字段名
            const strongId = item.strong_id || item.strongId || item.id;
            if (strongId && strongId !== 'unknown' && strongId !== 'undefined') {
                if (!result[strongId]) {
                    result[strongId] = [];
                }
                result[strongId].push(item);
            }
        });
        
        if (this.config.debugMode) {
            console.log(`📊 转换后得到 ${Object.keys(result).length} 个分组`);
        }
        
        return result;
    }

    /**
     * 检查对象是否为空
     */
    _isEmpty(obj) {
        return !obj || Object.keys(obj).length === 0;
    }

    /**
     * 构建Strong编号白名单
     */
    _buildWhitelist(groups, keyword) {
        // 检查缓存
        const cacheKey = `whitelist_${keyword}`;
        if (this._cache.has(cacheKey)) {
            if (this.config.debugMode) {
                console.log('✅ 使用缓存的白名单');
            }
            return this._cache.get(cacheKey);
        }

        const whitelist = new Set();
        const keywordVariants = this._getChineseVariants(keyword);
        const allStrongIds = Object.keys(groups);
        
        if (this.config.debugMode) {
            console.log(`📝 关键词变体:`, keywordVariants);
            console.log(`📊 groups 中有 ${allStrongIds.length} 个唯一编号`);
        }

        // 从字典匹配
        let matchedCount = 0;
        allStrongIds.forEach(strongId => {
            const cleanId = strongId.trim().toUpperCase();
            const dictText = this.strongsDict?.[cleanId] || this.strongsDict?.[strongId];
            
            if (dictText && typeof dictText === 'string') {
                const matched = keywordVariants.some(variant => 
                    dictText.includes(variant)
                );
                if (matched) {
                    whitelist.add(cleanId);
                    matchedCount++;
                    if (this.config.debugMode && matchedCount <= 5) {
                        console.log(`  ✅ 匹配: ${cleanId} -> ${dictText.substring(0, 40)}...`);
                    }
                }
            }
        });

        if (this.config.debugMode) {
            console.log(`📊 字典匹配结果: ${matchedCount} 个编号`);
        }

        // 如果没有匹配，返回所有编号（降级策略 - 显示所有数据）
        if (whitelist.size === 0) {
            if (this.config.debugMode) {
                console.warn('⚠️ 字典中未找到匹配，使用所有 groups 中的编号（显示所有数据）');
            }
            allStrongIds.forEach(strongId => {
                const cleanId = strongId.trim().toUpperCase();
                if (/^[GH]/.test(cleanId)) {
                    whitelist.add(cleanId);
                }
            });
        }

        // 打印匹配列表
        const finalListArray = Array.from(whitelist).sort(this._sortStrongIds.bind(this));
        if (this.config.debugMode && finalListArray.length > 0) {
            console.log('%c★============================================================★', 'color: #ffeb3b; font-weight: bold;');
            console.log(`%c 🔍 关键词"${keyword}"匹配的Strong编号 (共 ${finalListArray.length} 个):`, 
                'color: #fff; background: #2c3e50; padding: 4px 8px; border-radius: 4px; font-weight: bold;');
            const displayList = finalListArray.slice(0, 30);
            console.log('%c' + JSON.stringify(displayList, null, 2), 
                'color: #2ecc71; background: #1a1a1a; padding: 8px; border-radius: 4px; font-family: monospace; font-size: 12px;');
            if (finalListArray.length > 30) {
                console.log(`  ... 还有 ${finalListArray.length - 30} 个`);
            }
            console.log('%c★============================================================★', 'color: #ffeb3b; font-weight: bold;');
        }

        // 缓存结果
        this._cache.set(cacheKey, whitelist);
        return whitelist;
    }

    /**
     * 获取中文变体
     * 扩展自原有的 getChineseVariants 逻辑
     */
    _getChineseVariants(keyword) {
        if (!keyword) return [];
        
        const variants = [keyword];
        
        // 简化/繁体转换（基础版）
        // 你可以在这里扩展更多的变体
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
        
        // 添加繁体版本
        if (traditionalMap[keyword]) {
            variants.push(traditionalMap[keyword]);
        }
        
        // 如果是繁体，添加简体
        const simplifiedMap = Object.fromEntries(
            Object.entries(traditionalMap).map(([k, v]) => [v, k])
        );
        if (simplifiedMap[keyword]) {
            variants.push(simplifiedMap[keyword]);
        }
        
        // 去除重复和空值
        return [...new Set(variants.filter(v => v && v.length > 0))];
    }

    /**
     * 根据白名单过滤groups
     */
    _filterGroups(groups, whitelist) {
        const result = {};
        const finalList = Array.from(whitelist).sort(this._sortStrongIds.bind(this));
        let filteredCount = 0;
        
        Object.keys(groups).forEach(strongId => {
            const cleanId = strongId.trim().toUpperCase();
            let isValid = whitelist.has(cleanId);
            
            // 前缀匹配
            if (!isValid) {
                isValid = finalList.some(validId => 
                    cleanId.startsWith(validId) || validId.startsWith(cleanId)
                );
            }
            
            // 如果白名单为空，保留所有
            if (!isValid && finalList.length === 0) {
                isValid = true;
            }
            
            if (isValid) {
                result[strongId] = groups[strongId];
                filteredCount++;
            }
        });
        
        if (this.config.debugMode) {
            console.log(`📊 过滤后: ${filteredCount} 个编号`);
        }
        
        return result;
    }

    /**
     * 排序Strong编号（使用全局的 sortStrongIds）
     */
    _sortStrongIds(a, b) {
        // 优先使用全局函数，保持一致性
        if (typeof sortStrongIds === 'function') {
            return sortStrongIds(a, b);
        }
        
        // 备用实现
        let aType = a.charAt(0);
        let bType = b.charAt(0);
        if (aType !== bType) return aType.localeCompare(bType);
        let aNum = parseInt(a.substring(1)) || 0;
        let bNum = parseInt(b.substring(1)) || 0;
        return aNum - bNum;
    }

    /**
     * HTML转义（使用全局的 escapeHtml）
     */
    _escapeHtml(str) {
        if (!str) return str;
        // 优先使用全局函数
        if (typeof escapeHtml === 'function') {
            return escapeHtml(str);
        }
        // 备用实现
        return String(str).replace(/[&<>"']/g, s => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[s]));
    }

    /**
     * 清理经文文本（使用全局的 cleanStrongs）
     */
    _cleanVerseText(text) {
        if (!text) return '';
        // 优先使用全局函数
        let cleaned = typeof cleanStrongs === 'function' ? cleanStrongs(text) : text;
        // 额外清理
        return cleaned.replace(/\s+/g, ' ').trim();
    }

    /**
     * 获取书卷名
     */
    _getBookName(bookId) {
        return this.bookMap[bookId] || `卷${bookId}`;
    }

    /**
     * 构建结果HTML
     */
    _buildResultsHtml(groups, keyword, config, isSimplifiedMode) {
        const sortedKeys = Object.keys(groups).sort(this._sortStrongIds.bind(this));
        const totalVerses = Object.values(groups).reduce((sum, arr) => sum + arr.length, 0);
        
        let html = `<div class='search-results' data-keyword="${this._escapeHtml(keyword)}">
            <div class='result-summary' style='padding: 10px; margin-bottom: 15px; background: #f8f9fa; border-radius: 6px; border-left: 4px solid #3498db;'>
                <strong>搜索结果</strong>：找到 <strong>${sortedKeys.length}</strong> 个原文编号，共 <strong>${totalVerses}</strong> 节经文
                <span style='font-size: 12px; color: #999; margin-left: 10px;'>
                    (字典匹配: ${this._buildWhitelist(groups, keyword).size} 个编号)
                </span>
            </div>`;
        
        sortedKeys.forEach(strongId => {
            const verses = this._normalizeVerses(groups[strongId]);
            html += this._buildStrongGroupHtml(strongId, verses, keyword, config, isSimplifiedMode);
        });
        
        html += `</div>`;
        return html;
    }

    /**
     * 规范化经文数据
     */
    _normalizeVerses(verses) {
        if (!Array.isArray(verses)) return [verses];
        
        return verses.sort((a, b) => {
            if (a.book_id !== b.book_id) return a.book_id - b.book_id;
            if (parseInt(a.chapter) !== parseInt(b.chapter)) 
                return parseInt(a.chapter) - parseInt(b.chapter);
            return parseInt(a.verse) - parseInt(b.verse);
        });
    }

    /**
     * 构建单个Strong组的HTML
     */
    _buildStrongGroupHtml(strongId, verses, keyword, config, isSimplifiedMode) {
        const definitionHtml = this._getStrongsDefinitionHtml(strongId, config);
        const isNewTestament = strongId.trim().toUpperCase().startsWith('G');
        
        let html = `
            <div class='group-title' style='display: flex; justify-content: space-between; 
                align-items: center; padding: 10px 15px; 
                background: ${isNewTestament ? '#e8f4f8' : '#f5f0e8'}; 
                border-radius: 6px; margin: 10px 0;'>
                <div>
                    <span style='font-weight: bold; font-size: 16px;'>${this._escapeHtml(strongId)}</span>
                    ${definitionHtml}
                </div>
                <span class='summary-badge' style='background: #6c757d; color: white; 
                    padding: 2px 10px; border-radius: 12px; font-size: 12px;'>
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
            html += this._buildVerseRowHtml(v, keyword, config, isSimplifiedMode);
        });

        html += `</tbody></table>`;
        return html;
    }

    /**
     * 构建单节经文的HTML行
     */
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
                <td style='padding: 8px; border: 1px solid #dee2e6; line-height: 1.6;'>${highlightedText}</td>
            </tr>
        `;
    }

    /**
     * 高亮关键词
     */
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
                background: rgba(231, 76, 60, 0.1);">${this._escapeHtml(match)}</span>`
        );
    }

    /**
     * 获取Strong编号定义HTML
     */
    _getStrongsDefinitionHtml(strongId, config) {
        const dictText = this.strongsDict?.[strongId] || this.strongsDict?.[strongId.trim().toUpperCase()];
        if (!dictText) return '';
        
        const truncated = dictText.length > config.maxDefinitionLength 
            ? dictText.substring(0, config.maxDefinitionLength) + '...' 
            : dictText;
        
        return `<span style='font-size: 13px; color: #555; margin-left: 10px;'>${this._escapeHtml(truncated)}</span>`;
    }

    /**
     * 构建空结果HTML
     */
    _buildNoResultHtml(keyword, groups, whitelist) {
        return `<div class='no-result' style='padding: 30px; text-align: center; color: #999;'>
            <div style='font-size: 20px; margin-bottom: 10px;'>🔍</div>
            <div>未找到字典释义包含「${this._escapeHtml(keyword)}」的原文编号经文</div>
            <div style='font-size: 13px; margin-top: 8px; color: #bbb;'>
                提示：尝试使用不同的关键词或检查拼写
            </div>
            <div style='font-size: 12px; margin-top: 15px; color: #ccc;'>
                调试信息：groups中有 ${Object.keys(groups).length} 个编号，字典匹配 ${whitelist.size} 个
            </div>
        </div>`;
    }

    /**
     * 构建空数据HTML
     */
    _buildEmptyResultHtml() {
        return `<div class='error-message' style='padding: 30px; text-align: center; color: #e74c3c;'>
            <div style='font-size: 24px; margin-bottom: 10px;'>⚠️</div>
            <div>没有找到任何经文数据</div>
            <div style='font-size: 13px; margin-top: 8px; color: #999;'>
                请检查数据加载是否完整
            </div>
        </div>`;
    }

    /**
     * 构建错误HTML
     */
    _buildErrorHtml(errorMessage) {
        return `<div class='error-message' style='padding: 20px; text-align: center; color: red;'>
            <div>搜索出现错误：${this._escapeHtml(errorMessage)}</div>
            <div style='font-size: 13px; margin-top: 8px; color: #999;'>请刷新页面重试</div>
        </div>`;
    }
}

// ========== 导出 ==========

// 浏览器环境 - 挂载到window
if (typeof window !== 'undefined') {
    window.StrongSearchBuilder = StrongSearchBuilder;
}

// Node.js环境
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StrongSearchBuilder;
}

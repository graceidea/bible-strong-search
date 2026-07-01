// ==========================================
// 1. 全域資料容器宣告
// ==========================================
let bibleData = [];      // 繁體聖經庫
let bibleSimpData = [];  // 簡體聖經庫
let strongsDict = {};    // 原文辭典

// ==========================================
// 2. 聖經 66 卷書名對照表
// ==========================================
const BOOK_MAP = {
    1: "創世記", 2: "出埃及記", 3: "利未記", 4: "民數記", 5: "申命記", 6: "約書亞記", 7: "士師記", 8: "路得記", 9: "撒母耳記上", 10: "撒母耳記下", 11: "列王紀上", 12: "列王紀下", 13: "歷代志上", 14: "歷代志下", 15: "以斯拉記", 16: "尼希米記", 17: "以斯帖記", 18: "約伯記", 19: "詩篇", 20: "箴言", 21: "傳道書", 22: "雅歌", 23: "以賽亞書", 24: "耶利米書", 25: "耶利米哀歌", 26: "以西結書", 27: "但以理書", 28: "何西阿書", 29: "約珥書", 30: "阿摩司書", 31: "俄巴底亞書", 32: "約拿書", 33: "彌迦書", 34: "那鴻書", 35: "哈巴谷書", 36: "西番雅書", 37: "哈該書", 38: "撒迦利亞書", 39: "瑪拉基書", 40: "馬太福音", 41: "馬可福音", 42: "路加福音", 43: "約翰福音", 44: "使徒行傳", 45: "羅馬書", 46: "哥林多前書", 47: "哥林多後書", 48: "加拉太書", 49: "以弗所書", 50: "腓立比書", 51: "歌羅西書", 52: "帖撒羅尼迦前書", 53: "帖撒羅尼迦後書", 54: "提摩太前書", 55: "提摩太後書", 56: "提多書", 57: "腓利門書", 58: "希伯來書", 59: "雅各書", 60: "彼得前書", 61: "彼得後書", 62: "約翰一書", 63: "約翰二書", 64: "約翰三書", 65: "猶大書", 66: "啟示錄"
};

// ==========================================
// 3. 工具函數
// ==========================================

/**
 * 強效字串清洗工具 (拔除所有原文標籤與括號雜質)
 */
function cleanStrongs(text) {
    if (!text) return "";
    // 移除 {G1234} 或 {H1234}
    let cleaned = text.replace(/[<{ ]*[GH]\d+[a-zA-Z]?[>} ]*/g, '');
    // 移除殘留的尖括號或大括號
    return cleaned.replace(/[<>{}[\]]/g, '').trim();
}

/**
 * 原文編號排序規則 (按字母與數字大小升序)
 */
function sortStrongIds(a, b) {
    let aType = a.charAt(0);
    let bType = b.charAt(0);
    if (aType !== bType) return aType.localeCompare(bType);
    let aNum = parseInt(a.substring(1)) || 0;
    let bNum = parseInt(b.substring(1)) || 0;
    return aNum - bNum;
}

/**
 * HTML 安全字元轉義 (防止特殊符號破壞網頁結構)
 */
function escapeHtml(str) {
    if (!str) return str;
    return String(str).replace(/[&<>"']/g, s => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[s]));
}

// ==========================================
// 4. 搜索构建器实例 (新增)
// ==========================================

/**
 * 全局搜索构建器实例
 * 在数据加载完成后初始化
 */
let searchBuilder = null;

/**
 * 初始化搜索构建器
 */
function initSearchBuilder() {
    if (typeof StrongSearchBuilder === 'undefined') {
        console.warn('⚠️ StrongSearchBuilder 未加载，请确保引入了 StrongSearchBuilder.js');
        return null;
    }
    
    searchBuilder = new StrongSearchBuilder({
        bibleData: bibleData,
        bibleSimpData: bibleSimpData,
        strongsDict: strongsDict,
        bookMap: BOOK_MAP,
        debugMode: false // 生产环境设为 false，开发时可设为 true
    });
    
    console.log('✅ 搜索构建器已初始化');
    return searchBuilder;
}

/**
 * 获取搜索构建器实例（懒加载）
 */
function getSearchBuilder() {
    if (!searchBuilder) {
        initSearchBuilder();
    }
    return searchBuilder;
}

// ==========================================
// 5. 向后兼容的 buildSectionsHtml (新增)
// ==========================================

/**
 * 构建搜索结果的HTML
 * 保持与原函数完全相同的签名，确保向后兼容
 * 如果 StrongSearchBuilder 不可用，会降级使用原实现
 */
function buildSectionsHtml(groups, keyword, isSimplifiedMode = false, options = {}) {
    // 尝试使用新的 Class
    try {
        const builder = getSearchBuilder();
        if (builder) {
            return builder.buildSectionsHtml(groups, keyword, isSimplifiedMode, options);
        }
    } catch (error) {
        console.error('❌ 使用新搜索构建器失败，降级到旧实现:', error);
    }
    
    // 降级：如果新实现不可用，使用原有的实现（保留原代码作为后备）
    return buildSectionsHtmlLegacy(groups, keyword, isSimplifiedMode, options);
}

/**
 * 原有的 buildSectionsHtml 实现（重命名为后备函数）
 * 注意：这个函数在第一次重构后可以删除，但保留作为降级方案
 */
function buildSectionsHtmlLegacy(groups, keyword, isSimplifiedMode, options = {}) {
    // 这里放你原来的 buildSectionsHtml 完整代码
    // 或者直接抛出错误，强制使用新实现
    console.error('⚠️ 降级函数被调用，请确保 StrongSearchBuilder 已正确加载');
    return `<div class='error-message'>搜索功能不可用，请刷新页面重试</div>`;
}
/**
 * 获取关键词的Strong编号索引
 * 这是一个便捷函数，直接暴露Class的功能
 */
function getStrongIndex(keyword) {
    const builder = getSearchBuilder();
    if (!builder) {
        console.warn('⚠️ 搜索构建器未初始化');
        return new Set();
    }
    return builder.getStrongIndex(keyword);
}

/**
 * 获取搜索统计（包含索引信息）
 */
function getSearchStats(groups, keyword) {
    const builder = getSearchBuilder();
    if (!builder) {
        return null;
    }
    return builder.getSearchStats(groups, keyword);
}

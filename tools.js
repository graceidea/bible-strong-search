// ==========================================
// 1. 強效字串清洗工具 (拔除所有原文標籤與括號雜質)
// ==========================================
function cleanStrongs(text) {
    if (!text) return "";
    // 移除 {G1234} 或 {H1234}
    let cleaned = text.replace(/[<{ ]*[GH]\d+[a-zA-Z]?[>} ]*/g, '');
    // 移除殘留的尖括號或大括號
    return cleaned.replace(/[<>{}[\]]/g, '').trim();
}

// ==========================================
// 2. 原文編號排序規則 (按字母與數字大小升序)
// ==========================================
function sortStrongIds(a, b) {
    let aType = a.charAt(0);
    let bType = b.charAt(0);
    if (aType !== bType) return aType.localeCompare(bType);
    let aNum = parseInt(a.substring(1)) || 0;
    let bNum = parseInt(b.substring(1)) || 0;
    return aNum - bNum;
}

// ==========================================
// 3. HTML 安全字元轉義 (防止特殊符號破壞網頁結構)
// ==========================================
function escapeHtml(str) {
    if (!str) return str;
    return String(str).replace(/[&<>"']/g, s => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[s]));
}

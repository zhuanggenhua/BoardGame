/* 在模块脚本运行前安装，以便 WebKit 刷新时使用 import map 重试失败的模块。 */
(function () {
    var key = 'bg_failed_module_preload';
    var guardKey = 'bg_stale_chunk_reload_guard';
    var historyKey = '__bg_preload_recovery';
    var failures = [];
    var maxFailures = 32;

    function readHistory(name) {
        try {
            var state = window.history.state;
            var saved = state && state[historyKey];
            return saved && typeof saved[name] === 'string' ? saved[name] : null;
        } catch { return null; }
    }

    function writeHistory(name, value) {
        var state = window.history.state;
        if (state !== null && Object.prototype.toString.call(state) !== '[object Object]') throw new Error('history state is not an object');
        var saved = state && state[historyKey];
        if (saved !== undefined && Object.prototype.toString.call(saved) !== '[object Object]') throw new Error('history recovery state is not an object');
        var next = Object.assign({}, state || {});
        var recovery = Object.assign({}, saved || {});
        if (value === null) delete recovery[name];
        else recovery[name] = value;
        if (Object.keys(recovery).length) next[historyKey] = recovery;
        else delete next[historyKey];
        window.history.replaceState(next, '');
    }

    function readValue(name) {
        var historyValue = readHistory(name);
        if (historyValue !== null) return historyValue;
        try {
            var stored = window.sessionStorage.getItem(name);
            if (stored !== null) return stored;
        } catch { /* 尝试页面历史记录中的同一恢复标记。 */ }
        return null;
    }

    function writeValue(name, value) {
        if (readHistory(name) !== null) {
            writeHistory(name, value);
            return;
        }
        try {
            window.sessionStorage.setItem(name, value);
            return;
        } catch { /* 只在会话存储不可用时使用本页面历史记录。 */ }
        writeHistory(name, value);
    }

    function removeValue(name) {
        try { window.sessionStorage.removeItem(name); } catch { /* 可能被浏览器禁止。 */ }
        if (readHistory(name) !== null) {
            try { writeHistory(name, null); } catch { /* 保留原始加载错误。 */ }
        }
    }

    function validatedUrl(value) {
        try {
            var url = new URL(value, window.location.href);
            if (url.origin !== window.location.origin || url.search || url.hash) return null;
            if (!/^\/assets\/[A-Za-z0-9_.-]{1,180}-[A-Za-z0-9_-]{8,64}\.(?:js|mjs)$/.test(url.pathname)) return null;
            return url.href;
        } catch {
            return null;
        }
    }

    window.addEventListener('error', function (event) {
        var target = event.target;
        if (!target || target.tagName !== 'LINK' || target.rel !== 'modulepreload') return;
        var url = validatedUrl(target.href);
        if (!url) return;
        failures = failures.filter(function (item) { return item.url !== url; });
        failures.push({ url: url, at: Date.now() });
        if (failures.length > maxFailures) failures.shift();
    }, true);

    window.__BG_MODULE_PRELOAD_RECOVERY__ = {
        prepare: function () {
            var recent = failures.filter(function (item) { return Date.now() - item.at <= 8000; });
            if (!recent.length) return;
            try { writeValue(key, JSON.stringify(recent.map(function (item) { return item.url; }))); } catch { /* 存储不可用时保留原始错误路径。 */ }
        },
        clear: function () {
            removeValue(key);
        },
        getGuard: function () { return readValue(guardKey); },
        setGuard: function (value) { writeValue(guardKey, value); },
    };

    try {
        var stored = readValue(key);
        removeValue(key);
        var parsed = stored && JSON.parse(stored);
        if (!Array.isArray(parsed)) return;
        var imports = {};
        var retryId = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
        parsed.slice(0, maxFailures).forEach(function (value) {
            if (typeof value !== 'string') return;
            var failed = validatedUrl(value);
            if (failed) imports[failed] = failed + '?bg-preload-retry=' + retryId;
        });
        if (!Object.keys(imports).length) return;
        var map = document.createElement('script');
        map.type = 'importmap';
        map.textContent = JSON.stringify({ imports: imports });
        document.head.appendChild(map);
    } catch { /* 保留原始模块加载错误，避免影响启动。 */ }
})();

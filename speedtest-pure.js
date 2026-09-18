// ==UserScript==
// @name         Speedtest Pure
// @namespace    local.speedtest.center
// @version      3.4.2
// @description  仅保留测速界面，默认单连接，结果页隐藏 IP 后两段（单击可显示）
// @match        https://www.speedtest.net/*
// @match        https://speedtest.net/*
// @run-at       document-end
// @grant        none
// @noframes
// @license      MIT
// ==/UserScript==

(() => {
    'use strict';

    const STYLE_ID = 'speedtest-pure-mode-style';
    const ROOT_MARK = 'data-speedtest-pure-root';
    const PATH_MARK = 'data-speedtest-pure-path';
    const MODE_MARK = 'data-speedtest-pure-mode';
    const KEEP_MARK = 'data-speedtest-pure-keep';
    const TOP_MARK = 'data-speedtest-pure-top';
    const TOP_BAR_SELECTOR = [
        'header',
        'nav',
        '[role="banner"]',
        '[aria-label*="header" i]',
        '[data-testid*="header" i]',
        '[class*="navbar" i]',
        '[class*="navigation" i]'
    ].join(',');
    const TOP_CONTROL_SELECTOR = [
        '[aria-haspopup="menu"]',
        '[aria-label*="menu" i]',
        '[aria-label*="language" i]',
        '[aria-label*="download" i]',
        '[aria-label*="菜单"]',
        '[aria-label*="语言"]',
        '[aria-label*="下载"]',
        '[data-testid*="menu" i]',
        '[data-testid*="language" i]',
        '[data-testid*="download" i]'
    ].join(',');
    const RESULT_MARK = 'data-speedtest-pure-result';
    const HIDDEN_MARK = 'data-speedtest-pure-hidden';
    let pinnedRoot = null;
    const IPV4_RE = /^(\d{1,3})(?:\.(\d{1,3})){3}$/;
    let originalIP = null;
    let showFullIP = false;
    let testFinished = false;

    if (document.getElementById(STYLE_ID)) return;

    // ── 页面样式 ─────────────────────────────────────────────
    // 下面的样式只负责布局和隐藏，不改动测速按钮本身的功能。
    // 清理旧版样式，避免旧的网格布局规则继续把测速卡片推向一侧。
    document.getElementById('speedtest-force-center-style')?.remove();

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
        [${ROOT_MARK}]:not([${RESULT_MARK}]) {
            display: block !important;
            width: min(100%, 764px) !important;
            max-width: 764px !important;
            min-width: 0 !important;
            margin: 24px auto 40px !important;
            float: none !important;
            box-sizing: border-box !important;
            position: relative !important;
            left: auto !important;
            right: auto !important;
            transform: none !important;
        }

        /* 结果详情页保留站点原有的宽度，避免整页被压缩成首页测速卡片宽度。 */
        [${ROOT_MARK}][${RESULT_MARK}] {
            display: block !important;
            width: min(100%, 1300px) !important;
            max-width: 1300px !important;
            margin: 24px auto 40px !important;
            float: none !important;
            box-sizing: border-box !important;
            position: relative !important;
            left: auto !important;
            right: auto !important;
            transform: none !important;
        }

        [${ROOT_MARK}] .pure-u-custom-ad-skyscraper,
        [${ROOT_MARK}] .pure-u-custom-ad-rectangle,
        [${ROOT_MARK}] .eot-box-wrapper,
        [${ROOT_MARK}] [class*="downdetector" i],
        [${ROOT_MARK}] [id*="downdetector" i],
        [${ROOT_MARK}] [class*="advert" i],
        [${ROOT_MARK}] [class*="promo" i],
        [${ROOT_MARK}] a[href*="/about/" i],
        [${ROOT_MARK}] a[href*="/apps/" i],
        [${ROOT_MARK}] a[href="/global-index"],
        [${ROOT_MARK}] a[href="/performance"],
        [${ROOT_MARK}] a[href*="downdetector" i],
        [${ROOT_MARK}] a[href*="ookla.com" i],
        [${ROOT_MARK}] [role="contentinfo"],
        [${ROOT_MARK}] iframe,
        [${ROOT_MARK}] video,
        [${ROOT_MARK}] footer {
            display: none !important;
        }

        html, body {
            margin: 0 !important;
        }

        /* 页面动态插入广告、页脚等节点时，也立即隐藏并释放占位。 */
        body[${MODE_MARK}] > *:not([${PATH_MARK}]):not([${ROOT_MARK}]):not([${KEEP_MARK}]) {
            display: none !important;
        }

        body[${MODE_MARK}] [${PATH_MARK}] > *:not([${PATH_MARK}]):not([${ROOT_MARK}]):not([${KEEP_MARK}]) {
            display: none !important;
        }

        /* 顶栏只提高层级，不改动站点原有的布局及下拉菜单定位。 */
        [${TOP_MARK}] {
            z-index: 20 !important;
        }

        [${ROOT_MARK}] .pure-u-custom-speedtest {
            width: 100% !important;
            max-width: 764px !important;
            margin-inline: auto !important;
            float: none !important;
            box-sizing: border-box !important;
        }

        [${ROOT_MARK}][${RESULT_MARK}] .pure-u-custom-speedtest {
            max-width: 100% !important;
        }

    `;
    (document.head || document.documentElement).appendChild(style);

    const normalize = (value) => (value || '').replace(/\s+/g, ' ').trim();

    // ── 找到测速主卡片 ────────────────────────────────────────
    function looksLikeSpeedtestRoot(element) {
        if (!(element instanceof Element)) return false;
        const text = normalize(element.textContent);
        const hasResultData =
            /(?:share|分享)/i.test(text) &&
            /(?:download|上传|下载)/i.test(text) &&
            /(?:upload|上传)/i.test(text) &&
            /(?:ping|延迟)/i.test(text);
        return Boolean(
            element.matches('.pure-u-custom-speedtest, #speedtest, [data-testid*="speedtest" i], .speedtest-app') ||
            element.querySelector('.pure-u-custom-speedtest, [data-testid*="speedtest" i], .speedtest-app') ||
            hasResultData ||
            /(^|\b)(GO|开始|START)(\b|$)/i.test(text) &&
            element.querySelector('button, [role="button"], a')
        );
    }

    function findTextControl(root, pattern) {
        const controls = root.querySelectorAll('button, [role="button"], a');
        for (const control of controls) {
            if (pattern.test(normalize(control.textContent))) return control;
        }
        const fallback = root.querySelectorAll('div, span');
        for (const element of fallback) {
            if (pattern.test(normalize(element.textContent))) return element;
        }
        return null;
    }

    function closestSpeedtestPanel(goControl, singleControl) {
        if (!goControl || !singleControl) return null;
        const ancestors = new Set();
        let current = goControl;
        while (current && current !== document.body) {
            ancestors.add(current);
            current = current.parentElement;
        }
        current = singleControl;
        while (current && current !== document.body) {
            if (ancestors.has(current)) return current;
            current = current.parentElement;
        }
        return null;
    }

    function findResultRoot() {
        const candidates = Array.from(document.querySelectorAll(
            'main, [data-testid*="result" i], [class*="result" i]'
        )).filter(looksLikeSpeedtestRoot);
        candidates.sort((a, b) => normalize(b.textContent).length - normalize(a.textContent).length);
        return candidates[0] || null;
    }

    function findSpeedtestRoot() {
        // 结果详情页没有“单一连接”控件，优先保留包含分享、下载、上传和 Ping 的完整结果区域。
        if (/\/result(?:\/|$)/i.test(window.location.pathname)) {
            const resultRoot = findResultRoot();
            if (resultRoot) {
                resultRoot.setAttribute(RESULT_MARK, '');
                pinnedRoot = resultRoot;
                return resultRoot;
            }
        }

        if (pinnedRoot && pinnedRoot.isConnected) {
            pinnedRoot.removeAttribute(RESULT_MARK);
            return pinnedRoot;
        }

        const direct = document.querySelector('.pure-u-custom-speedtest');
        if (direct) {
            if (/\/result(?:\/|$)/i.test(window.location.pathname)) {
                direct.setAttribute(RESULT_MARK, '');
            }
            pinnedRoot = direct;
            return direct;
        }

        // 新版页面的 class 名会变化，因此用 GO 和“单一”控件定位测速主卡片。
        const goControl = findTextControl(document, /^GO$/i) || findTextControl(document, /^开始$/);
        const singleControl = findTextControl(document, /^(单一|单一连接|single|single connection)$/i);
        const panel = closestSpeedtestPanel(goControl, singleControl);
        if (panel && panel !== document.body && panel !== document.documentElement) {
            pinnedRoot = panel;
            return panel;
        }

        const fallbacks = [
            '[data-testid*="speedtest" i]',
            '#speedtest',
            '.speedtest-app',
            'main',
            '[data-testid*="result" i]',
            '[class*="result" i]'
        ];
        for (const selector of fallbacks) {
            const candidate = document.querySelector(selector);
            if (candidate && looksLikeSpeedtestRoot(candidate)) {
                pinnedRoot = candidate;
                return candidate;
            }
        }
        return null;
    }

    // ── 清理页面，只保留测速相关内容 ───────────────────────────
    function hideElement(element) {
        if (!(element instanceof HTMLElement)) return;
        if (element.hasAttribute(HIDDEN_MARK)) return;
        element.setAttribute(HIDDEN_MARK, '1');
        element.style.setProperty('display', 'none', 'important');
    }

    function preserveFloatingPanels() {
        const selector = [
            '[role="menu"]',
            '[role="listbox"]',
            '[data-popper-placement]',
            '[data-radix-popper-content-wrapper]',
            '[data-testid*="menu" i]',
            '[data-testid*="dropdown" i]',
            '[aria-label*="menu" i]:not(button)',
            '[class*="dropdown" i]',
            '[class*="popover" i]'
        ].join(',');
        document.querySelectorAll(selector).forEach((panel) => {
            let holder = panel;
            while (holder.parentElement && holder.parentElement !== document.body) {
                holder = holder.parentElement;
            }
            if (holder !== document.body) holder.setAttribute(KEEP_MARK, '');
        });
    }

    // 3.4.0 曾给测速卡片的布局祖先写入过这些 !important 内联样式。
    // 如果用户没有完整刷新页面，单纯删除新 CSS 不会撤销旧的写入。
    let legacyLayoutCleaned = false;
    function clearLegacyLayoutOverrides() {
        if (legacyLayoutCleaned) return;
        legacyLayoutCleaned = true;
        const legacyValues = new Map([
            ['width', '100%'],
            ['max-width', 'none'],
            ['margin-left', '0'],
            ['margin-right', '0'],
            ['float', 'none']
        ]);
        document.querySelectorAll(`[${PATH_MARK}]:not([${TOP_MARK}])`).forEach((element) => {
            for (const [property, value] of legacyValues) {
                if (
                    element.style.getPropertyPriority(property) === 'important' &&
                    element.style.getPropertyValue(property).trim() === value
                ) {
                    element.style.removeProperty(property);
                }
            }
        });
    }

    let reflowQueued = false;
    let lastReflowAt = 0;
    function requestSiteReflow() {
        const now = performance.now();
        if (reflowQueued || now - lastReflowAt < 250) return;
        reflowQueued = true;
        lastReflowAt = now;
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                reflowQueued = false;
                window.dispatchEvent(new Event('resize'));
            });
        });
    }

    function isolateTo(root) {
        if (!(root instanceof HTMLElement) || !document.body) return;

        root.setAttribute(ROOT_MARK, '');
        document.body.setAttribute(MODE_MARK, '');

        let current = root;
        while (current && current !== document.body) {
            const parent = current.parentElement;
            if (!parent) break;
            parent.setAttribute(PATH_MARK, '');
            for (const sibling of parent.children) {
                if (sibling === current || sibling.matches('script, style, link')) continue;
                if (sibling.hasAttribute(KEEP_MARK)) continue;
                const hasTopBar = sibling.matches(TOP_BAR_SELECTOR) ||
                    sibling.querySelector(`${TOP_BAR_SELECTOR}, ${TOP_CONTROL_SELECTOR}`);
                const keepChrome = hasTopBar || sibling.matches(
                    'a[href="/results"], a[href="/settings"]'
                ) || sibling.querySelector(
                    'a[href="/results"], a[href="/settings"]'
                );
                if (keepChrome) {
                    sibling.setAttribute(KEEP_MARK, '');
                    if (hasTopBar) sibling.setAttribute(TOP_MARK, '');
                    continue;
                }
                sibling.remove();
            }
            // 不修改 root 的布局祖先；这些祖先可能是顶栏下拉菜单的定位上下文。
            current = parent;
        }

        const unwanted = root.querySelectorAll([
            '.pure-u-custom-ad-skyscraper',
            '.pure-u-custom-ad-rectangle',
            '.eot-box-wrapper',
            '[class*="downdetector" i]',
            '[id*="downdetector" i]',
            '[class*="advert" i]',
            '[class*="promo" i]',
            'a[href*="/about/" i]',
            'a[href*="/apps/" i]',
            'a[href="/global-index"]',
            'a[href="/performance"]',
            'a[href*="downdetector" i]',
            'a[href*="ookla.com" i]',
            '[role="contentinfo"]',
            'iframe',
            'video',
            'footer'
        ].join(','));
        unwanted.forEach(hideElement);

        // 连同推荐链接的卡片一起隐藏，避免结果页下方残留推广内容。
        const residualLinks = root.querySelectorAll([
            'a[href*="/about/" i]',
            'a[href*="/apps/" i]',
            'a[href="/global-index"]',
            'a[href="/performance"]',
            'a[href*="downdetector" i]',
            'a[href*="ookla.com" i]'
        ].join(','));
        residualLinks.forEach((link) => {
            const card = link.closest(
                'article, li, [class*="card" i], [class*="tile" i], ' +
                '[class*="promo" i], [class*="recommend" i]'
            );
            hideElement(card && card !== root ? card : link);
        });

        // 顶栏如果是固定定位，给正文预留真实高度；正常文档流则不额外加空白。
        const banner = document.querySelector(`[${TOP_MARK}]`);
        if (banner) {
            const fixedBanner = [banner, ...banner.querySelectorAll('header, [role="banner"]')]
                .find((element) => ['fixed', 'absolute'].includes(getComputedStyle(element).position));
            if (fixedBanner) {
                document.body.style.setProperty(
                    'padding-top',
                    `${Math.ceil(fixedBanner.getBoundingClientRect().height)}px`,
                    'important'
                );
            } else {
                document.body.style.removeProperty('padding-top');
            }
        }
    }

    // ── 默认切换为单一连接 ────────────────────────────────────
    function findSingleConnectionControl(root) {
        const nodes = root.querySelectorAll('button, [role="button"], label, a, [tabindex], span, div');
        for (const node of nodes) {
            const text = normalize(node.textContent);
            if (!/^(单一|单一连接|single|single connection)$/i.test(text)) continue;

            const control = node.closest('button, [role="button"], label, a, [tabindex]') || node;
            if (!(control instanceof HTMLElement)) continue;
            if (control.closest(`[${HIDDEN_MARK}]`)) continue;
            return control;
        }
        return null;
    }

    function selectSingleConnection(root) {
        if (root.dataset.speedtestSingleApplied === '1') return;

        // 当前页面中，测速模式按钮的第二项就是“单一连接”。
        const modeButtons = root.querySelectorAll(
            '[data-testid="test-mode-toggle"] button[aria-pressed]'
        );
        if (modeButtons.length >= 2) {
            const singleButton = modeButtons[1];
            if (singleButton.getAttribute('aria-pressed') !== 'true') {
                singleButton.click();
            }
            root.dataset.speedtestSingleApplied = '1';
            return;
        }

        const control = findSingleConnectionControl(root);
        if (!control) return;

        const explicitState = [
            control.getAttribute('aria-checked'),
            control.getAttribute('aria-pressed'),
            control.getAttribute('data-selected')
        ].some((value) => /^(true|1|yes)$/i.test(value || ''));
        const activeClass = /\b(?:active|selected|checked|current)\b/i.test(String(control.className || ''));
        if (explicitState || activeClass) {
            root.dataset.speedtestSingleApplied = '1';
            return;
        }

        control.click();
        root.dataset.speedtestSingleApplied = '1';
    }

    // ── 结果页隐藏 IP 地址 ────────────────────────────────────
    function maskIPv4(value) {
        return value.split('.').map((part, index) => index < 2 ? part : '*').join('.');
    }

    function rememberOriginalIP(scope) {
        const paragraphs = scope.querySelectorAll('p');
        if (!originalIP) {
            for (const paragraph of paragraphs) {
                const text = normalize(paragraph.textContent);
                if (IPV4_RE.test(text)) {
                    originalIP = text;
                    break;
                }
            }
        }
    }

    function updateIpParagraphs(scope) {
        rememberOriginalIP(scope);
        if (!originalIP) return;

        const maskedIP = maskIPv4(originalIP);
        // 测速前始终显示完整 IP；只有结果状态才按开关显示掩码或完整地址。
        const displayIP = !testFinished || showFullIP ? originalIP : maskedIP;
        const paragraphs = scope.querySelectorAll('p');
        for (const paragraph of paragraphs) {
            const text = normalize(paragraph.textContent);
            if ((text === originalIP || text === maskedIP) && text !== displayIP) {
                paragraph.textContent = displayIP;
            }
        }
    }

    function maskIPv6(value) {
        const parts = value.split(':');
        return parts.length > 3 ? `${parts.slice(0, 3).join(':')}:*` : value;
    }

    function maskIpText(value) {
        return value
            .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, maskIPv4)
            .replace(/\b(?:[0-9a-f]{1,4}:){2,7}[0-9a-f]{0,4}\b/gi, maskIPv6);
    }

    function maskVisibleIps(root) {
        if (!(root instanceof HTMLElement)) return;
        rememberOriginalIP(root);
        if (!testFinished) {
            updateIpParagraphs(root);
            return;
        }
        updateIpParagraphs(root);
        if (showFullIP) return;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const textNodes = [];
        let node;
        while ((node = walker.nextNode())) {
            const parent = node.parentElement;
            if (!parent || /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA)$/i.test(parent.tagName)) continue;
            if (/\b(?:\d{1,3}\.){3}\d{1,3}\b|\b(?:[0-9a-f]{1,4}:){2,7}[0-9a-f]{0,4}\b/i.test(node.nodeValue || '')) {
                textNodes.push(node);
            }
        }
        for (const textNode of textNodes) {
            const original = textNode.nodeValue || '';
            const masked = maskIpText(original);
            if (masked !== original) textNode.nodeValue = masked;
        }
    }

    function restoreVisibleIP(root) {
        if (!(root instanceof HTMLElement) || !originalIP) return;
        const maskedIP = maskIPv4(originalIP);
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const textNodes = [];
        let node;
        while ((node = walker.nextNode())) {
            const parent = node.parentElement;
            if (!parent || /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA)$/i.test(parent.tagName)) continue;
            if ((node.nodeValue || '').includes(maskedIP)) textNodes.push(node);
        }
        for (const textNode of textNodes) {
            textNode.nodeValue = textNode.nodeValue.split(maskedIP).join(originalIP);
        }
    }

    function getTestPhase(root) {
        const text = normalize(root.textContent);
        const runningControl = root.querySelector(
            '[aria-label*="cancel" i], [aria-label*="stop" i], ' +
            '[data-testid*="cancel" i], [data-testid*="running" i], ' +
            '[class*="testing" i], [class*="running" i]'
        );
        const runningText = /finding optimal server|testing|测试中|测速中|正在测速|正在寻找/i.test(text);
        if (runningControl || runningText) return 'running';

        // 结果卡片会同时出现下载、上传和速度单位；初始页面没有这些结果字段。
        const hasResultValues =
            /(?:download|upload|下载|上传)/i.test(text) &&
            /(?:Mbps|Gbps|兆|兆比特)/i.test(text);
        return hasResultValues ? 'finished' : 'idle';
    }

    function updateTestPhase(root) {
        const phase = getTestPhase(root);
        if (phase === 'running') {
            testFinished = false;
            showFullIP = false;
            restoreVisibleIP(root);
        } else if (phase === 'finished') {
            testFinished = true;
        }
    }

    // ── 监听页面变化并重复应用规则 ────────────────────────────
    let scheduled = false;
    function apply() {
        scheduled = false;
        const root = findSpeedtestRoot();
        if (!root) return;
        clearLegacyLayoutOverrides();
        preserveFloatingPanels();
        isolateTo(root);
        selectSingleConnection(root);
        updateTestPhase(root);
        maskVisibleIps(root);
        requestSiteReflow();
    }

    function scheduleApply() {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(apply);
    }

    const observer = new MutationObserver(scheduleApply);
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    document.addEventListener('click', (event) => {
        const target = event.target instanceof Element ? event.target : event.target?.parentElement;
        if (target?.closest(TOP_CONTROL_SELECTOR)) requestSiteReflow();
    }, true);
    const singleTimer = setInterval(() => {
        const root = findSpeedtestRoot();
        if (!root) return;
        selectSingleConnection(root);
        if (root.dataset.speedtestSingleApplied === '1') clearInterval(singleTimer);
    }, 100);
    setTimeout(() => clearInterval(singleTimer), 5000);
    document.addEventListener('click', (event) => {
        if (!originalIP || !testFinished) return;
        const target = event.target instanceof Element ? event.target : event.target?.parentElement;
        const paragraph = target?.closest('p');
        if (!paragraph) return;
        const text = normalize(paragraph.textContent);
        const maskedIP = maskIPv4(originalIP);
        if (text !== originalIP && text !== maskedIP) return;
        showFullIP = !showFullIP;
        updateIpParagraphs(document);
    });
    apply();
})();

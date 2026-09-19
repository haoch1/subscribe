// ==UserScript==
// @name         Speedtest Pure
// @namespace    local.speedtest.center
// @version      4.0.5
// @icon         https://www.speedtest.net/favicon.ico
// @description  精简测速界面，默认单连接；结果 IP 点击显示/隐藏，支持 IPv4/IPv6
// @match        https://www.speedtest.net/*
// @match        https://speedtest.net/*
// @run-at       document-start
// @grant        none
// @noframes
// @license      MIT
// ==/UserScript==

(() => {
    'use strict';
    const ID = 'speedtest-pure-mode-style';
    if (document.getElementById(ID)) return;

    const ROOT = 'data-stp-root', PATH = 'data-stp-path', KEEP = 'data-stp-keep';
    const HIDE = 'data-stp-hide', TOP = 'data-stp-top', SERVER_DIALOG = 'data-stp-server-dialog', MODE = 'data-stp-mode';
    const IP_MARK = 'data-stp-ip', IP_TIP = 'data-stp-ip-tip';
    const SELECT = 'button, [role="button"], label, a, [tabindex]';
    const SINGLE = /^(单一|單一|单一连接|單一連線|single(?: connection)?)$/i;
    const START = /^(go|start|开始|開始)$/i;
    const PANEL = '.pure-u-custom-speedtest, #speedtest, .speedtest-app, [data-testid*="speedtest" i]';
    const CHROME = 'header, nav, [role="banner"], [aria-label*="header" i], [data-testid*="header" i], [class*="navbar" i], [class*="navigation" i]';
    const TOP_CONTROL = '[aria-haspopup="menu"], [aria-label*="menu" i], [aria-label*="language" i], [aria-label*="download" i], [aria-label*="菜单"], [aria-label*="语言"], [aria-label*="下载"], [data-testid*="menu" i], [data-testid*="language" i], [data-testid*="download" i]';
    const POPUP = '[role="menu"], [role="listbox"], [role="dialog"], dialog, [aria-modal="true"], [data-popper-placement], [data-radix-popper-content-wrapper], [data-testid*="menu" i], [data-testid*="dropdown" i], [aria-label*="menu" i]:not(button), [class*="dropdown" i], [class*="popover" i]';
    const LINKS = 'a[href*="/about/" i], a[href*="/apps/" i], a[href="/global-index"], a[href="/performance"], a[href*="downdetector" i], a[href*="ookla.com" i]';
    const TRACKING = /^(?:_gl|_ga|_up|gclid|dclid|fbclid|msclkid|utm_[^=]+)$/i;
    const ADS = '.pure-u-custom-ad-skyscraper, .pure-u-custom-ad-rectangle, .eot-box-wrapper, .top-placeholder, .lowerboard-placeholder, [data-ad-slot="true"], [data-pogo="top"], [data-pogo="main"], [data-pogo="footer"], #stnext_leaderboard, #results_stnext_leaderboard, #stnext_lowerboard, #stnext_footer, [class*="downdetector" i], [id*="downdetector" i], [class*="advert" i], [class*="promo" i], [role="contentinfo"], iframe, video, footer';
    const SKIP = 'script, style, noscript, textarea, input, select, pre, code, [contenteditable]:not([contenteditable="false"])';
    const norm = value => (value || '').replace(/\s+/g, ' ').trim();
    const text = element => norm(element?.textContent);
    const all = (selector, scope = document) => scope.querySelectorAll(selector);
    const resultPage = () => /\/result(?:\/|$)/i.test(location.pathname);
    const visible = element => !!element?.getClientRects().length && !element.closest('[hidden], [aria-hidden="true"]');
    const style = document.createElement('style');
    style.id = ID;
    style.textContent = `
        html, body { margin: 0 !important; }
        :where(.pure-u-custom-speedtest, #speedtest, .speedtest-app, [data-testid*="speedtest" i]):not([${ROOT}]) {
            --stp-width: 764px;
            display: block !important; width: min(100%, var(--stp-width)) !important;
            max-width: var(--stp-width) !important; min-width: 0 !important;
            margin: 24px auto 40px !important; float: none !important;
            box-sizing: border-box !important; position: relative !important;
            left: auto !important; right: auto !important; transform: none !important;
        }
        :where(.pure-u-custom-ad-skyscraper, .pure-u-custom-ad-rectangle, .eot-box-wrapper, .top-placeholder, .lowerboard-placeholder, [data-ad-slot="true"], [data-pogo="top"], [data-pogo="main"], [data-pogo="footer"], #stnext_leaderboard, #results_stnext_leaderboard, #stnext_lowerboard, #stnext_footer, #target-section, footer, [data-view-instance-placeholder="lowerContent"]) {
            display: none !important;
        }
        body[${MODE}] {
            padding-top: var(--stp-header-height, 0px) !important;
            scrollbar-gutter: stable !important; overflow-anchor: none !important;
        }
        [${ROOT}] {
            --stp-width: 764px;
            display: block !important; width: min(100%, var(--stp-width)) !important;
            max-width: var(--stp-width) !important; min-width: 0 !important;
            margin: 24px auto 40px !important; float: none !important;
            box-sizing: border-box !important; position: relative !important;
            left: auto !important; right: auto !important; transform: none !important;
        }
        [${ROOT}="result"] { --stp-width: 1300px; }
        [${ROOT}] .pure-u-custom-speedtest {
            width: 100% !important; max-width: 100% !important;
            margin-inline: auto !important; float: none !important; box-sizing: border-box !important;
        }
        body[${MODE}] > :not([${PATH}], [${ROOT}], [${KEEP}], script, style, link),
        body[${MODE}] [${PATH}] > :not([${PATH}], [${ROOT}], [${KEEP}], script, style, link),
        [${ROOT}] :is(${ADS}, ${LINKS}), [${HIDE}] { display: none !important; }
        [${TOP}] { z-index: 20 !important; }
        [${ROOT}] .MuiDialog-root, [${SERVER_DIALOG}] {
            top: calc(var(--stp-header-height, 0px) + 2px) !important;
            bottom: 0 !important;
        }
        [${IP_MARK}] { position: relative !important; cursor: pointer !important; }
        [${IP_MARK}]::after {
            content: attr(${IP_TIP}); position: absolute; left: 50%; bottom: calc(100% + 8px);
            z-index: 100; padding: 5px 9px; border: 1px solid #222; background: #fff; color: #111;
            font: 14px/1.2 Arial, sans-serif; white-space: nowrap; transform: translateX(-50%);
            visibility: hidden; opacity: 0; pointer-events: none; transition: opacity .12s ease;
        }
        [${IP_MARK}]:hover::after { visibility: visible; opacity: 1; }
    `;
    (document.head || document.documentElement).append(style);

    let root = null, route = location.pathname, phase = 'idle', revealed = false, ipPageScanned = false;
    let layoutDirty = true, contentDirty = true, timer = null, lastRun = -Infinity, internalResize = false;
    let singleDone = false, singleTries = 0, singleAt = -Infinity;
    let serverDialogOpen = false, serverDialogScrollY = null, restoringScroll = false;
    const marks = new Map(), ipNodes = new Map(), pending = new Set();

    function findControl(scope, pattern) {
        for (const selector of [SELECT, 'span, div']) {
            for (const element of all(selector, scope)) {
                if (pattern.test(text(element))) return element.closest(SELECT) || element;
            }
        }
        return null;
    }

    function findRoot() {
        if (/\/(?:settings|results|apps|about|global-index|performance)(?:\/|$)/i.test(location.pathname)) return null;
        if (root?.isConnected) return root;
        if (resultPage()) {
            for (const candidate of all('main, [data-testid*="result" i], [class*="result" i]')) {
                const value = text(candidate);
                if (/(download|下载|下載)/i.test(value) && /(upload|上传|上傳)/i.test(value) && /(ping|延迟|延遲)/i.test(value)) return candidate;
            }
        }
        const direct = document.querySelector(PANEL);
        if (direct && !direct.matches(SELECT)) return direct;
        const go = findControl(document, START), single = findControl(document, SINGLE);
        for (let candidate = go?.parentElement; candidate && candidate !== document.body; candidate = candidate.parentElement) {
            if (single && candidate.contains(single)) return candidate;
        }
        return null;
    }

    function mark(element, name, value = '') {
        if (!marks.has(element)) marks.set(element, new Set());
        marks.get(element).add(name);
        if (element.getAttribute(name) !== value) element.setAttribute(name, value);
    }

    function clearLayout() {
        for (const [element, names] of marks) for (const name of names) element.removeAttribute(name);
        marks.clear();
        document.body.style.removeProperty('--stp-header-height');
    }

    function updateHeader() {
        if (!root) return;
        let height = 0;
        for (const banner of all(`[${TOP}], [${TOP}] header, [${TOP}] [role="banner"]`)) {
            if (visible(banner) && /^(fixed|absolute)$/.test(getComputedStyle(banner).position)) {
                height = Math.max(height, Math.ceil(banner.getBoundingClientRect().bottom));
            }
        }
        const value = `${Math.max(0, height)}px`;
        if (document.body.style.getPropertyValue('--stp-header-height') !== value) document.body.style.setProperty('--stp-header-height', value);
    }

    function cleanLink(link) {
        if (!(link instanceof HTMLAnchorElement)) return;
        const raw = link.getAttribute('href');
        if (!raw || /^(?:#|javascript:|mailto:|tel:|data:)/i.test(raw)) return;
        try {
            const url = new URL(raw, location.href);
            if (url.origin !== location.origin) return;
            let changed = false;
            for (const key of [...url.searchParams.keys()]) {
                if (TRACKING.test(key)) { url.searchParams.delete(key); changed = true; }
            }
            if (changed) link.setAttribute('href', `${url.pathname}${url.search ? `?${url.searchParams}` : ''}${url.hash}`);
        } catch {}
    }

    function cleanLinks(scope = document) {
        if (scope instanceof HTMLAnchorElement) cleanLink(scope);
        for (const link of all('a[href]', scope)) cleanLink(link);
    }

    function syncServerDialog() {
        for (const element of all(`[${SERVER_DIALOG}]`)) element.removeAttribute(SERVER_DIALOG);
        const panels = root ? [...all('[role="dialog"]', root)].filter(visible) : [];
        const open = panels.length > 0;
        if (!open) {
            serverDialogOpen = false;
            serverDialogScrollY = null;
            return;
        }
        for (const panel of panels) {
            const dialog = panel.closest('.MuiDialog-root');
            if (dialog) mark(dialog, SERVER_DIALOG);
        }
        if (!serverDialogOpen) serverDialogOpen = true;
        if (serverDialogScrollY === null) serverDialogScrollY = window.scrollY;
        if (Math.abs(window.scrollY - serverDialogScrollY) > 1) {
            restoringScroll = true;
            window.scrollTo(0, serverDialogScrollY);
            restoringScroll = false;
        }
    }

    function isolate() {
        clearLayout();
        mark(root, ROOT, resultPage() ? 'result' : '');
        mark(document.body, MODE);
        for (let current = root; current.parentElement && current !== document.body; current = current.parentElement) {
            const parent = current.parentElement;
            mark(parent, PATH);
            for (const sibling of parent.children) {
                if (sibling === current) continue;
                const chrome = sibling.matches(CHROME) || sibling.querySelector(`${CHROME}, ${TOP_CONTROL}`);
                if (chrome || sibling.matches('a[href="/results"], a[href="/settings"]') || sibling.querySelector('a[href="/results"], a[href="/settings"]')) {
                    mark(sibling, KEEP);
                    if (chrome) mark(sibling, TOP);
                }
            }
        }
        for (let panel of all(POPUP)) {
            if (root.contains(panel) || panel === document.body || panel.contains(root)) continue;
            while (panel.parentElement && panel.parentElement !== document.body && !panel.parentElement.hasAttribute(PATH)) panel = panel.parentElement;
            mark(panel, KEEP);
        }
        updateHeader();
    }

    function hidePromotions() {
        for (const element of all(`[${HIDE}]`, root)) element.removeAttribute(HIDE);
        for (const link of all(LINKS, root)) {
            const card = link.closest('article, li, [class*="card" i], [class*="tile" i], [class*="promo" i], [class*="recommend" i]');
            if (card && card !== root && root.contains(card)) card.setAttribute(HIDE, '');
        }
    }

    function selectSingle() {
        if (singleDone || singleTries >= 4 || resultPage() || phase === 'running') return;
        const buttons = all('[data-testid="test-mode-toggle"] button[aria-pressed]', root);
        const control = [...buttons].find(button => SINGLE.test(text(button))) || buttons[1] || findControl(root, SINGLE);
        if (!(control instanceof HTMLElement) || control.disabled || control.getAttribute('aria-disabled') === 'true') return;
        const radio = control.matches('label') ? control.control : control;
        const states = ['aria-checked', 'aria-pressed', 'data-selected'].map(name => control.getAttribute(name));
        if (radio?.checked || states.some(value => /^(true|1|yes)$/i.test(value || '')) || /\b(active|selected|checked|current)\b/i.test(control.className)) {
            singleDone = true;
        } else if (performance.now() - singleAt >= 300 * 2 ** Math.max(0, singleTries - 1)) {
            singleAt = performance.now();
            singleTries++;
            control.click();
            if (!states.some(value => value !== null) && !radio?.matches('input')) singleDone = true;
            else setTimeout(schedule, 350 * 2 ** (singleTries - 1));
        }
    }

    const IP = /(?<![\w:.])(?:[\da-f]*:){2,}[\da-f:.]*(?:%[\w.-]+)?(?![\w:.])|(?<![\w.])(?:\d{1,3}\.){3}\d{1,3}(?![\w.])/gi;
    function maskIP(address) {
        if (!address.includes(':')) {
            const parts = address.split('.');
            return parts.every(part => +part <= 255) ? `${parts[0]}.${parts[1]}.*.*` : address;
        }
        try {
            const host = new URL(`http://[${address.split('%')[0]}]/`).hostname.slice(1, -1);
            const [left, right = ''] = host.split('::');
            const a = left ? left.split(':') : [], b = right ? right.split(':') : [];
            return [...a, ...Array(8 - a.length - b.length).fill('0'), ...b].slice(0, 3).join(':') + ':*';
        } catch { return address; }
    }

    function clearIPMark(host, except = null) {
        if (!host) return;
        for (const [node, record] of ipNodes) if (node !== except && record.host === host) return;
        host.removeAttribute(IP_MARK);
        host.removeAttribute(IP_TIP);
    }

    function remember(node) {
        const host = node.parentElement;
        if (!host || host.closest(SKIP)) return;
        const raw = node.data, previous = ipNodes.get(node);
        if (previous?.shown === raw) {
            host.setAttribute(IP_MARK, '');
            return;
        }
        const masked = raw.replace(IP, maskIP);
        if (raw !== masked) {
            if (previous?.host && previous.host !== host) clearIPMark(previous.host, node);
            ipNodes.set(node, { raw, masked, shown: raw, host });
            host.setAttribute(IP_MARK, '');
        } else {
            ipNodes.delete(node);
            clearIPMark(previous?.host || host);
        }
    }

    function scan(scope) {
        if (scope.nodeType === Node.TEXT_NODE) return remember(scope);
        const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) remember(walker.currentNode);
    }

    function renderIPs(hide = !revealed) {
        for (const [node, saved] of ipNodes) {
            const inScope = root?.contains(node) || (resultPage() && document.body?.contains(node));
            if (!node.isConnected || !inScope) {
                ipNodes.delete(node);
                clearIPMark(saved.host);
                continue;
            }
            if (node.data !== saved.shown) remember(node);
            const record = ipNodes.get(node);
            if (!record) continue;
            const value = hide ? record.masked : record.raw;
            if (node.data !== value) node.data = value;
            record.shown = value;
            record.host.setAttribute(IP_MARK, '');
            record.host.setAttribute(IP_TIP, hide ? '点击显示 IP' : '点击隐藏 IP');
        }
    }

    function getPhase() {
        const value = norm(root.innerText);
        if (/finding optimal server|finding best server|selecting (?:the )?best server|正在寻找|寻找最佳服务器|正在选择/i.test(value)) return 'preflight';
        if (resultPage()) return 'finished';
        const metrics = /(download|下载|下載)/i.test(value) && /(upload|上传|上傳)/i.test(value) && /(?:\d[\d.,]*\s*(?:[kmg]?bps|兆比特)|[kmg]?bps\s*\d)/i.test(value);
        if (metrics && /\b(?:result id|share|results|settings|change server|go again)\b|结果\s*id|分享|更换服务器|再次测试|重新测速/i.test(value)) return 'finished';
        const running = all('[aria-label*="cancel" i], [aria-label*="stop" i], [data-testid*="cancel" i], [data-testid*="running" i], [class*="testing" i], [class*="running" i], [aria-busy="true"]', root);
        if (/^(running|testing)$/.test(root.getAttribute('data-state') || '') || [...running].some(visible)) return 'running';
        if (/finding optimal server|\btesting\b|测试中|测速中|正在测速|正在寻找/i.test(value)) return 'running';
        return metrics ? 'finished' : 'idle';
    }

    function schedule() {
        if (timer !== null) return;
        const delay = root ? Math.max(0, 120 - (performance.now() - lastRun)) : 0;
        timer = setTimeout(flush, delay);
    }

    function collect(records) {
        let relevant = false;
        for (const record of records) {
            const element = record.target.nodeType === Node.ELEMENT_NODE ? record.target : record.target.parentElement;
            if (!element || element.closest(SKIP)) continue;
            if (record.type === 'characterData' && ipNodes.get(record.target)?.shown === record.target.data) continue;
            const inside = root?.contains(record.target);
            if (resultPage() && !inside) ipPageScanned = false;
            if (record.type === 'childList') {
                const structural = [...record.addedNodes, ...record.removedNodes].some(node => node.nodeType === Node.ELEMENT_NODE);
                if (structural) { contentDirty = true; if (!inside) layoutDirty = true; }
                if (inside) for (const node of record.addedNodes) pending.add(node);
            } else if (record.type === 'characterData' && inside) pending.add(record.target);
            else if (record.type === 'attributes' && !inside) {
                if (!root || element.hasAttribute(PATH) || element.closest(`[${TOP}], [${KEEP}]`) || element.matches(POPUP)) layoutDirty = true;
                else continue;
            }
            relevant ||= !!inside || layoutDirty || !root?.isConnected || route !== location.pathname;
        }
        if (relevant) schedule();
    }

    const observer = new MutationObserver(collect);
    function flush() {
        timer = null;
        lastRun = performance.now();
        cleanLinks();
        if (route !== location.pathname || (root && !root.isConnected)) {
            renderIPs(true);
            clearLayout();
            root = null; phase = 'idle'; revealed = false;
            for (const record of ipNodes.values()) {
                record.host.removeAttribute(IP_MARK);
                record.host.removeAttribute(IP_TIP);
            }
            ipNodes.clear(); pending.clear(); ipPageScanned = false;
            route = location.pathname;
            singleDone = false; singleTries = 0; singleAt = -Infinity;
            serverDialogOpen = false; serverDialogScrollY = null;
            layoutDirty = contentDirty = true;
        }
        const next = findRoot();
        if (!(next instanceof HTMLElement) || next === document.body || next === document.documentElement) {
            serverDialogOpen = false;
            serverDialogScrollY = null;
            if (resultPage() && document.body && !ipPageScanned) {
                scan(document.body);
                ipPageScanned = ipNodes.size > 0;
                renderIPs();
            }
            return;
        }
        if (next !== root) {
            root = next; layoutDirty = contentDirty = true; pending.add(root);
            requestAnimationFrame(() => {
                internalResize = true;
                window.dispatchEvent(new Event('resize'));
                internalResize = false;
            });
        }
        if (layoutDirty) { isolate(); layoutDirty = false; }
        syncServerDialog();
        if (contentDirty) { hidePromotions(); contentDirty = false; }
        const detected = getPhase();
        const nextPhase = detected === 'idle' && phase === 'finished' ? phase : detected;
        if (nextPhase !== phase) {
            phase = nextPhase;
            if (phase === 'finished') pending.add(root);
        }
        for (const scope of pending) if (scope.isConnected && root.contains(scope)) scan(scope);
        pending.clear();
        if (resultPage() && !ipPageScanned && document.body) {
            scan(document.body);
            ipPageScanned = ipNodes.size > 0;
        }
        renderIPs();
        collect(observer.takeRecords());
        selectSingle();
    }

    observer.observe(document.documentElement, {
        subtree: true, childList: true, characterData: true, attributes: true,
        attributeFilter: ['class', 'href', 'hidden', 'aria-hidden', 'aria-pressed', 'aria-checked', 'aria-busy', 'aria-disabled', 'disabled', 'data-state']
    });
    document.addEventListener('click', event => {
        const target = event.target instanceof Element ? event.target : event.target?.parentElement;
        if (!target) return;
        const button = target.closest('button, [role="button"]');
        if (button && /(?:change server|更换服务器|更換伺服器)/i.test(text(button))) serverDialogScrollY = window.scrollY;
        if (event.isTrusted && target.closest('[data-testid="test-mode-toggle"]')) singleDone = true;
        if (target.closest(TOP_CONTROL)) { layoutDirty = true; schedule(); }
        const inScope = root?.contains(target) || (resultPage() && document.body?.contains(target));
        if (!inScope || target.closest('a, button, input, textarea, select, [role="button"]')) return;
        for (const [node, record] of ipNodes) {
            const targetText = text(target);
            if (target.contains(node) && (targetText.includes(record.raw) || targetText.includes(record.masked))) {
                revealed = !revealed;
                renderIPs();
                collect(observer.takeRecords());
                break;
            }
        }
    }, true);
    document.addEventListener('contextmenu', event => {
        const target = event.target instanceof Element ? event.target : event.target?.parentElement;
        const link = target?.closest('a[href]');
        if (link) cleanLink(link);
    }, true);
    for (const name of ['popstate', 'hashchange', 'pageshow', 'resize']) {
        window.addEventListener(name, () => {
            if (name === 'resize' && internalResize) return;
            layoutDirty = true;
            schedule();
        }, { passive: true });
    }
    window.addEventListener('scroll', () => {
        if (!restoringScroll && serverDialogOpen && serverDialogScrollY !== null && Math.abs(window.scrollY - serverDialogScrollY) > 1) {
            restoringScroll = true;
            window.scrollTo(0, serverDialogScrollY);
            restoringScroll = false;
        }
    }, { passive: true });
    window.navigation?.addEventListener('navigatesuccess', schedule);
    flush();
})();

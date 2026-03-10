/**
 * Single-elimination bracket renderer (lgame-style).
 *
 * Reads window.__TOURNAMENT_BRACKET__ = {
 *   teams:   [ { id, name, members: [] } ],
 *   matches: [ { id, team_a, team_b, winner, score, round_number, position } ],
 *   rounds:  <int>,   // total number of rounds
 *   slots:   <int>,   // total first-round slots (power of 2)
 * }
 */
document.addEventListener('DOMContentLoaded', function() {
    'use strict';

    const root = document.getElementById('bracket-root');
    if (!root) return;

    const data = window.__TOURNAMENT_BRACKET__ || {};
    const teams = data.teams || [];
    const matches = data.matches || [];
    const totalRounds = Math.max(data.rounds || 0, matches.reduce((a, m) => Math.max(a, m.round_number || 1), 0), 1);

    root.innerHTML = '';

    /* ── Empty state ──────────────────────────────────────────────── */
    if (teams.length === 0 && matches.length === 0) {
        root.innerHTML = '<div class="bracket-empty-state">No teams yet — waiting for applications.</div>';
        return;
    }

    /* ── Helpers ───────────────────────────────────────────────────── */
    function esc(s) {
        const d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }

    function teamById(id) { return teams.find(t => t.id === id); }

    function roundLabel(r) {
        if (r === totalRounds) return 'Final';
        if (r === totalRounds - 1 && totalRounds > 2) return 'Semifinal';
        if (r === totalRounds - 2 && totalRounds > 3) return 'Quarterfinal';
        return 'Round ' + r;
    }

    function parseScore(score) {
        if (!score) return [null, null];
        const m = score.match(/(\d+)\D+(\d+)/);
        if (!m) return [null, null];
        return [parseInt(m[1], 10), parseInt(m[2], 10)];
    }

    /* ── Build wrapper structure ──────────────────────────────────── */
    const viewer = document.createElement('div');
    viewer.className = 'lgame-bracket-viewer-wrapper';

    const viewerInner = document.createElement('div');
    viewerInner.className = 'lgame-bracket-viewer-container';

    const panWrapper = document.createElement('div');
    panWrapper.className = 'bracket-container-wrapper';

    const bracketContainer = document.createElement('div');
    bracketContainer.className = 'bracket-container';

    /* ── Round headers ────────────────────────────────────────────── */
    const headerRow = document.createElement('div');
    headerRow.className = 'round-number-container';
    for (let r = 1; r <= totalRounds; r++) {
        const hdr = document.createElement('div');
        hdr.className = 'round-number' + (r === totalRounds ? ' round-final' : '');
        hdr.textContent = roundLabel(r);
        headerRow.appendChild(hdr);
    }
    bracketContainer.appendChild(headerRow);

    /* ── Build rounds and matches ─────────────────────────────────── */
    const bracketEl = document.createElement('div');
    bracketEl.className = 'single-elimination-bracket';

    let matchCounter = 0;
    const roundColumns = []; // array of arrays of DOM match elements, for connector drawing

    for (let r = 1; r <= totalRounds; r++) {
        const col = document.createElement('div');
        col.className = 'bracket-round bracket-round-' + r;

        const roundMatches = matches
            .filter(m => (m.round_number || 1) === r)
            .sort((a, b) => (a.position || 0) - (b.position || 0));

        const matchEls = [];

        roundMatches.forEach(m => {
            matchCounter++;

            const teamA = teamById(m.team_a);
            const teamB = teamById(m.team_b);
            const [scoreA, scoreB] = parseScore(m.score);

            const isAWinner = m.winner && teamA && m.winner === teamA.id;
            const isBWinner = m.winner && teamB && m.winner === teamB.id;

            const container = document.createElement('div');
            container.className = 'match-container';
            container.dataset.matchId = String(m.id || '');
            container.dataset.round = String(r);
            container.dataset.position = String(m.position || 0);

            container.innerHTML = `
                <span class="match-number">#${matchCounter}</span>
                <div class="match">
                    <div class="player-container participant-container${isAWinner ? ' is-winner' : ''}${isBWinner ? ' is-loser' : ''}">
                        <div class="player">
                            <div class="player-avatar"><img alt="" src="/static/logo.png" onerror="this.src='/static/logo.png'"></div>
                            <div class="player-name${teamA ? '' : ' tbd'}">${teamA ? esc(teamA.name) : 'TBD'}</div>
                        </div>
                        <div class="player-score"><input type="number" min="0" maxlength="2" readonly value="${scoreA !== null ? scoreA : ''}"></div>
                    </div>
                    <div class="player-container competitor-container${isBWinner ? ' is-winner' : ''}${isAWinner ? ' is-loser' : ''}">
                        <div class="player">
                            <div class="player-avatar"><img alt="" src="/static/logo.png" onerror="this.src='/static/logo.png'"></div>
                            <div class="player-name${teamB ? '' : ' tbd'}">${teamB ? esc(teamB.name) : 'TBD'}</div>
                        </div>
                        <div class="player-score"><input type="number" min="0" maxlength="2" readonly value="${scoreB !== null ? scoreB : ''}"></div>
                    </div>
                </div>`;

            col.appendChild(container);
            matchEls.push(container);
        });

        bracketEl.appendChild(col);
        roundColumns.push(matchEls);
    }

    bracketContainer.appendChild(bracketEl);

    /* ── SVG connector canvas ─────────────────────────────────────── */
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('bracket-connectors');
    svg.setAttribute('preserveAspectRatio', 'none');
    bracketContainer.appendChild(svg);

    panWrapper.appendChild(bracketContainer);
    viewerInner.appendChild(panWrapper);

    /* ── Zoom controls ────────────────────────────────────────────── */
    const zoomControls = document.createElement('div');
    zoomControls.className = 'bracket-zoom-controls';
    zoomControls.innerHTML = '<button data-action="zoom-in" title="Zoom in">+</button><button data-action="zoom-out" title="Zoom out">−</button><button data-action="zoom-reset" title="Reset">⟲</button>';
    viewerInner.appendChild(zoomControls);

    viewer.appendChild(viewerInner);
    root.appendChild(viewer);


    /* ═══════════════════════════════════════════════════════════════
       DRAG-TO-PAN
       ═══════════════════════════════════════════════════════════════ */
    let isPanning = false,
        panStartX = 0,
        panStartY = 0,
        scrollStartX = 0,
        scrollStartY = 0;

    panWrapper.addEventListener('mousedown', e => {
        // ignore clicks on inputs
        if (e.target.tagName === 'INPUT') return;
        isPanning = true;
        panStartX = e.clientX;
        panStartY = e.clientY;
        scrollStartX = panWrapper.scrollLeft;
        scrollStartY = panWrapper.scrollTop;
        panWrapper.classList.add('grabbing');
        e.preventDefault();
    });

    window.addEventListener('mousemove', e => {
        if (!isPanning) return;
        panWrapper.scrollLeft = scrollStartX - (e.clientX - panStartX);
        panWrapper.scrollTop = scrollStartY - (e.clientY - panStartY);
    });

    window.addEventListener('mouseup', () => {
        isPanning = false;
        panWrapper.classList.remove('grabbing');
    });

    // Touch support
    panWrapper.addEventListener('touchstart', e => {
        if (e.touches.length !== 1) return;
        isPanning = true;
        panStartX = e.touches[0].clientX;
        panStartY = e.touches[0].clientY;
        scrollStartX = panWrapper.scrollLeft;
        scrollStartY = panWrapper.scrollTop;
    }, { passive: true });

    panWrapper.addEventListener('touchmove', e => {
        if (!isPanning || e.touches.length !== 1) return;
        panWrapper.scrollLeft = scrollStartX - (e.touches[0].clientX - panStartX);
        panWrapper.scrollTop = scrollStartY - (e.touches[0].clientY - panStartY);
    }, { passive: true });

    panWrapper.addEventListener('touchend', () => { isPanning = false; });


    /* ═══════════════════════════════════════════════════════════════
       ZOOM
       ═══════════════════════════════════════════════════════════════ */
    let zoomLevel = 1;
    const ZOOM_MIN = 0.4,
        ZOOM_MAX = 1.6,
        ZOOM_STEP = 0.15;

    function applyZoom() {
        bracketContainer.style.transform = 'scale(' + zoomLevel + ')';
        bracketContainer.style.transformOrigin = 'top left';
        setTimeout(drawConnectors, 30);
    }

    zoomControls.addEventListener('click', e => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const action = btn.dataset.action;
        if (action === 'zoom-in') zoomLevel = Math.min(ZOOM_MAX, zoomLevel + ZOOM_STEP);
        if (action === 'zoom-out') zoomLevel = Math.max(ZOOM_MIN, zoomLevel - ZOOM_STEP);
        if (action === 'zoom-reset') zoomLevel = 1;
        applyZoom();
    });

    // Mouse-wheel zoom
    panWrapper.addEventListener('wheel', e => {
        if (!e.ctrlKey) return;
        e.preventDefault();
        zoomLevel = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoomLevel - e.deltaY * 0.002));
        applyZoom();
    }, { passive: false });


    /* ═══════════════════════════════════════════════════════════════
       SVG CONNECTOR LINES
       ═══════════════════════════════════════════════════════════════ */
    function drawConnectors() {
        while (svg.firstChild) svg.removeChild(svg.firstChild);

        const containerRect = bracketContainer.getBoundingClientRect();
        const scale = zoomLevel || 1;
        const w = bracketContainer.scrollWidth;
        const h = bracketContainer.scrollHeight;
        svg.setAttribute('width', w);
        svg.setAttribute('height', h);
        svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
        svg.style.width = w + 'px';
        svg.style.height = h + 'px';

        for (let r = 1; r < totalRounds; r++) {
            const sources = roundColumns[r - 1] || [];
            const targets = roundColumns[r] || [];

            targets.forEach((targetEl, tIdx) => {
                // Each target match receives two source matches (indices 2*tIdx, 2*tIdx+1)
                [2 * tIdx, 2 * tIdx + 1].forEach(sIdx => {
                    const sourceEl = sources[sIdx];
                    if (!sourceEl || !targetEl) return;

                    const sMatch = sourceEl.querySelector('.match');
                    const tMatch = targetEl.querySelector('.match');
                    if (!sMatch || !tMatch) return;

                    const sRect = sMatch.getBoundingClientRect();
                    const tRect = tMatch.getBoundingClientRect();

                    const startX = (sRect.right - containerRect.left) / scale;
                    const startY = (sRect.top - containerRect.top + sRect.height / 2) / scale;
                    const endX = (tRect.left - containerRect.left) / scale;
                    const endY = (tRect.top - containerRect.top + tRect.height / 2) / scale;
                    const midX = startX + (endX - startX) * 0.5;

                    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    path.setAttribute('d', `M${startX},${startY} C${midX},${startY} ${midX},${endY} ${endX},${endY}`);
                    path.setAttribute('fill', 'none');
                    path.setAttribute('stroke', 'rgba(255,255,255,0.08)');
                    path.setAttribute('stroke-width', '2');
                    path.setAttribute('stroke-linecap', 'round');
                    svg.appendChild(path);
                });
            });
        }
    }

    /* ── Initial draw + resize handler ────────────────────────────── */
    setTimeout(drawConnectors, 80);
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(drawConnectors, 100);
    });

    // Re-draw connectors when panWrapper scrolls
    panWrapper.addEventListener('scroll', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(drawConnectors, 40);
    });
});
// game.js
let graphData = null;
let candidates = [];
let usedNames = new Set();
let answeredNodeMap = new Map();
let bgmEnabled = false;
let bgmStarted = false;
let sidePanel = null;

const bgmAudio = document.getElementById("bgmAudio");
const sfxSuccess = document.getElementById("sfxSuccess");
const sfxFail = document.getElementById("sfxFail");
const sfxComplete = document.getElementById("sfxComplete");

if (bgmAudio) bgmAudio.volume = 0.35;
if (sfxSuccess) sfxSuccess.volume = 0.7;
if (sfxFail) sfxFail.volume = 0.7;
if (sfxComplete) sfxComplete.volume = 0.8;

const graphBox = document.getElementById("graph-box");
const svg = d3.select("#graph-box")
    .append("svg")
    .attr("width", "100%")
    .attr("height", "100%");

const g = svg.append("g");

const zoom = d3.zoom()
    .scaleExtent([0.2, 3])
    .filter((event) => {
        // 滚轮始终缩放；点在节点上时留给节点拖拽，不触发画布平移
        if (event.type === "wheel") return true;
        const el = event.target;
        if (el && el.closest && el.closest(".node")) return false;
        return !event.ctrlKey && !event.button;
    })
    .on("zoom", (event) => {
        g.attr("transform", event.transform);
    });
svg.call(zoom);

const NODE_RADIUS = 30;
const COLLIDE_RADIUS = 48;

const simulation = d3.forceSimulation()
    .force("link", d3.forceLink().id(d => d.id))
    .force("charge", d3.forceManyBody())
    .force("center", d3.forceCenter(graphBox.clientWidth / 2, graphBox.clientHeight / 2))
    .force("collide", d3.forceCollide().radius(COLLIDE_RADIUS).strength(0.9).iterations(3))
    .force("x", d3.forceX(graphBox.clientWidth / 2).strength(0.04))
    .force("y", d3.forceY(graphBox.clientHeight / 2).strength(0.04));

let linkG = g.append("g").attr("class", "links");
let nodeG = g.append("g").attr("class", "nodes");
let settleTimer = null;

function configureForces(nodeCount) {
    const w = graphBox.clientWidth || 800;
    const h = graphBox.clientHeight || 500;
    const n = Math.max(nodeCount, 1);
    const linkDist = Math.max(150, Math.min(280, 100 + n * 7));
    const charge = Math.min(-220, -160 - n * 28);

    simulation
        .force("link").distance(linkDist).strength(0.55);
    simulation
        .force("charge").strength(charge).distanceMax(Math.max(480, n * 40));
    simulation
        .force("center").x(w / 2).y(h / 2);
    simulation
        .force("collide").radius(COLLIDE_RADIUS).strength(0.95).iterations(4);
    simulation
        .force("x").x(w / 2).strength(0.03 + Math.min(0.04, n * 0.001));
    simulation
        .force("y").y(h / 2).strength(0.03 + Math.min(0.04, n * 0.001));
}

function fitGraphToView() {
    const nodes = simulation.nodes();
    if (!nodes || !nodes.length) return;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    nodes.forEach(d => {
        if (d.x == null || d.y == null) return;
        minX = Math.min(minX, d.x - NODE_RADIUS);
        maxX = Math.max(maxX, d.x + NODE_RADIUS);
        minY = Math.min(minY, d.y - NODE_RADIUS);
        maxY = Math.max(maxY, d.y + NODE_RADIUS);
    });
    if (!Number.isFinite(minX)) return;

    const width = graphBox.clientWidth;
    const height = graphBox.clientHeight;
    const pad = 56;
    const bw = Math.max(maxX - minX, 1);
    const bh = Math.max(maxY - minY, 1);
    const scale = Math.min(
        2.2,
        Math.max(0.2, 0.88 * Math.min(width / (bw + pad * 2), height / (bh + pad * 2)))
    );
    const tx = width / 2 - scale * (minX + maxX) / 2;
    const ty = height / 2 - scale * (minY + maxY) / 2;
    svg.transition().duration(450).call(
        zoom.transform,
        d3.zoomIdentity.translate(tx, ty).scale(scale)
    );
}

window.onload = async function () {
    await loadGraph();
    await loadCandidate();
    renderGraph();
    renderCandidate();
    bindReset();
    bindBgmToggle();
    initPanelDrag();
    bindSidebarToggle();
    setStatusMessage("准备开始");
}

function setStatusMessage(text) {
    const msgBar = document.getElementById("msgBar");
    if (msgBar) msgBar.textContent = text;
}

// 侧栏收起/展开切换：更新图标、无障碍属性并记忆状态
function bindSidebarToggle() {
    const app = document.getElementById("container");
    const btn = document.getElementById("sidebarToggle");
    if (!app || !btn) return;

    const collapsedIcon = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 6h18M3 12h18M3 18h18"></path>
      </svg>`;
    const expandedIcon = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 6L6 18M6 6l12 12"></path>
      </svg>`;

    const apply = (collapsed) => {
        app.classList.toggle("side-collapsed", collapsed);
        btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
        btn.title = collapsed ? "展开侧栏" : "收起侧栏";
        // 收起态：仅显示展开图标（无文字）；展开态：显示 X 图标 + “收起”
        btn.innerHTML = collapsed ? collapsedIcon : expandedIcon + "收起";
        try {
            localStorage.setItem("sideNavCollapsed", collapsed ? "1" : "0");
        } catch (_) {}
    };

    let collapsed = false;
    try {
        collapsed = localStorage.getItem("sideNavCollapsed") === "1";
    } catch (_) {}
    apply(collapsed);

    btn.onclick = function () {
        // 拖动过程中松手不触发切换
        if (sidePanel && sidePanel.__dragging) return;
        apply(!app.classList.contains("side-collapsed"));
    };
}

// 侧栏面板拖动：展开态按住顶部把手拖动；收起态按住圆形气泡拖动（位移判定区分点击展开）
function initPanelDrag() {
    const panel = document.getElementById("control-bar");
    if (!panel) return;
    sidePanel = panel;

    // 恢复记忆位置
    try {
        const x = localStorage.getItem("sideNavX");
        const y = localStorage.getItem("sideNavY");
        if (x !== null && y !== null) {
            panel.style.left = x + "px";
            panel.style.top = y + "px";
        }
    } catch (_) {}

    let sx = 0, sy = 0, ox = 0, oy = 0, dragging = false, moved = false;

    const beginDrag = (e) => {
        // 展开态下，点按底部操作按钮（重置/音乐）不触发拖动
        if (e.target.closest && e.target.closest(".side-nav__actions")) return;
        // 仅响应鼠标左键 / 触摸主触点；右键、辅助键等一律忽略
        if (e.button !== 0) return;
        dragging = true;
        moved = false;
        sx = e.clientX; sy = e.clientY;
        ox = panel.offsetLeft; oy = panel.offsetTop;
        panel.__dragging = false;
        // 注意：此处不 setPointerCapture，也不 preventDefault。
        // 一旦按下就捕获指针，会让浏览器合成的 click 事件目标从按钮变成面板，
        // 导致收起态点击气泡（以及展开态点击“收起”）无法触发 onclick。
    };

    const moveDrag = (e) => {
        if (!dragging) return;
        const dx = e.clientX - sx, dy = e.clientY - sy;
        if (!moved && Math.hypot(dx, dy) > 4) {
            moved = true;
            panel.__dragging = true;
            // 确认真正开始拖动后再捕获，保证纯点击的 click 事件不受干扰
            try { panel.setPointerCapture(e.pointerId); } catch (_) {}
        }
        if (moved) {
            const maxX = window.innerWidth - panel.offsetWidth - 6;
            const maxY = window.innerHeight - panel.offsetHeight - 6;
            panel.style.left = Math.max(6, Math.min(maxX, ox + dx)) + "px";
            panel.style.top = Math.max(6, Math.min(maxY, oy + dy)) + "px";
        }
    };

    const endDrag = (e) => {
        if (!dragging) return;
        dragging = false;
        if (moved) {
            try { panel.releasePointerCapture(e.pointerId); } catch (_) {}
            try {
                localStorage.setItem("sideNavX", panel.style.left);
                localStorage.setItem("sideNavY", panel.style.top);
            } catch (_) {}
            // 短暂保持拖拽标志，避免松手立即触发按钮点击
            setTimeout(() => { panel.__dragging = false; }, 80);
        }
    };

    panel.addEventListener("pointerdown", beginDrag);
    panel.addEventListener("pointermove", moveDrag);
    panel.addEventListener("pointerup", endDrag);
    panel.addEventListener("pointercancel", endDrag);
}

function playSfx(audioEl) {
    if (!audioEl) return;
    try {
        audioEl.currentTime = 0;
        const p = audioEl.play();
        if (p && typeof p.catch === "function") p.catch(() => {});
    } catch (_) {}
}

function tryStartBgm() {
    if (!bgmEnabled || !bgmAudio || bgmStarted) return;
    bgmAudio.play().then(() => {
        bgmStarted = true;
    }).catch(() => {});
}

function bindBgmToggle() {
    const btn = document.getElementById("bgmBtn");
    if (!btn || !bgmAudio) return;
    btn.onclick = function () {
        bgmEnabled = !bgmEnabled;
        if (bgmEnabled) {
            btn.classList.remove("muted");
            bgmAudio.play().then(() => { bgmStarted = true; }).catch(() => {});
            btn.innerHTML = `
      <svg class="icon-volume" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px;">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
      </svg>
      音乐：开
    `
        } else {
            btn.classList.add("muted");
            bgmAudio.pause();
            btn.innerHTML = `
      <svg class="icon-volume" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px;">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
        <line x1="23" y1="9" x2="17" y2="15"></line>
        <line x1="17" y1="9" x2="23" y2="15"></line>
      </svg>
      音乐：关
    `
        }
    };
}

function isGameComplete() {
    return candidates.length > 0 && usedNames.size >= candidates.length;
}

async function loadGraph() {
    const res = await fetch("/api/graph");
    const json = await res.json();
    graphData = json.data;
}

async function loadCandidate() {
    const res = await fetch("/api/candidate-list");
    const json = await res.json();
    candidates = json.data.candidates;
    usedNames.clear();
    answeredNodeMap.clear();
}

function pairKey(source, target) {
    const s = typeof source === "object" ? source.id : source;
    const t = typeof target === "object" ? target.id : target;
    return s < t ? `${s}|${t}` : `${t}|${s}`;
}

/** 同一对节点间的多条关系：分配弧度偏移，避免线与标签重叠 */
function annotateLinkBundles(links) {
    const groups = new Map();
    links.forEach(l => {
        const key = pairKey(l.source, l.target);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(l);
    });
    groups.forEach(group => {
        const count = group.length;
        const mid = (count - 1) / 2;
        group.forEach((l, i) => {
            l.pairIndex = i;
            l.pairCount = count;
            // 多条时沿垂直方向错开；单条保持直线
            l.curveOffset = count <= 1 ? 0 : (i - mid) * 34;
        });
    });
}

function linkControlPoint(d) {
    const sx = d.source.x;
    const sy = d.source.y;
    const tx = d.target.x;
    const ty = d.target.y;
    const dx = tx - sx;
    const dy = ty - sy;
    const len = Math.hypot(dx, dy) || 1;
    const px = -dy / len;
    const py = dx / len;
    const offset = d.curveOffset || 0;
    return {
        x: (sx + tx) / 2 + px * offset,
        y: (sy + ty) / 2 + py * offset
    };
}

function linkPath(d) {
    if (d.source.x == null || d.target.x == null) return "";
    const c = linkControlPoint(d);
    return `M${d.source.x},${d.source.y} Q${c.x},${c.y} ${d.target.x},${d.target.y}`;
}

function renderGraph() {
    const nodes = graphData.nodes;
    const links = graphData.relationships;
    annotateLinkBundles(links);

    linkG.selectAll(".link").remove();
    linkG.selectAll(".link-text").remove();
    nodeG.selectAll(".node").remove();

    // 绘制连线（二次贝塞尔，多关系时弧线错开）
    linkG.selectAll(".link")
        .data(links)
        .enter()
        .append("path")
        .attr("class", "link")
        .attr("fill", "none")
        .attr("stroke-width", 1)
        .attr("stroke", "#c8c6c0");

    // 绘制关系中文文字（后端已经翻译好，直接拿d.type）
    linkG.selectAll(".link-text")
        .data(links)
        .enter()
        .append("text")
        .attr("class", "link-text")
        .attr("dy", "0.35em")
        .text(d => d.type);

    // 创建节点：可拖动调整位置；仍可从候选区拖入作答
    const node = nodeG.selectAll(".node")
        .data(nodes)
        .enter()
        .append("g")
        .attr("class", "node")
        .call(d3.drag()
            .container(g.node())
            .on("start", nodeDragStarted)
            .on("drag", nodeDragged)
            .on("end", nodeDragEnded));

    node.append("circle")
        .attr("r", NODE_RADIUS)
        .attr("fill", "#f0efe9")
        .attr("stroke", "#2a2a2a")
        .attr("stroke-width", 1);

    node.append("text")
        .attr("dy", 42)
        .attr("text-anchor", "middle")
        .text(d => {
            if (answeredNodeMap.has(d.id)) {
                return answeredNodeMap.get(d.id);
            }
            return "";
        });

    // 拖拽答题逻辑（来自底部候选人物）
    node.on("dragover", e => e.preventDefault())
        .on("drop", async function (e, d) {
            e.preventDefault();
            const dragName = e.dataTransfer.getData("text/plain");
            if (!dragName || usedNames.has(dragName)) return;

            const resp = await fetch("/api/check-match", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    node_id: d.id,
                    user_answer_name: dragName
                })
            });
            const ret = await resp.json();
            const data = ret.data;

            if (data.is_correct) {
                answeredNodeMap.set(d.id, data.std_answer);
                usedNames.add(dragName);
                setStatusMessage(`✅正确！${data.std_answer}：${data.person_desc}`);
                // 局部更新当前节点文字，不重绘整张图
                d3.select(this).select("text").text(data.std_answer);
                // 答对后更新候选词列表
                renderCandidate();
                if (isGameComplete()) {
                    playSfx(sfxComplete);
                    setStatusMessage(`🎉全部答对！恭喜通关！`);
                } else {
                    playSfx(sfxSuccess);
                }
            } else {
                playSfx(sfxFail);
                setStatusMessage(`❌名字不匹配`);
                // 错误时：不做任何图谱重绘，节点保持不动
            }
        });

    // 重新布局时先解除固定，便于力导向重新排布
    nodes.forEach(d => {
        d.fx = null;
        d.fy = null;
    });

    configureForces(nodes.length);
    simulation.nodes(nodes);
    simulation.force("link").links(links);
    simulation.alpha(1).restart();

    simulation.on("tick", () => {
        linkG.selectAll(".link").attr("d", linkPath);

        linkG.selectAll(".link-text")
            .attr("x", d => linkControlPoint(d).x)
            .attr("y", d => linkControlPoint(d).y);

        nodeG.selectAll(".node")
            .attr("transform", d => `translate(${d.x},${d.y})`);
    });

    // 数据越多，布局沉降时间越长；结束后固定坐标，便于用户自行拖开
    if (settleTimer) clearTimeout(settleTimer);
    const settleMs = Math.min(9000, 2800 + nodes.length * 140);
    settleTimer = setTimeout(() => {
        pinAllNodes();
        simulation.stop();
        fitGraphToView();
    }, settleMs);
}

function pinAllNodes() {
    simulation.nodes().forEach(d => {
        if (d.x != null && d.y != null) {
            d.fx = d.x;
            d.fy = d.y;
        }
    });
}

function nodeDragStarted(event, d) {
    if (settleTimer) {
        clearTimeout(settleTimer);
        settleTimer = null;
    }
    if (!event.active) simulation.alphaTarget(0.18).restart();
    d.fx = d.x;
    d.fy = d.y;
}

function nodeDragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
}

function nodeDragEnded(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    // 松手后固定在当前位置，避免弹回重叠
    d.fx = d.x;
    d.fy = d.y;
    simulation.stop();
}

function renderCandidate() {
    const wrap = document.getElementById("candidate-list-wrap");
    wrap.innerHTML = "";
    candidates.forEach(name => {
        const div = document.createElement("div");
        div.className = "candidate-item";
        if (usedNames.has(name)) div.classList.add("used");
        div.textContent = name;
        div.draggable = true;
        div.addEventListener("dragstart", (e) => {
            e.dataTransfer.setData("text/plain", name);
        })
        wrap.appendChild(div);
    })
}

function bindReset() {
    document.getElementById("resetBtn").onclick = async function () {
        usedNames.clear();
        answeredNodeMap.clear();
        setStatusMessage("准备开始");
        svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity);
        renderGraph();
        renderCandidate();
    }
}

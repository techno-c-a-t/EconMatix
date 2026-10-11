/**
 * Экономический Атлас (EconMatrix) - Core Engine v2.5
 * Сквозное сравнение любых двух школ во всех разделах,
 * историческое дерево генеалогии преемственности и анализ мультиколлинеарности
 */

(function () {
  'use strict';

  // Глобальные данные из data.js
  const DATA = window.ECONOMIC_DATA;
  if (!DATA) {
    console.error('Ошибка: window.ECONOMIC_DATA не найден. Проверьте подключение data.js.');
    return;
  }

  const { schools, factors, matrix, transposed_matrix, analytics } = DATA;

  // ── ДИНАМИЧЕСКИЙ АНАЛИЗ МУЛЬТИКОЛЛИНЕАРНОСТИ И ВЫБОР ЧИСЛА ОБУСЛОВЛЕННОСТИ ──
  const multiCol = analytics.multicollinearity || {};
  const stepsList = multiCol.steps || [];
  const maxStep = stepsList.length > 0 ? stepsList.length - 1 : 10;
  const initialCond = multiCol.original_condition_number || 193.8668;
  const minCond = stepsList.length > 0 ? stepsList[maxStep].condition_number : (multiCol.final_condition_number || 169.9909);

  let currentStepIndex = maxStep; // По умолчанию: шаг 10 (оптимум)
  let currentTargetCond = minCond; // По умолчанию: 169.99
  let removedIndicesSet = new Set(stepsList[currentStepIndex] ? stepsList[currentStepIndex].removed_indices : (multiCol.removed_indices || []));

  // Категории факторов
  const CATEGORIES = Array.from(new Set(factors.map(f => f.category)));

  // Группировка школ по историко-теоретическим семьям для стилизации
  const SCHOOL_FAMILIES = {
    liberal: ['classical', 'austrian', 'chicago_monetarism', 'new_classical', 'public_choice', 'supply_side', 'ordoliberalism', 'school_of_salamanca', 'anarcho_capitalism', 'constitutional_economics'],
    left: ['marxism', 'neo_marxism', 'market_socialism'],
    keynesian: ['stockholm', 'original_keynesian', 'neoclassical_synthesis', 'post_keynesian', 'new_keynesian', 'modern_monetary_theory', 'nordic_social_democracy'],
    institutional: ['old_institutionalism', 'new_institutional', 'evolutionary', 'behavioral'],
    historical_state: ['mercantilism', 'physiocracy', 'old_historical', 'young_historical', 'dirigisme', 'structuralism_eclac', 'ecological_economics', 'feminist_economics', 'lausanne', 'cambridge_neoclassical']
  };

  const FAMILY_COLORS = {
    liberal: '#00f0ff',        // Cyan
    left: '#ef4444',           // Red
    keynesian: '#f59e0b',      // Amber
    institutional: '#8b5cf6',  // Purple
    historical_state: '#10b981'// Emerald
  };

  function getSchoolFamily(schoolId) {
    for (const [family, ids] of Object.entries(SCHOOL_FAMILIES)) {
      if (ids.includes(schoolId)) return family;
    }
    return 'historical_state';
  }

  function getSchoolColor(schoolId) {
    const fam = getSchoolFamily(schoolId);
    return FAMILY_COLORS[fam] || '#94a3b8';
  }

  // Причины коллинеарности для удаленных факторов (объяснение для аналитика)
  const COLLINEARITY_REASONS = {
    "f21_capital_flow_controls": "Сильно коллинеарен с протекционизмом (f19, r=+0.89) и Laissez-faire (f04, r=-0.84).",
    "f01_state_intervention": "Обратная почти совершенная линейная зависимость с Laissez-faire (f04, r=-0.94) и дублирование госсоownership (f02).",
    "f16_progressive_income_tax": "Высокая мультиколлинеарность с социальным государством (f31, r=+0.91) и антипод налогам предложения (f17).",
    "f17_supply_side_tax_cuts": "Линейная комбинация низких налогов и неоклассического предложения (зеркально прогрессивному налогу).",
    "f39_underconsumption_effective_demand": "Коллинеарен с бюджетным стимулом (f14, r=+0.90) и эндогенными кризисами (f37, r=+0.87).",
    "f03_indicative_planning": "Избыточная корреляция со структурализмом, дирижизмом и вмешательством государства (f01, r=+0.88).",
    "f06_government_failure_primacy": "Обратная коллинеарность с государственным планированием и социальным государством (f31).",
    "f34_minimum_wage_support": "Практически дублирует усиление профсоюзов (f32, r=+0.89) и социальное государство (f31, r=+0.88).",
    "f31_welfare_state_expansion": "Центральный узел высокой коллинеарности блока социальных гарантий (r > 0.85 с 5 факторами).",
    "f11_endogenous_money_theory": "Коллинеарность внутри гетеродоксного финансового кластера (с посткейнсианством и ММТ)."
  };

  /* ─────────────────────────────────────────────────────────────────────────
     ГЛОБАЛЬНОЕ СОСТОЯНИЕ СКВОЗНОГО СРАВНЕНИЯ (GLOBAL DUAL-COMPARATOR)
  ───────────────────────────────────────────────────────────────────────── */
  let schoolAId = 'marxism';
  let schoolBId = 'neo_marxism';

  function setGlobalSchools(newA, newB) {
    if (newA) schoolAId = newA;
    if (newB) schoolBId = newB;

    // Синхронизируем выпадающие списки в шапке
    const selectA = document.getElementById('global-select-school-a');
    const selectB = document.getElementById('global-select-school-b');
    if (selectA) selectA.value = schoolAId;
    if (selectB) selectB.value = schoolBId;

    // Обновляем плашку взаимосвязи
    updateGlobalRelationshipBadge();

    // Обновляем все разделы
    renderHeatmap();
    drawPcaCanvas();
    renderRadar();
    renderDifferences();
    renderSimilarityGauge();
    renderGenealogyTree();
    if (typeof renderArena === 'function') {
      renderArena();
    }
  }

  function initGlobalComparisonBar() {
    const selectA = document.getElementById('global-select-school-a');
    const selectB = document.getElementById('global-select-school-b');
    const swapBtn = document.getElementById('btn-swap-schools');

    schools.forEach(s => {
      const optA = new Option(s.name_ru, s.id);
      const optB = new Option(s.name_ru, s.id);
      selectA.appendChild(optA);
      selectB.appendChild(optB);
    });

    selectA.value = schoolAId;
    selectB.value = schoolBId;

    selectA.addEventListener('change', (e) => {
      setGlobalSchools(e.target.value, null);
    });

    selectB.addEventListener('change', (e) => {
      setGlobalSchools(null, e.target.value);
    });

    swapBtn.addEventListener('click', () => {
      setGlobalSchools(schoolBId, schoolAId);
    });

    // Пресеты дуэлей
    const duelBtns = document.querySelectorAll('.duel-btn');
    duelBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const s1 = btn.getAttribute('data-s1');
        const s2 = btn.getAttribute('data-s2');
        setGlobalSchools(s1, s2);
      });
    });

    updateGlobalRelationshipBadge();
  }

  /* ─────────────────────────────────────────────────────────────────────────
     АНАЛИЗ ГЕНЕАЛОГИЧЕСКОЙ ВЗАИМОСВЯЗИ МЕЖДУ ШКОЛОЙ А И ШКОЛОЙ Б
  ───────────────────────────────────────────────────────────────────────── */
  const genealogyTree = analytics.genealogy_tree;

  // Поиск пути от корня к целевому ID
  function findPathToNode(node, targetId, currentPath = []) {
    const newPath = [...currentPath, node];
    if (node.school_id === targetId || node.id === targetId) {
      return newPath;
    }
    for (const child of (node.children || [])) {
      const res = findPathToNode(child, targetId, newPath);
      if (res) return res;
    }
    return null;
  }

  function analyzeRelationship(idA, idB) {
    const pathA = findPathToNode(genealogyTree, idA);
    const pathB = findPathToNode(genealogyTree, idB);

    if (!pathA || !pathB) {
      return { type: 'unknown', text: 'Связь не определена', badge: 'Раздельные', lca: null };
    }

    // Ищем Lowest Common Ancestor (LCA)
    let lca = null;
    const minLen = Math.min(pathA.length, pathB.length);
    for (let i = 0; i < minLen; i++) {
      if (pathA[i].id === pathB[i].id) {
        lca = pathA[i];
      } else {
        break;
      }
    }

    const schoolA = schools.find(s => s.id === idA);
    const schoolB = schools.find(s => s.id === idB);

    // Случай 1: А является предком Б
    if (pathB.some(n => n.school_id === idA)) {
      const depth = pathB.length - pathA.length;
      return {
        type: 'descendant',
        badge: 'Потомок (Преемственность)',
        badgeClass: 'badge-emerald',
        text: `<strong>${schoolB.name_ru}</strong> является прямым дочерним продолжением <strong>${schoolA.name_ru}</strong> (дистанция: ${depth} пок.).`,
        lca: schoolA
      };
    }

    // Случай 2: Б является предком А
    if (pathA.some(n => n.school_id === idB)) {
      const depth = pathA.length - pathB.length;
      return {
        type: 'ancestor',
        badge: 'Предок (Исток)',
        badgeClass: 'badge-cyan',
        text: `<strong>${schoolA.name_ru}</strong> есть прямое развитие традиций школы <strong>${schoolB.name_ru}</strong> (дистанция: ${depth} пок.).`,
        lca: schoolB
      };
    }

    // Случай 3: Соседи в одной развилке (параллельные взгляды одной эпохи)
    if (lca && lca.is_virtual && pathA.length === pathB.length && pathA.length - 1 === pathA.indexOf(lca) + 1) {
      return {
        type: 'peers',
        badge: 'Современники / Параллельные',
        badgeClass: 'badge-amber',
        text: `Школы возникли как два альтернативных взгляда в один исторический период в рамках развилки: <em>${lca.name}</em>.`,
        lca: lca
      };
    }

    // Случай 4: Общий предок
    if (lca) {
      const lcaName = lca.is_virtual ? lca.name : lca.name;
      return {
        type: 'common_ancestor',
        badge: 'Общий предок',
        badgeClass: 'badge-purple',
        text: `Обе традиции имеют общий исторический корень: <strong>${lcaName}</strong>, от которого эволюционировали по разным траекториям.`,
        lca: lca
      };
    }

    return {
      type: 'independent',
      badge: 'Разные традиции',
      badgeClass: 'badge-muted',
      text: `Школы принадлежат к разным историческим эпохам и методологическим парадигмам.`,
      lca: null
    };
  }

  function updateGlobalRelationshipBadge() {
    const rel = analyzeRelationship(schoolAId, schoolBId);
    const badgeEl = document.getElementById('global-rel-badge');
    const descEl = document.getElementById('global-rel-desc');

    if (badgeEl) {
      badgeEl.textContent = rel.badge;
    }
    if (descEl) {
      descEl.innerHTML = rel.text;
    }
  }

  /* ─────────────────────────────────────────────────────────────────────────
     1. ИНИЦИАЛИЗАЦИЯ И ВКЛАДКИ
  ───────────────────────────────────────────────────────────────────────── */
  function updateContextualPanels(targetTab) {
    if (!targetTab) {
      const activeBtn = document.querySelector('.nav-tab.active');
      targetTab = activeBtn ? activeBtn.getAttribute('data-tab') : 'compass';
    }

    const isV1 = document.body.classList.contains('mode-v1');
    const dualSvdPanel = document.getElementById('dual-svd-panel');
    const compareBar = document.getElementById('global-compare-bar');

    // 1. Двойной SVD-индикатор: строго только там, где реально происходит сжатие (2D Карта и Матрица)
    const svdRelevantTabs = ['pca', 'heatmap'];
    if (dualSvdPanel) {
      const shouldShowSvd = !isV1 && svdRelevantTabs.includes(targetTab);
      dualSvdPanel.classList.toggle('contextual-hidden', !shouldShowSvd);
    }

    // 2. Сквозной бар выбора двух школ для сравнения:
    // Показывается ТОЛЬКО там, где пользователь изучает конкретную пару школ:
    // - genealogy (генеалогическая связь и общий предок в древе),
    // - compare (радар 9 сфер в v1).
    // На 2D Карте, в Сводной Матрице, SVD Лаборатории, Компасе и Арене он полностью скрыт.
    const compareRelevantTabs = ['genealogy', 'compare'];
    if (compareBar) {
      const shouldShowCompare = compareRelevantTabs.includes(targetTab);
      compareBar.classList.toggle('contextual-hidden', !shouldShowCompare);
    }
  }

  function initTabs() {
    const tabBtns = document.querySelectorAll('.nav-tab');
    const panes = document.querySelectorAll('.tab-pane');

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        
        tabBtns.forEach(b => b.classList.remove('active'));
        panes.forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        const activePane = document.getElementById(`pane-${targetTab}`);
        if (activePane) activePane.classList.add('active');

        // Управление видимостью контекстных панелей (SVD индикатор и селектор сравнения)
        updateContextualPanels(targetTab);

        // Триггер перерисовки холстов при активации вкладки
        if (targetTab === 'compass') setTimeout(renderCompass, 40);
        if (targetTab === 'arena') setTimeout(renderArena, 40);
        if (targetTab === 'pca') setTimeout(drawPcaCanvas, 40);
        if (targetTab === 'multicollinearity') setTimeout(drawSvdScreeCanvas, 40);
        if (targetTab === 'compare') setTimeout(renderRadar, 40);
        if (targetTab === 'genealogy') setTimeout(renderGenealogyTree, 40);
      });
    });

    window.addEventListener('resize', () => {
      drawPcaCanvas();
      drawSvdScreeCanvas();
      renderRadar();
      renderGenealogyTree();
    });

    // Инициализация видимости панелей для активной вкладки
    const initialActive = document.querySelector('.nav-tab.active')?.getAttribute('data-tab') || 'compass';
    updateContextualPanels(initialActive);
  }

  /* ─────────────────────────────────────────────────────────────────────────
     2. ТЕПЛОВАЯ КАРТА (HEATMAP) & РЕЖИМ СРАВНЕНИЯ ФАКТОРОВ
  ───────────────────────────────────────────────────────────────────────── */
  let currentHeatmapMode = 'original'; // 'original' | 'comparison' | 'cleaned' | 'transposed'
  let currentCategoryFilter = 'all';
  let searchQuery = '';
  let heatmapMergedDisplayMode = 'archive'; // 'archive' (внизу с пояснениями) | 'hide' (вырезать)

  function initHeatmapControls() {
    const modeBtns = document.querySelectorAll('#matrix-view-mode .segment-btn');
    modeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        modeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentHeatmapMode = btn.getAttribute('data-mode');
        renderHeatmap();
      });
    });

    const btnToggleMerged = document.getElementById('btn-toggle-heatmap-merged');
    const labelMergedMode = document.getElementById('label-heatmap-merged-mode');
    if (btnToggleMerged) {
      btnToggleMerged.addEventListener('click', () => {
        heatmapMergedDisplayMode = (heatmapMergedDisplayMode === 'archive') ? 'hide' : 'archive';
        if (labelMergedMode) {
          labelMergedMode.textContent = (heatmapMergedDisplayMode === 'archive')
            ? '📋 Слитые: внизу с пояснениями'
            : '✂️ Слитые: вырезаны (чистый срез)';
        }
        renderHeatmap();
      });
    }

    const catSelect = document.getElementById('category-filter');
    CATEGORIES.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = `${cat}`;
      catSelect.appendChild(opt);
    });

    catSelect.addEventListener('change', (e) => {
      currentCategoryFilter = e.target.value;
      renderHeatmap();
    });

    const searchInput = document.getElementById('search-input');
    const clearBtn = document.getElementById('btn-clear-search');

    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim().toLowerCase();
      clearBtn.classList.toggle('visible', searchQuery.length > 0);
      renderHeatmap();
    });

    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      searchQuery = '';
      clearBtn.classList.remove('visible');
      renderHeatmap();
    });

    const heatmapSlider = document.getElementById('heatmap-slider-cond');
    if (heatmapSlider) {
      heatmapSlider.addEventListener('input', (e) => {
        applyConditionState(parseFloat(e.target.value), null, 'heatmap-slider');
      });
    }

    initHeatmapDelegation();
  }

  // Расчет цвета ячейки от -1 до +1
  function getScoreColor(val) {
    if (val < 0) {
      const t = Math.abs(val); // 0 to 1
      const r = Math.round(30 + (220 - 30) * t);
      const g = Math.round(41 + (38 - 41) * t);
      const b = Math.round(59 + (38 - 59) * t);
      const a = 0.25 + 0.70 * t;
      return `rgba(${r}, ${g}, ${b}, ${a})`;
    } else {
      const t = val; // 0 to 1
      const r = Math.round(30 + (0 - 30) * t);
      const g = Math.round(41 + (240 - 41) * t);
      const b = Math.round(59 + (255 - 59) * t);
      const a = 0.25 + 0.70 * t;
      return `rgba(${r}, ${g}, ${b}, ${a})`;
    }
  }

  function getTextColor(val) {
    if (Math.abs(val) > 0.4) return '#ffffff';
    return '#94a3b8';
  }

  function renderHeatmap() {
    const container = document.getElementById('matrix-table-container');
    container.innerHTML = '';

    const sIdxA = schools.findIndex(s => s.id === schoolAId);
    const sIdxB = schools.findIndex(s => s.id === schoolBId);
    const schoolA = schools[sIdxA];
    const schoolB = schools[sIdxB];

    // Определяем видимые факторы с учетом активных и слитых по SVD
    const activeFactorIndices = [];
    const mergedFactorIndices = [];

    factors.forEach((f, idx) => {
      if (currentHeatmapMode === 'cleaned' && removedIndicesSet.has(idx)) {
        return;
      }
      if (currentCategoryFilter !== 'all' && f.category !== currentCategoryFilter) {
        return;
      }
      if (searchQuery) {
        const factorMatch = f.name_ru.toLowerCase().includes(searchQuery) || f.category.toLowerCase().includes(searchQuery);
        if (!factorMatch) return;
      }

      const isMerged = !v2ActiveFactorIndices.includes(idx);
      if (isMerged) {
        mergedFactorIndices.push(idx);
      } else {
        activeFactorIndices.push(idx);
      }
    });

    const visibleFactorIndices = (heatmapMergedDisplayMode === 'hide') 
      ? activeFactorIndices 
      : [...activeFactorIndices, ...mergedFactorIndices];

    if (visibleFactorIndices.length === 0) {
      container.innerHTML = `<div style="padding: 40px; text-align: center; color: var(--text-secondary);">По запросу «${searchQuery}» ничего не найдено</div>`;
      return;
    }

    const table = document.createElement('table');
    table.className = 'matrix-table';

    // ── РЕЖИМ 1: СРАВНЕНИЕ (ТОЛЬКО ШКОЛА А vs ШКОЛА Б) ─────────────────────
    if (currentHeatmapMode === 'comparison') {
      const thead = document.createElement('thead');
      const headerRow = document.createElement('tr');
      
      const cornerTh = document.createElement('th');
      cornerTh.className = 'school-col-header';
      cornerTh.innerHTML = `<strong>Сравнение взглядов</strong><br><span style="font-size:10px; font-weight:normal; color:var(--text-muted);">Критериев: ${visibleFactorIndices.length}</span>`;
      headerRow.appendChild(cornerTh);

      visibleFactorIndices.forEach(fIdx => {
        const factor = factors[fIdx];
        const th = document.createElement('th');
        th.className = 'col-header-vertical';
        th.textContent = `#${fIdx + 1} ${factor.name_ru}`;
        th.title = `${factor.name_ru} (${factor.category})`;
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);

      const tbody = document.createElement('tbody');

      // Строка 1: Школа А
      const trA = document.createElement('tr');
      trA.className = 'comp-row-a';
      const thA = document.createElement('td');
      thA.className = 'school-row-header';
      thA.innerHTML = `<div>🔵 ${schoolA.name_ru}</div><div style="font-size:10px; color:var(--text-muted);">Школа А (${schoolA.period})</div>`;
      trA.appendChild(thA);

      visibleFactorIndices.forEach(fIdx => {
        const val = matrix[sIdxA][fIdx];
        const td = document.createElement('td');
        td.className = 'matrix-cell';
        td.dataset.sidx = sIdxA;
        td.dataset.fidx = fIdx;
        td.style.backgroundColor = getScoreColor(val);
        td.style.color = getTextColor(val);
        td.textContent = (val > 0 ? '+' : '') + val.toFixed(1);
        trA.appendChild(td);
      });
      tbody.appendChild(trA);

      // Строка 2: Школа Б
      const trB = document.createElement('tr');
      trB.className = 'comp-row-b';
      const thB = document.createElement('td');
      thB.className = 'school-row-header';
      thB.innerHTML = `<div>🔴 ${schoolB.name_ru}</div><div style="font-size:10px; color:var(--text-muted);">Школа Б (${schoolB.period})</div>`;
      trB.appendChild(thB);

      visibleFactorIndices.forEach(fIdx => {
        const val = matrix[sIdxB][fIdx];
        const td = document.createElement('td');
        td.className = 'matrix-cell';
        td.dataset.sidx = sIdxB;
        td.dataset.fidx = fIdx;
        td.style.backgroundColor = getScoreColor(val);
        td.style.color = getTextColor(val);
        td.textContent = (val > 0 ? '+' : '') + val.toFixed(1);
        trB.appendChild(td);
      });
      tbody.appendChild(trB);

      // Строка 3: Разность Δ = (A - B)
      const trDelta = document.createElement('tr');
      trDelta.className = 'comp-row-delta';
      const thDelta = document.createElement('td');
      thDelta.className = 'school-row-header';
      thDelta.innerHTML = `<div>Разность Δ (А − Б)</div><div style="font-size:10px; color:var(--text-muted);">Полярность позиций</div>`;
      trDelta.appendChild(thDelta);

      visibleFactorIndices.forEach(fIdx => {
        const valA = matrix[sIdxA][fIdx];
        const valB = matrix[sIdxB][fIdx];
        const delta = valA - valB; // [-2.0, 2.0]
        const td = document.createElement('td');
        td.className = 'matrix-cell delta-cell';
        
        // Цвет разности: если delta > 0 перевес у А (cyan), если delta < 0 перевес у Б (crimson)
        const t = Math.min(Math.abs(delta) / 2.0, 1.0);
        if (delta > 0) {
          td.style.backgroundColor = `rgba(0, 240, 255, ${0.15 + 0.65 * t})`;
          td.style.color = '#fff';
        } else if (delta < 0) {
          td.style.backgroundColor = `rgba(239, 68, 68, ${0.15 + 0.65 * t})`;
          td.style.color = '#fff';
        } else {
          td.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
          td.style.color = '#94a3b8';
        }
        td.textContent = (delta > 0 ? '+' : '') + delta.toFixed(1);
        td.title = `Разность Δ = ${delta.toFixed(2)} (${schoolA.name_ru}: ${valA} vs ${schoolB.name_ru}: ${valB})`;
        trDelta.appendChild(td);
      });
      tbody.appendChild(trDelta);

      // Строка 4: Статус согласованности
      const trStatus = document.createElement('tr');
      trStatus.className = 'comp-row-status';
      const thStatus = document.createElement('td');
      thStatus.className = 'school-row-header';
      thStatus.innerHTML = `<div>Консенсус / Диссонанс</div><div style="font-size:10px; color:var(--text-muted);">Оценка сходимости</div>`;
      trStatus.appendChild(thStatus);

      visibleFactorIndices.forEach(fIdx => {
        const valA = matrix[sIdxA][fIdx];
        const valB = matrix[sIdxB][fIdx];
        const diff = Math.abs(valA - valB);
        const td = document.createElement('td');
        td.className = 'matrix-cell status-cell';

        if (diff <= 0.35) {
          td.style.color = 'var(--accent-emerald)';
          td.textContent = 'Согласие';
        } else if (diff >= 1.2) {
          td.style.color = 'var(--accent-crimson)';
          td.textContent = 'Антагонизм';
        } else {
          td.style.color = 'var(--accent-amber)';
          td.textContent = 'Спор';
        }
        trStatus.appendChild(td);
      });
      tbody.appendChild(trStatus);

      table.appendChild(tbody);

    // ── РЕЖИМ 2: ТРАНСПОНИРОВАННАЯ МАТРИЦА ─────────────────────────────────
    } else if (currentHeatmapMode === 'transposed') {
      const activeSchools = [];
      const mergedSchools = [];
      schools.forEach((s, sIdx) => {
        if (!v2ActiveSchoolIndices.includes(sIdx)) {
          mergedSchools.push({ s, sIdx });
        } else {
          activeSchools.push({ s, sIdx });
        }
      });
      const visibleSchools = (heatmapMergedDisplayMode === 'hide') ? activeSchools : [...activeSchools, ...mergedSchools];

      const thead = document.createElement('thead');
      const headerRow = document.createElement('tr');
      
      const cornerTh = document.createElement('th');
      cornerTh.className = 'school-col-header';
      cornerTh.innerHTML = `<strong>Критерий / Фактор</strong><br><span style="font-size:10px; font-weight:normal; color:var(--text-muted);">${visibleSchools.length} школ</span>`;
      headerRow.appendChild(cornerTh);

      visibleSchools.forEach(({ s, sIdx }) => {
        const th = document.createElement('th');
        th.className = 'col-header-vertical';
        const isMerged = !v2ActiveSchoolIndices.includes(sIdx);
        if (isMerged) th.classList.add('merged-factor-header');
        if (s.id === schoolAId) th.style.color = 'var(--accent-cyan)';
        if (s.id === schoolBId) th.style.color = 'var(--accent-crimson)';
        th.textContent = (s.id === schoolAId ? '🔵 ' : (s.id === schoolBId ? '🔴 ' : '')) + s.name_ru + (isMerged ? ' [Слита]' : '');
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);

      const tbody = document.createElement('tbody');

      function renderTransposedRow(fIdx, isMerged) {
        const factor = factors[fIdx];
        const tr = document.createElement('tr');
        if (isMerged) tr.className = 'merged-school-row';

        const rowTh = document.createElement('td');
        rowTh.className = 'school-row-header';
        rowTh.innerHTML = `<span style="font-size: 10px; color: var(--text-muted); margin-right: 6px;">#${fIdx + 1}</span> ${factor.name_ru} ${isMerged ? '<span class="badge-merged-partner">[Слит]</span>' : ''}`;
        tr.appendChild(rowTh);

        visibleSchools.forEach(({ s, sIdx }) => {
          const val = matrix[sIdx][fIdx];
          const td = document.createElement('td');
          td.className = 'matrix-cell';
          td.dataset.sidx = sIdx;
          td.dataset.fidx = fIdx;
          if (isMerged) td.classList.add('merged-factor-cell');
          if (s.id === schoolAId) td.style.outline = '1px solid var(--accent-cyan)';
          if (s.id === schoolBId) td.style.outline = '1px solid var(--accent-crimson)';
          td.style.backgroundColor = getScoreColor(val);
          td.style.color = getTextColor(val);
          td.textContent = (val > 0 ? '+' : '') + val.toFixed(1);
          tr.appendChild(td);
        });

        tbody.appendChild(tr);
      }

      // Активные факторы
      activeFactorIndices.forEach(fIdx => {
        renderTransposedRow(fIdx, false);
      });

      // Слитые факторы внизу (если режим archive)
      if (heatmapMergedDisplayMode === 'archive' && mergedFactorIndices.length > 0) {
        const dividerTr = document.createElement('tr');
        dividerTr.className = 'merged-section-divider';
        const dividerTd = document.createElement('td');
        dividerTd.colSpan = visibleSchools.length + 1;
        dividerTd.innerHTML = `
          <div class="merged-divider-content">
            <span class="merged-divider-title">📋 Слитые критерии (${mergedFactorIndices.length}) — перемещены в архив</span>
            <span class="merged-divider-hint">Исключены по мультиколлинеарности SVD</span>
          </div>
        `;
        dividerTr.appendChild(dividerTd);
        tbody.appendChild(dividerTr);

        mergedFactorIndices.forEach(fIdx => {
          renderTransposedRow(fIdx, true);
        });
      }

      table.appendChild(tbody);

    // ── РЕЖИМ 3: ПОЛНАЯ / ОЧИЩЕННАЯ МАТРИЦА ────────────────────────────────
    } else {
      // 1. Разбиваем школы на активные и слитые
      const activeSchools = [];
      const mergedSchools = [];

      schools.forEach((school, sIdx) => {
        if (searchQuery) {
          const schoolMatch = school.name_ru.toLowerCase().includes(searchQuery) ||
                              school.name_en.toLowerCase().includes(searchQuery);
          const anyFactorMatch = factors.some(f => (f.name_ru.toLowerCase().includes(searchQuery) || f.category.toLowerCase().includes(searchQuery)));
          if (!schoolMatch && !anyFactorMatch) return;
        }

        const isMerged = !v2ActiveSchoolIndices.includes(sIdx);
        if (isMerged) {
          mergedSchools.push({ school, sIdx });
        } else {
          activeSchools.push({ school, sIdx });
        }
      });

      const thead = document.createElement('thead');
      const headerRow = document.createElement('tr');

      const cornerTh = document.createElement('th');
      cornerTh.className = 'school-col-header';
      const shapeText = `${activeSchools.length} акт.` + 
        (mergedSchools.length > 0 && heatmapMergedDisplayMode === 'archive' ? ` + ${mergedSchools.length} слит.` : '');
      cornerTh.innerHTML = `<strong>Школы (${shapeText})</strong><br><span style="font-size:10px; font-weight:normal; color:var(--text-muted);">${visibleFactorIndices.length} критериев</span>`;
      headerRow.appendChild(cornerTh);

      visibleFactorIndices.forEach(fIdx => {
        const factor = factors[fIdx];
        const th = document.createElement('th');
        th.className = 'col-header-vertical';
        const isMergedFactor = !v2ActiveFactorIndices.includes(fIdx);
        const isStaticRemoved = removedIndicesSet.has(fIdx);

        if (isMergedFactor) {
          th.classList.add('merged-factor-header');
          const mergedInfo = window.v2MergedFactorsMap?.get(fIdx);
          const partnerName = mergedInfo ? factors[mergedInfo.partnerIndex]?.name_ru : '';
          th.textContent = `#${fIdx + 1} ${factor.name_ru} [Слит]`;
          th.title = `Слит по SVD мультиколлинеарности с #${(mergedInfo?.partnerIndex || 0) + 1} (${partnerName})`;
        } else if (isStaticRemoved && currentHeatmapMode === 'cleaned') {
          th.classList.add('removed-header');
          th.textContent = `#${fIdx + 1} ${factor.name_ru}`;
          th.title = `${factor.name_ru} (${factor.category})`;
        } else {
          th.textContent = `#${fIdx + 1} ${factor.name_ru}`;
          th.title = `${factor.name_ru} (${factor.category})`;
        }
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);

      const tbody = document.createElement('tbody');

      function renderSchoolRow(school, sIdx, isMerged) {
        const tr = document.createElement('tr');
        const isA = school.id === schoolAId;
        const isB = school.id === schoolBId;

        if (isMerged) tr.className = 'merged-school-row';
        if (isA) tr.classList.add('comp-row-a');
        if (isB) tr.classList.add('comp-row-b');

        const rowTh = document.createElement('td');
        rowTh.className = 'school-row-header';
        rowTh.style.borderLeft = `3px solid ${isA ? 'var(--accent-cyan)' : (isB ? 'var(--accent-crimson)' : getSchoolColor(school.id))}`;

        let partnerBadge = '';
        if (isMerged) {
          const mergedData = window.v2MergedSchoolsMap?.get(school.id);
          const partnerId = typeof mergedData === 'object' ? mergedData.partnerId : mergedData;
          const partner = schools.find(s => s.id === partnerId);
          const partnerName = partner ? partner.name_ru : 'Базовая школа';
          partnerBadge = `<div class="badge-merged-partner">Слита с: ${partnerName}</div>`;
        }

        rowTh.innerHTML = `<div>${isA ? '🔵 ' : (isB ? '🔴 ' : '')}${school.name_ru}</div><div style="font-size: 10px; font-weight: 400; color: var(--text-muted);">${school.period}</div>${partnerBadge}`;
        tr.appendChild(rowTh);

        visibleFactorIndices.forEach(fIdx => {
          const val = matrix[sIdx][fIdx];
          const td = document.createElement('td');
          td.className = 'matrix-cell';
          td.dataset.sidx = sIdx;
          td.dataset.fidx = fIdx;
          const isMergedFactor = !v2ActiveFactorIndices.includes(fIdx);
          if (isMergedFactor) {
            td.classList.add('merged-factor-cell');
          }
          td.style.backgroundColor = getScoreColor(val);
          td.style.color = getTextColor(val);
          td.textContent = (val > 0 ? '+' : '') + val.toFixed(1);
          tr.appendChild(td);
        });

        tbody.appendChild(tr);
      }

      // 1. Рендерим активные школы
      activeSchools.forEach(({ school, sIdx }) => {
        renderSchoolRow(school, sIdx, false);
      });

      // 2. Если режим 'archive' и есть слитые школы — выводим разделитель и строки слитых школ внизу
      if (heatmapMergedDisplayMode === 'archive' && mergedSchools.length > 0) {
        const dividerTr = document.createElement('tr');
        dividerTr.className = 'merged-section-divider';
        const dividerTd = document.createElement('td');
        dividerTd.colSpan = visibleFactorIndices.length + 1;
        dividerTd.innerHTML = `
          <div class="merged-divider-content">
            <span class="merged-divider-title">🏛️ Слитые школы (${mergedSchools.length}) — перемещены в архив</span>
            <span class="merged-divider-hint">Объединены с наиболее близкими школами по SVD-мультиколлинеарности</span>
          </div>
        `;
        dividerTr.appendChild(dividerTd);
        tbody.appendChild(dividerTr);

        mergedSchools.forEach(({ school, sIdx }) => {
          renderSchoolRow(school, sIdx, true);
        });
      }

      table.appendChild(tbody);
    }

    container.appendChild(table);
  }

  // Floating Tooltip Engine с event delegation (высокая производительность 60+ FPS)
  const tooltip = document.getElementById('floating-tooltip');
  let heatmapDelegationInitialized = false;

  function initHeatmapDelegation() {
    const container = document.getElementById('matrix-table-container');
    const scrollContainer = document.getElementById('heatmap-scroll-container');
    if (!container || heatmapDelegationInitialized) return;
    heatmapDelegationInitialized = true;

    // При прокрутке мгновенно скрываем плавающий тултип, не блокируя композитор
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', () => {
        if (tooltip && !tooltip.classList.contains('hidden')) {
          tooltip.classList.add('hidden');
        }
      }, { passive: true });
    }

    container.addEventListener('mouseover', (e) => {
      const td = e.target.closest('.matrix-cell');
      if (!td || td.classList.contains('delta-cell')) return;
      const sIdx = parseInt(td.dataset.sidx, 10);
      const fIdx = parseInt(td.dataset.fidx, 10);
      if (isNaN(sIdx) || isNaN(fIdx)) return;
      showCellTooltip(sIdx, fIdx, matrix[sIdx][fIdx], e);
    });

    container.addEventListener('mousemove', (e) => {
      if (tooltip && !tooltip.classList.contains('hidden')) {
        updateTooltipPos(e);
      }
    });

    container.addEventListener('mouseout', (e) => {
      const td = e.target.closest('.matrix-cell');
      if (td && (!e.relatedTarget || !e.relatedTarget.closest('.matrix-cell'))) {
        if (tooltip) tooltip.classList.add('hidden');
      }
    });
  }

  function showCellTooltip(sIdx, fIdx, val, e) {
    if (!tooltip) return;
    const school = schools[sIdx];
    const factor = factors[fIdx];
    if (!school || !factor) return;

    const isRemoved = removedIndicesSet.has(fIdx);

    let verbalStance = 'Нейтрально / Индифферентно';
    if (val >= 0.75) verbalStance = 'Фундаментальный приоритет учения';
    else if (val >= 0.25) verbalStance = 'Умеренная поддержка';
    else if (val <= -0.75) verbalStance = 'Категорическое отрицание';
    else if (val <= -0.25) verbalStance = 'Существенное несогласие';

    tooltip.innerHTML = `
      <div class="tooltip-school-title" style="color: ${getSchoolColor(school.id)}">${school.name_ru}</div>
      <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 6px;">${school.period} • ${school.key_figures.slice(0, 2).join(', ')}</div>
      <div class="tooltip-factor-name">${factor.name_ru}</div>
      <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 8px;">${factor.description}</div>
      <div class="tooltip-score-row">
        <span class="tooltip-category-tag">${factor.category}</span>
        <span class="tooltip-score-badge" style="background: ${getScoreColor(val)}; color: ${getTextColor(val)}">
          ${val > 0 ? '+' : ''}${val.toFixed(2)} (${verbalStance})
        </span>
      </div>
      ${isRemoved ? `<div style="margin-top: 6px; font-size: 10px; color: var(--accent-crimson); font-weight: 600;">⚠️ Строка ${fIdx + 1} удалена при анализе мультиколлинеарности</div>` : ''}
    `;

    tooltip.classList.remove('hidden');
    updateTooltipPos(e);
  }

  function updateTooltipPos(e) {
    const pad = 15;
    let x = e.clientX + pad;
    let y = e.clientY + pad;
    
    if (x + 320 > window.innerWidth) x = e.clientX - 330;
    if (y + 180 > window.innerHeight) y = e.clientY - 190;

    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
  }

  /* ─────────────────────────────────────────────────────────────────────────
     3. 2D КАРТА ИДЕОЛОГИЙ (PCA CANVAS) & DUAL COMPARATOR
  ───────────────────────────────────────────────────────────────────────── */
  let pcaCanvas, pcaCtx;
  let showPcaVectors = true;
  let pcaTransform = { k: 1.0, x: 0, y: 0 };

  function initPca() {
    pcaCanvas = document.getElementById('pca-canvas');
    if (!pcaCanvas) return;
    pcaCtx = pcaCanvas.getContext('2d');

    const toggleVectors = document.getElementById('toggle-pca-vectors');
    if (toggleVectors) {
      toggleVectors.addEventListener('change', (e) => {
        showPcaVectors = e.target.checked;
        drawPcaCanvas();
      });
    }

    const toggleHideMerged = document.getElementById('toggle-pca-hide-merged');
    if (toggleHideMerged) {
      toggleHideMerged.addEventListener('change', () => {
        drawPcaCanvas();
      });
    }

    const resetBtn = document.getElementById('btn-reset-pca-zoom');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        pcaTransform = { k: 1.0, x: 0, y: 0 };
        drawPcaCanvas();
      });
    }

    pcaCanvas.addEventListener('click', handlePcaClick);
    renderPcaDualInspector();
  }

  function drawPcaCanvas() {
    if (!pcaCanvas || !pcaCtx) return;
    const dpr = window.devicePixelRatio || 1;
    const width = pcaCanvas.clientWidth || pcaCanvas.parentElement?.clientWidth || 950;
    const height = 620;

    const targetW = Math.round(width * dpr);
    const targetH = Math.round(height * dpr);
    if (pcaCanvas.width !== targetW || pcaCanvas.height !== targetH) {
      pcaCanvas.width = targetW;
      pcaCanvas.height = targetH;
    }
    pcaCtx.setTransform(1, 0, 0, 1, 0, 0);
    pcaCtx.scale(dpr, dpr);

    pcaCtx.clearRect(0, 0, width, height);

    // Центр координат
    const cx = width / 2 + pcaTransform.x;
    const cy = height / 2 + pcaTransform.y;
    const scale = 58 * pcaTransform.k;

    // Сетка
    pcaCtx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    pcaCtx.lineWidth = 1;
    for (let x = cx % 40; x < width; x += 40) {
      pcaCtx.beginPath();
      pcaCtx.moveTo(x, 0);
      pcaCtx.lineTo(x, height);
      pcaCtx.stroke();
    }
    for (let y = cy % 40; y < height; y += 40) {
      pcaCtx.beginPath();
      pcaCtx.moveTo(0, y);
      pcaCtx.lineTo(width, y);
      pcaCtx.stroke();
    }

    // Оси PC1 и PC2
    pcaCtx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    pcaCtx.lineWidth = 1.5;
    pcaCtx.beginPath();
    pcaCtx.moveTo(0, cy);
    pcaCtx.lineTo(width, cy);
    pcaCtx.stroke();

    pcaCtx.beginPath();
    pcaCtx.moveTo(cx, 0);
    pcaCtx.lineTo(cx, height);
    pcaCtx.stroke();

    // 1. Векторы факторов (Biplot)
    if (showPcaVectors && analytics.pca.factors) {
      pcaCtx.font = '9px JetBrains Mono';
      analytics.pca.factors.forEach((f) => {
        const factorLen = Math.sqrt(f.x * f.x + f.y * f.y);
        if (factorLen < 0.25) return;

        const vx = cx + f.x * scale * 3.5;
        const vy = cy - f.y * scale * 3.5;

        pcaCtx.strokeStyle = f.is_removed_in_cleaned ? 'rgba(239, 68, 68, 0.4)' : 'rgba(0, 240, 255, 0.25)';
        pcaCtx.lineWidth = 1;
        pcaCtx.beginPath();
        pcaCtx.moveTo(cx, cy);
        pcaCtx.lineTo(vx, vy);
        pcaCtx.stroke();

        pcaCtx.fillStyle = f.is_removed_in_cleaned ? 'rgba(239, 68, 68, 0.7)' : 'rgba(0, 240, 255, 0.6)';
        pcaCtx.fillText(f.name_ru.slice(0, 24), vx + 4, vy + 3);
      });
    }

    // 2. Линия расстояния между Школой А и Школой Б
    const pcaSchools = analytics.pca.schools;
    const pA = pcaSchools.find(s => s.id === schoolAId);
    const pB = pcaSchools.find(s => s.id === schoolBId);

    if (pA && pB) {
      const ax = cx + pA.x * scale;
      const ay = cy - pA.y * scale;
      const bx = cx + pB.x * scale;
      const by = cy - pB.y * scale;

      pcaCtx.strokeStyle = 'rgba(245, 158, 11, 0.75)';
      pcaCtx.lineWidth = 2;
      pcaCtx.setLineDash([5, 5]);
      pcaCtx.beginPath();
      pcaCtx.moveTo(ax, ay);
      pcaCtx.lineTo(bx, by);
      pcaCtx.stroke();
      pcaCtx.setLineDash([]);

      const dist = Math.hypot(pA.x - pB.x, pA.y - pB.y);
      const distEl = document.getElementById('pca-dist-ab');
      if (distEl) distEl.textContent = `${dist.toFixed(2)} ед.`;
    }

    const hideMergedPca = document.getElementById('toggle-pca-hide-merged')?.checked;

    // 2.5. Линии слияния школ (Dual SVD Reducer Links)
    if (window.v2MergedSchoolsMap && window.v2MergedSchoolsMap.size > 0 && !hideMergedPca) {
      pcaCtx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      pcaCtx.lineWidth = 1;
      pcaCtx.setLineDash([3, 4]);
      window.v2MergedSchoolsMap.forEach((meta, removedId) => {
        const partnerId = typeof meta === 'object' ? meta.partnerId : meta;
        const sRem = pcaSchools.find(s => s.id === removedId);
        const sPart = pcaSchools.find(s => s.id === partnerId);
        if (sRem && sPart) {
          const rx = cx + sRem.x * scale;
          const ry = cy - sRem.y * scale;
          const px = cx + sPart.x * scale;
          const py = cy - sPart.y * scale;
          pcaCtx.beginPath();
          pcaCtx.moveTo(rx, ry);
          pcaCtx.lineTo(px, py);
          pcaCtx.stroke();
        }
      });
      pcaCtx.setLineDash([]);
    }

    // 3. Точки школ
    pcaSchools.forEach((s) => {
      const isA = s.id === schoolAId;
      const isB = s.id === schoolBId;
      const isSelected = isA || isB;
      const isMerged = window.v2MergedSchoolsMap && window.v2MergedSchoolsMap.has(s.id);

      // Если включено сокрытие слитых школ — отбрасываем их с холста
      if (isMerged && !isSelected && hideMergedPca) {
        return;
      }

      const px = cx + s.x * scale;
      const py = cy - s.y * scale;
      const color = isA ? '#00f0ff' : (isB ? '#ef4444' : getSchoolColor(s.id));

      pcaCtx.save();
      if (isMerged && !isSelected) {
        pcaCtx.globalAlpha = 0.35;
      }

      if (isSelected) {
        pcaCtx.beginPath();
        pcaCtx.arc(px, py, 14, 0, Math.PI * 2);
        pcaCtx.fillStyle = isA ? 'rgba(0, 240, 255, 0.25)' : 'rgba(239, 68, 68, 0.25)';
        pcaCtx.fill();
        pcaCtx.strokeStyle = color;
        pcaCtx.lineWidth = 2.5;
        pcaCtx.stroke();
      }

      pcaCtx.beginPath();
      pcaCtx.arc(px, py, isSelected ? 8 : (isMerged ? 4.5 : 6), 0, Math.PI * 2);
      pcaCtx.fillStyle = color;
      pcaCtx.fill();
      pcaCtx.strokeStyle = '#fff';
      pcaCtx.lineWidth = isMerged ? 1 : 1.5;
      pcaCtx.stroke();

      pcaCtx.font = isSelected ? '700 12px Inter' : (isMerged ? '400 9.5px Inter' : '500 10.5px Inter');
      pcaCtx.fillStyle = isSelected ? '#ffffff' : (isMerged ? 'rgba(255, 255, 255, 0.45)' : 'rgba(248, 250, 252, 0.85)');
      const labelPrefix = isA ? '🔵 ' : (isB ? '🔴 ' : '');
      const labelSuffix = isMerged ? ' (слито)' : '';
      pcaCtx.fillText(labelPrefix + s.name_ru + labelSuffix, px + 10, py + 4);

      pcaCtx.restore();
    });

    renderPcaDualInspector();
  }

  function handlePcaClick(e) {
    const rect = pcaCanvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const width = rect.width;
    const cx = width / 2 + pcaTransform.x;
    const cy = 310 + pcaTransform.y;
    const scale = 58 * pcaTransform.k;

    let nearest = null;
    let minDist = 22;

    analytics.pca.schools.forEach(s => {
      const px = cx + s.x * scale;
      const py = cy - s.y * scale;
      const dist = Math.hypot(clickX - px, clickY - py);
      if (dist < minDist) {
        minDist = dist;
        nearest = s;
      }
    });

    if (nearest) {
      // Клик переключает Школу Б (для быстрого сравнения с Школой А)
      if (nearest.id !== schoolAId) {
        setGlobalSchools(null, nearest.id);
      } else {
        setGlobalSchools(nearest.id, schoolBId);
      }
    }
  }

  function renderPcaDualInspector() {
    const details = document.getElementById('inspector-details');
    if (!details) return;

    const sA = schools.find(s => s.id === schoolAId);
    const sB = schools.find(s => s.id === schoolBId);
    if (!sA || !sB) return;

    const idxA = schools.indexOf(sA);
    const idxB = schools.indexOf(sB);
    const sim = analytics.similarity.school_similarity_matrix[idxA][idxB];

    details.innerHTML = `
      <div style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight: 700; margin-bottom: 8px;">
        Сравнительный анализ на карте
      </div>

      <!-- School A -->
      <div style="background: var(--bg-surface); border-left: 3px solid var(--accent-cyan); padding: 10px 12px; border-radius: var(--radius-sm); margin-bottom: 10px;">
        <div style="font-size: 14px; font-weight: 700; color: var(--accent-cyan);">🔵 ${sA.name_ru}</div>
        <div style="font-size: 11px; color: var(--text-muted);">${sA.period}</div>
        <div style="font-size: 11.5px; color: var(--text-secondary); margin-top: 4px;">${sA.key_figures.join(', ')}</div>
      </div>

      <!-- School B -->
      <div style="background: var(--bg-surface); border-left: 3px solid var(--accent-crimson); padding: 10px 12px; border-radius: var(--radius-sm); margin-bottom: 14px;">
        <div style="font-size: 14px; font-weight: 700; color: var(--accent-crimson);">🔴 ${sB.name_ru}</div>
        <div style="font-size: 11px; color: var(--text-muted);">${sB.period}</div>
        <div style="font-size: 11.5px; color: var(--text-secondary); margin-top: 4px;">${sB.key_figures.join(', ')}</div>
      </div>

      <!-- Similarity Gauge -->
      <div style="padding: 10px; background: rgba(139, 92, 246, 0.1); border-radius: var(--radius-sm); border: 1px solid rgba(139, 92, 246, 0.25); margin-bottom: 14px;">
        <div style="font-size: 11px; color: var(--text-muted);">Косинусное сходство:</div>
        <div style="font-family: var(--font-mono); font-size: 16px; font-weight: 700; color: ${sim >= 0 ? 'var(--accent-cyan)' : 'var(--accent-crimson)'}">
          ${sim > 0 ? '+' : ''}${sim.toFixed(3)}
        </div>
      </div>

      <div style="font-size: 11px; color: var(--text-muted); line-height: 1.4;">
        💡 Нажмите на любую другую точку на карте, чтобы сделать её <strong>Школой Б</strong> для сравнения.
      </div>
    `;
  }

  /* ─────────────────────────────────────────────────────────────────────────
     4. МНОГОУГОЛЬНИК СРАВНЕНИЯ (9-ОСЕВОЙ РАДАР)
  ───────────────────────────────────────────────────────────────────────── */
  function renderSimilarityGauge() {
    const container = document.getElementById('similarity-gauge-container');
    if (!container) return;

    const idx1 = schools.findIndex(s => s.id === schoolAId);
    const idx2 = schools.findIndex(s => s.id === schoolBId);
    
    if (idx1 < 0 || idx2 < 0) return;

    const sim = analytics.similarity.school_similarity_matrix[idx1][idx2];
    const simPct = Math.round(((sim + 1) / 2) * 100);

    let interpret = 'Нейтральное отношение';
    let colorClass = 'text-amber';
    if (sim >= 0.70) { interpret = 'Очень высокое сродство'; colorClass = 'text-cyan'; }
    else if (sim >= 0.30) { interpret = 'Умеренное сходство'; colorClass = 'text-emerald'; }
    else if (sim <= -0.70) { interpret = 'Фундаментальный антагонизм'; colorClass = 'text-crimson'; }
    else if (sim <= -0.30) { interpret = 'Существенные расхождения'; colorClass = 'text-amber'; }

    container.innerHTML = `
      <div class="sim-metric-group">
        <span class="sim-label">Косинусное сходство векторов:</span>
        <span class="sim-val-pill ${colorClass}">${sim > 0 ? '+' : ''}${sim.toFixed(3)} (${simPct}% совпадения)</span>
      </div>
      <div style="font-size: 12px; color: var(--text-secondary); font-style: italic;">${interpret}</div>
    `;
  }

  function renderRadar() {
    const canvas = document.getElementById('radar-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width > 50 ? rect.width : (canvas.parentElement?.clientWidth || 540);
    const height = 420;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) / 2 - 50;
    const numAxes = CATEGORIES.length; // 9 категорий

    function getCategoryAverages(schoolId) {
      const sIdx = schools.findIndex(s => s.id === schoolId);
      if (sIdx < 0) return null;
      const row = matrix[sIdx];

      return CATEGORIES.map(cat => {
        const catFactors = factors.map((f, i) => ({ f, val: row[i] })).filter(item => item.f.category === cat);
        const sum = catFactors.reduce((acc, cur) => acc + cur.val, 0);
        return sum / catFactors.length;
      });
    }

    const avgs1 = getCategoryAverages(schoolAId);
    const avgs2 = getCategoryAverages(schoolBId);

    // Рисуем круговую паутину радара
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;

    for (let r = 0.25; r <= 1.0; r += 0.25) {
      ctx.beginPath();
      for (let i = 0; i < numAxes; i++) {
        const angle = (Math.PI * 2 / numAxes) * i - Math.PI / 2;
        const x = cx + Math.cos(angle) * (radius * r);
        const y = cy + Math.sin(angle) * (radius * r);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }

    // Оси и подписи
    ctx.font = '10px Inter';
    ctx.fillStyle = '#94a3b8';
    for (let i = 0; i < numAxes; i++) {
      const angle = (Math.PI * 2 / numAxes) * i - Math.PI / 2;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(x, y);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.stroke();

      const labelX = cx + Math.cos(angle) * (radius + 20);
      const labelY = cy + Math.sin(angle) * (radius + 18);
      ctx.textAlign = Math.abs(Math.cos(angle)) < 0.2 ? 'center' : (Math.cos(angle) > 0 ? 'left' : 'right');
      ctx.fillText(CATEGORIES[i], labelX, labelY);
    }

    function drawSchoolPolygon(avgs, color) {
      ctx.beginPath();
      avgs.forEach((val, i) => {
        const norm = (val + 1) / 2;
        const r = radius * (0.15 + 0.85 * norm);
        const angle = (Math.PI * 2 / numAxes) * i - Math.PI / 2;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fillStyle = color.replace('1)', '0.25)');
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    if (avgs1) drawSchoolPolygon(avgs1, 'rgba(0, 240, 255, 1)');
    if (avgs2) drawSchoolPolygon(avgs2, 'rgba(239, 68, 68, 1)');
  }

  function renderDifferences() {
    const list = document.getElementById('diff-factors-list');
    if (!list) return;
    list.innerHTML = '';

    const s1 = schools.find(s => s.id === schoolAId);
    const s2 = schools.find(s => s.id === schoolBId);
    if (!s1 || !s2) return;

    const idx1 = schools.indexOf(s1);
    const idx2 = schools.indexOf(s2);

    const diffs = factors.map((f, i) => {
      const v1 = matrix[idx1][i];
      const v2 = matrix[idx2][i];
      const delta = Math.abs(v1 - v2);
      return { factor: f, v1, v2, delta };
    }).sort((a, b) => b.delta - a.delta);

    diffs.slice(0, 8).forEach(item => {
      const div = document.createElement('div');
      div.className = 'diff-item';
      div.innerHTML = `
        <div class="diff-header">
          <span class="diff-factor-name">${item.factor.name_ru}</span>
          <span class="diff-magnitude-badge">Разрыв: Δ ${item.delta.toFixed(2)}</span>
        </div>
        <div class="diff-scores-row">
          <div class="diff-school-score">
            <span style="color: var(--accent-cyan); font-weight: 600;">🔵 ${s1.name_ru}:</span>
            <span class="delta-badge" style="background: ${getScoreColor(item.v1)}; color: ${getTextColor(item.v1)}">
              ${item.v1 > 0 ? '+' : ''}${item.v1.toFixed(1)}
            </span>
          </div>
          <div class="diff-school-score">
            <span style="color: var(--accent-crimson); font-weight: 600;">🔴 ${s2.name_ru}:</span>
            <span class="delta-badge" style="background: ${getScoreColor(item.v2)}; color: ${getTextColor(item.v2)}">
              ${item.v2 > 0 ? '+' : ''}${item.v2.toFixed(1)}
            </span>
          </div>
        </div>
      `;
      list.appendChild(div);
    });
  }

  /* ─────────────────────────────────────────────────────────────────────────
     5. ДЕРЕВО ПРОИСХОЖДЕНИЯ (ИСТОРИЧЕСКАЯ ГЕНЕАЛОГИЯ)
  ───────────────────────────────────────────────────────────────────────── */
  function renderGenealogyTree() {
    const svg = document.getElementById('genealogy-svg');
    if (!svg) return;
    svg.innerHTML = '';

    const banner = document.getElementById('genealogy-path-banner');
    const rel = analyzeRelationship(schoolAId, schoolBId);
    const pathA = findPathToNode(genealogyTree, schoolAId) || [];
    const pathB = findPathToNode(genealogyTree, schoolBId) || [];

    const activeNodeIds = new Set([
      ...pathA.map(n => n.id),
      ...pathB.map(n => n.id)
    ]);

    // Обновляем баннер над деревом
    if (banner) {
      banner.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
          <span style="font-size: 13px; font-weight: 700; color: #fff;">Траектория преемственности:</span>
          <span class="path-step-badge" style="border-color: var(--accent-cyan); color: var(--accent-cyan);">🔵 ${schools.find(s=>s.id===schoolAId)?.name_ru}</span>
          <span style="color: var(--accent-amber); font-weight: 700;">⟷</span>
          <span class="path-step-badge" style="border-color: var(--accent-crimson); color: var(--accent-crimson);">🔴 ${schools.find(s=>s.id===schoolBId)?.name_ru}</span>
          <span style="font-size: 12.5px; color: var(--text-secondary); margin-left: 8px;">${rel.text}</span>
        </div>
      `;
    }

    // Рассчитываем координаты узлов дерева (иерархическая раскладка)
    // Листья размещаются по вертикали, уровни по горизонтали
    let leafCounter = 0;
    const rowH = 26;
    const colW = 215;
    const startX = 40;
    const startY = 50;

    function layoutTree(node, depth = 0) {
      node.depth = depth;
      node.x = startX + depth * colW;

      if (!node.children || node.children.length === 0) {
        node.y = startY + leafCounter * rowH;
        leafCounter++;
      } else {
        node.children.forEach(ch => layoutTree(ch, depth + 1));
        const firstY = node.children[0].y;
        const lastY = node.children[node.children.length - 1].y;
        node.y = (firstY + lastY) / 2;
      }
    }
    layoutTree(genealogyTree);

    // Стрелочный маркер для связей
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
      <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 9 5 L 0 9 z" fill="rgba(255, 255, 255, 0.3)"/>
      </marker>
      <marker id="arrow-active" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 1 L 9 5 L 0 9 z" fill="#f59e0b"/>
      </marker>
    `;
    svg.appendChild(defs);

    // Отрисовка ветвей (линий связи)
    function drawTreeLinks(node) {
      if (!node.children) return;

      node.children.forEach(child => {
        const isPathActive = activeNodeIds.has(node.id) && activeNodeIds.has(child.id);

        const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const midX = (node.x + child.x) / 2;
        const d = `M ${node.x} ${node.y} C ${midX} ${node.y}, ${midX} ${child.y}, ${child.x} ${child.y}`;
        
        pathEl.setAttribute('d', d);
        pathEl.setAttribute('fill', 'none');
        pathEl.setAttribute('stroke', isPathActive ? '#f59e0b' : 'rgba(255, 255, 255, 0.15)');
        pathEl.setAttribute('stroke-width', isPathActive ? '2.5' : '1.2');
        pathEl.setAttribute('marker-end', isPathActive ? 'url(#arrow-active)' : 'url(#arrow)');
        if (isPathActive) {
          pathEl.setAttribute('filter', 'drop-shadow(0 0 4px #f59e0b)');
        }
        svg.appendChild(pathEl);

        drawTreeLinks(child);
      });
    }
    drawTreeLinks(genealogyTree);

    // Отрисовка узлов
    function drawTreeNodes(node) {
      const isA = node.school_id === schoolAId;
      const isB = node.school_id === schoolBId;
      const isLCA = rel.lca && (rel.lca.id === node.id || rel.lca.school_id === node.school_id);
      const isPathActive = activeNodeIds.has(node.id);

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.style.cursor = node.school_id ? 'pointer' : 'default';

      if (node.is_virtual) {
        // Виртуальный хаб / развилка эпохи
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', node.x - 6);
        rect.setAttribute('y', node.y - 12);
        rect.setAttribute('width', 12);
        rect.setAttribute('height', 24);
        rect.setAttribute('rx', 4);
        rect.setAttribute('fill', isPathActive ? 'rgba(245, 158, 11, 0.25)' : 'rgba(255, 255, 255, 0.05)');
        rect.setAttribute('stroke', isLCA ? '#f59e0b' : (isPathActive ? '#f59e0b' : 'rgba(255, 255, 255, 0.3)'));
        rect.setAttribute('stroke-dasharray', '3,3');
        g.appendChild(rect);

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', node.x + 12);
        text.setAttribute('y', node.y + 4);
        text.setAttribute('fill', isLCA ? '#f59e0b' : '#94a3b8');
        text.setAttribute('font-family', 'Inter, sans-serif');
        text.setAttribute('font-size', '10.5px');
        text.setAttribute('font-style', 'italic');
        text.textContent = `[${node.name}]${isLCA ? ' ★ Общий предок' : ''}`;
        g.appendChild(text);

      } else {
        // Реальная экономическая школа
        const color = isA ? '#00f0ff' : (isB ? '#ef4444' : getSchoolColor(node.school_id));

        if (isA || isB || isLCA) {
          const glowCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          glowCircle.setAttribute('cx', node.x);
          glowCircle.setAttribute('cy', node.y);
          glowCircle.setAttribute('r', '12');
          glowCircle.setAttribute('fill', isA ? 'rgba(0, 240, 255, 0.3)' : (isB ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'));
          glowCircle.setAttribute('stroke', isA ? '#00f0ff' : (isB ? '#ef4444' : '#f59e0b'));
          glowCircle.setAttribute('stroke-width', '1.5');
          g.appendChild(glowCircle);
        }

        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', node.x);
        circle.setAttribute('cy', node.y);
        circle.setAttribute('r', isA || isB ? '6' : '4.5');
        circle.setAttribute('fill', color);
        circle.setAttribute('stroke', '#ffffff');
        circle.setAttribute('stroke-width', '1');
        g.appendChild(circle);

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', node.x + 12);
        text.setAttribute('y', node.y + 4);
        text.setAttribute('fill', isA ? '#00f0ff' : (isB ? '#ef4444' : '#f8fafc'));
        text.setAttribute('font-family', 'Inter, sans-serif');
        text.setAttribute('font-size', isA || isB ? '12px' : '11px');
        text.setAttribute('font-weight', isA || isB ? '700' : '500');
        text.textContent = (isA ? '🔵 ' : (isB ? '🔴 ' : '')) + node.name + (isLCA ? ' ★ [Общий предок]' : '');
        g.appendChild(text);

        // Клик по школе меняет Школу Б для сравнения
        if (node.school_id) {
          g.addEventListener('click', () => {
            if (node.school_id !== schoolAId) {
              setGlobalSchools(null, node.school_id);
            } else {
              setGlobalSchools(node.school_id, schoolBId);
            }
          });
        }
      }

      svg.appendChild(g);

      if (node.children) {
        node.children.forEach(ch => drawTreeNodes(ch));
      }
    }
    drawTreeNodes(genealogyTree);

    // Кнопка фокуса
    const focusBtn = document.getElementById('btn-focus-tree-ab');
    if (focusBtn) {
      focusBtn.onclick = () => {
        // Прокручиваем к LCA
        const lcaNode = rel.lca || genealogyTree;
        const wrapper = document.getElementById('genealogy-viewport-wrapper');
        if (wrapper && lcaNode) {
          wrapper.scrollTo({
            top: Math.max(0, lcaNode.y - 150),
            left: Math.max(0, lcaNode.x - 100),
            behavior: 'smooth'
          });
        }
      };
    }
  }

  /* ─────────────────────────────────────────────────────────────────────────
     6. АНАЛИЗ МУЛЬТИКОЛЛИНЕАРНОСТИ & ВЫБОР ЧИСЛА ОБУСЛОВЛЕННОСТИ
  ───────────────────────────────────────────────────────────────────────── */
  function applyConditionState(targetCond, stepIdx, triggerSource) {
    if (stepIdx === null || stepIdx === undefined) {
      if (targetCond === null || targetCond === undefined || isNaN(targetCond)) {
        targetCond = minCond;
      }
      targetCond = parseFloat(targetCond);
      if (targetCond >= initialCond - 1e-4) {
        stepIdx = 0;
      } else {
        let found = false;
        for (let i = 0; i < stepsList.length; i++) {
          if (stepsList[i].condition_number <= targetCond + 1e-4) {
            stepIdx = i;
            found = true;
            break;
          }
        }
        if (!found) {
          stepIdx = maxStep;
        }
      }
    } else {
      stepIdx = Math.max(0, Math.min(maxStep, parseInt(stepIdx, 10)));
      if (targetCond === null || targetCond === undefined || isNaN(targetCond)) {
        targetCond = stepsList[stepIdx] ? stepsList[stepIdx].condition_number : minCond;
      }
    }

    currentStepIndex = stepIdx;
    currentTargetCond = targetCond;

    const currentStepData = stepsList[currentStepIndex] || {
      condition_number: currentTargetCond,
      removed_indices: []
    };

    removedIndicesSet = new Set(currentStepData.removed_indices);

    // 1. Обновляем элементы управления (слайдеры, поля ввода)
    const sliderTarget = document.getElementById('slider-target-cond');
    if (sliderTarget && triggerSource !== 'slider') {
      sliderTarget.value = Math.max(minCond, Math.min(initialCond, targetCond));
    }

    const sliderValDisplay = document.getElementById('slider-cond-val');
    if (sliderValDisplay) {
      sliderValDisplay.textContent = targetCond.toFixed(2);
    }

    const directInput = document.getElementById('input-direct-cond');
    if (directInput && triggerSource !== 'direct' && document.activeElement !== directInput) {
      directInput.value = targetCond.toFixed(2);
    }

    const sliderSteps = document.getElementById('slider-steps-count');
    if (sliderSteps && triggerSource !== 'steps-slider') {
      sliderSteps.value = currentStepIndex;
    }

    const sliderStepsVal = document.getElementById('slider-steps-val');
    if (sliderStepsVal) {
      sliderStepsVal.textContent = `${currentStepIndex} из ${maxStep} шагов`;
    }

    const stepBadgeSummary = document.getElementById('step-badge-summary');
    if (stepBadgeSummary) {
      stepBadgeSummary.textContent = `Останется ${50 - currentStepIndex} факторов`;
    }

    // 2. Быстрый слайдер в шапке Heatmap
    const heatmapSlider = document.getElementById('heatmap-slider-cond');
    if (heatmapSlider && triggerSource !== 'heatmap-slider') {
      heatmapSlider.value = Math.max(minCond, Math.min(initialCond, targetCond));
    }

    const heatmapQuickBadge = document.getElementById('heatmap-quick-cond-badge');
    if (heatmapQuickBadge) {
      heatmapQuickBadge.textContent = `Cond ≤ ${targetCond.toFixed(2)}`;
    }

    const heatmapDimBadge = document.getElementById('heatmap-quick-dim-badge');
    if (heatmapDimBadge) {
      heatmapDimBadge.textContent = `${50 - currentStepIndex} факторов`;
    }

    const btnCleaned = document.getElementById('btn-view-cleaned');
    if (btnCleaned) {
      btnCleaned.textContent = `Очищенная (34×${50 - currentStepIndex})`;
    }

    // 3. KPI-плашки регулятора
    const dispTarget = document.getElementById('disp-target-cond');
    if (dispTarget) dispTarget.textContent = targetCond.toFixed(2);

    const dispActual = document.getElementById('disp-actual-cond');
    if (dispActual) dispActual.textContent = currentStepData.condition_number.toFixed(2);

    const dispRemoved = document.getElementById('disp-removed-count');
    if (dispRemoved) dispRemoved.textContent = `${currentStepIndex} / 50`;

    const dispDim = document.getElementById('disp-matrix-dim');
    if (dispDim) dispDim.textContent = `${50 - currentStepIndex} × 34`;

    // 4. Hero Stats
    const heroFinalCond = document.getElementById('hero-stat-final-cond');
    if (heroFinalCond) heroFinalCond.textContent = currentStepData.condition_number.toFixed(2);

    const heroRemovedCount = document.getElementById('hero-stat-removed-count');
    if (heroRemovedCount) heroRemovedCount.textContent = `${currentStepIndex} / 50`;

    const heroRemaining = document.getElementById('hero-stat-sub-remaining');
    if (heroRemaining) heroRemaining.textContent = `Осталось ${50 - currentStepIndex} факторов`;

    const heroSubSteps = document.getElementById('hero-stat-sub-steps');
    if (heroSubSteps) heroSubSteps.textContent = `Шаг ${currentStepIndex} из ${maxStep}`;

    const heroDelta = document.getElementById('hero-stat-delta-cond');
    if (heroDelta) {
      const delta = initialCond - currentStepData.condition_number;
      heroDelta.textContent = delta.toFixed(2);
    }

    const heroPct = document.getElementById('hero-stat-sub-pct');
    if (heroPct) {
      const pct = ((initialCond - currentStepData.condition_number) / initialCond) * 100;
      heroPct.textContent = `Снижение: -${pct.toFixed(1)}%`;
    }

    // 5. Метрика в шапке сайта
    const headerCond = document.getElementById('metric-cond-final');
    if (headerCond) {
      headerCond.textContent = currentStepData.condition_number.toFixed(2);
    }

    // 6. Активные классы для пресетов
    document.querySelectorAll('.cond-preset-btn').forEach(btn => {
      const pSteps = parseInt(btn.getAttribute('data-steps'), 10);
      const pTarget = parseFloat(btn.getAttribute('data-target'));
      const isMatch = (pSteps === currentStepIndex) || (Math.abs(pTarget - targetCond) < 0.2);
      btn.classList.toggle('active', isMatch);
    });

    // 7. Шаговые пилюли (0..10)
    document.querySelectorAll('.step-pill').forEach(pill => {
      const pStep = parseInt(pill.getAttribute('data-step'), 10);
      pill.classList.toggle('active', pStep === currentStepIndex);
    });

    // 8. Ticks под слайдером
    document.querySelectorAll('.tick-label').forEach(tick => {
      const tCond = parseFloat(tick.getAttribute('data-cond'));
      tick.classList.toggle('active', Math.abs(tCond - targetCond) < 1.0);
    });

    // 9. Подсветка строк в таблице истории удаления
    const rows = document.querySelectorAll('#tbody-removal-history tr');
    rows.forEach(row => {
      const rowStep = parseInt(row.getAttribute('data-step'), 10);
      const isActive = rowStep <= currentStepIndex;
      row.classList.toggle('row-removed-active', isActive);
      row.classList.toggle('row-removed-inactive', !isActive);

      const statusBadge = row.querySelector('.step-status-badge');
      if (statusBadge) {
        if (isActive) {
          statusBadge.className = 'step-status-badge badge-step-active';
          statusBadge.textContent = '✓ Исключен';
        } else {
          statusBadge.className = 'step-status-badge badge-step-inactive';
          statusBadge.textContent = '— Сохранен';
        }
      }
    });

    // 10. Перерисовка SVD Scree Canvas
    drawSvdScreeCanvas();

    // 11. Перерисовка матрицы факторов
    renderHeatmap();
  }

  function initMulticollinearityView() {
    const tbody = document.getElementById('tbody-removal-history');
    if (!tbody) return;
    tbody.innerHTML = '';

    const history = analytics.multicollinearity.removal_history;
    history.forEach(item => {
      const tr = document.createElement('tr');
      tr.setAttribute('data-step', item.step);
      tr.style.cursor = 'pointer';
      tr.title = `Нажмите, чтобы выбрать уровень фильтрации до шага #${item.step} (Cond = ${item.condition_after.toFixed(2)})`;
      const reason = COLLINEARITY_REASONS[item.factor_id] || "Высокая мультиколлинеарность в подпространстве институциональных факторов.";
      tr.innerHTML = `
        <td style="font-weight: 700; color: var(--accent-cyan); font-family: var(--font-mono);">#${item.step}</td>
        <td><span class="step-status-badge badge-step-active">✓ Исключен</span></td>
        <td style="font-family: var(--font-mono); color: var(--text-muted);">${item.factor_index}</td>
        <td style="font-weight: 600;">${item.factor_name}</td>
        <td><span class="tooltip-category-tag">${item.category}</span></td>
        <td style="font-family: var(--font-mono);">${item.condition_before.toFixed(2)}</td>
        <td style="font-family: var(--font-mono); color: var(--accent-emerald); font-weight: 700;">${item.condition_after.toFixed(2)}</td>
        <td><span class="delta-badge">+${item.delta.toFixed(3)}</span></td>
        <td style="font-size: 11.5px; color: var(--text-secondary);">${reason}</td>
      `;
      tr.addEventListener('click', () => {
        applyConditionState(null, item.step, 'table');
      });
      tbody.appendChild(tr);
    });

    // Генерация шаговых пилюль (0..10)
    const pillsContainer = document.getElementById('step-pills-container');
    if (pillsContainer) {
      pillsContainer.innerHTML = '';
      for (let s = 0; s <= maxStep; s++) {
        const pill = document.createElement('button');
        pill.type = 'button';
        pill.className = `step-pill ${s === currentStepIndex ? 'active' : ''}`;
        pill.setAttribute('data-step', s);
        pill.textContent = s;
        pill.title = s === 0 ? 'Исходная матрица (0 удалений, Cond = 193.87)' : `Шаг ${s}: ${s} удалено, Cond = ${stepsList[s] ? stepsList[s].condition_number.toFixed(2) : ''}`;
        pill.addEventListener('click', () => {
          applyConditionState(null, s, 'pill');
        });
        pillsContainer.appendChild(pill);
      }
    }

    // Слушатели слайдеров
    const sliderTarget = document.getElementById('slider-target-cond');
    if (sliderTarget) {
      sliderTarget.min = minCond;
      sliderTarget.max = initialCond;
      sliderTarget.step = 0.1;
      sliderTarget.value = currentTargetCond;
      sliderTarget.addEventListener('input', (e) => {
        applyConditionState(parseFloat(e.target.value), null, 'slider');
      });
    }

    const sliderSteps = document.getElementById('slider-steps-count');
    if (sliderSteps) {
      sliderSteps.min = 0;
      sliderSteps.max = maxStep;
      sliderSteps.step = 1;
      sliderSteps.value = currentStepIndex;
      sliderSteps.addEventListener('input', (e) => {
        applyConditionState(null, parseInt(e.target.value, 10), 'steps-slider');
      });
    }

    // Прямой ввод числа
    const btnDirectApply = document.getElementById('btn-apply-direct-cond');
    const inputDirect = document.getElementById('input-direct-cond');
    if (btnDirectApply && inputDirect) {
      const applyDirect = () => {
        const val = parseFloat(inputDirect.value);
        if (!isNaN(val) && val > 0) {
          applyConditionState(val, null, 'direct');
        }
      };
      btnDirectApply.addEventListener('click', applyDirect);
      inputDirect.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          applyDirect();
        }
      });
    }

    // Кнопки быстрых пресетов
    document.querySelectorAll('.cond-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetVal = parseFloat(btn.getAttribute('data-target'));
        const stepVal = parseInt(btn.getAttribute('data-steps'), 10);
        if (targetVal === 100.0) {
          applyConditionState(100.0, maxStep, 'preset');
        } else {
          applyConditionState(targetVal, stepVal, 'preset');
        }
      });
    });

    // Клики по меткам тиков под слайдером
    document.querySelectorAll('.slider-ticks .tick-label').forEach(tick => {
      tick.addEventListener('click', () => {
        const cond = parseFloat(tick.getAttribute('data-cond'));
        if (!isNaN(cond)) {
          applyConditionState(cond, null, 'tick');
        }
      });
    });

    // Клик по метрике в шапке ведет на раздел мультиколлинеарности
    const headerFinalCond = document.getElementById('metric-cond-final');
    if (headerFinalCond && headerFinalCond.parentElement) {
      headerFinalCond.parentElement.style.cursor = 'pointer';
      headerFinalCond.parentElement.title = 'Нажмите, чтобы настроить число обусловленности';
      headerFinalCond.parentElement.addEventListener('click', () => {
        const tabBtn = document.getElementById('tab-btn-multicollinearity');
        if (tabBtn) tabBtn.click();
      });
    }

    // Таблица топ-корреляций
    const tbodyCorr = document.getElementById('tbody-top-correlations');
    if (tbodyCorr) {
      tbodyCorr.innerHTML = '';
      analytics.top_factor_correlations.slice(0, 16).forEach(pair => {
        const tr = document.createElement('tr');
        const isOneRemoved = pair.factor1_removed || pair.factor2_removed;
        tr.innerHTML = `
          <td style="max-width: 170px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${pair.factor1_name}">${pair.factor1_name}</td>
          <td style="max-width: 170px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${pair.factor2_name}">${pair.factor2_name}</td>
          <td style="font-family: var(--font-mono); font-weight: 700; color: ${pair.correlation > 0 ? 'var(--accent-cyan)' : 'var(--accent-crimson)'}">${pair.correlation > 0 ? '+' : ''}${pair.correlation.toFixed(3)}</td>
          <td>${isOneRemoved ? '<span style="color: var(--accent-emerald); font-size: 10px;">✓ Устранена</span>' : '<span style="color: var(--text-dim); font-size: 10px;">Оставлена</span>'}</td>
        `;
        tbodyCorr.appendChild(tr);
      });
    }

    // Инициализируем начальное состояние
    applyConditionState(minCond, maxStep, 'init');
  }

  function drawSvdScreeCanvas() {
    const canvas = document.getElementById('svd-scree-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width > 50 ? rect.width : (canvas.parentElement?.clientWidth || 480);
    const height = 260;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    const origSV = multiCol.singular_values_original || [];
    const currentStepData = stepsList[currentStepIndex] || {};
    const cleanSV = currentStepData.singular_values || multiCol.singular_values_cleaned || [];
    const currentCondVal = currentStepData.condition_number || currentTargetCond;
    const maxVal = Math.max(...origSV) * 1.08;

    const padLeft = 45, padRight = 20, padTop = 30, padBottom = 35;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padLeft, padTop);
    ctx.lineTo(padLeft, height - padBottom);
    ctx.lineTo(width - padRight, height - padBottom);
    ctx.stroke();

    ctx.font = '10px JetBrains Mono';
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const yVal = (maxVal / 4) * i;
      const yPos = (height - padBottom) - (yVal / maxVal) * plotH;
      ctx.fillText(yVal.toFixed(1), padLeft - 6, yPos + 3);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.beginPath();
      ctx.moveTo(padLeft, yPos);
      ctx.lineTo(width - padRight, yPos);
      ctx.stroke();
    }

    // Исходная кривая (Cyan)
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    origSV.forEach((v, idx) => {
      const x = padLeft + (idx / (origSV.length - 1)) * plotW;
      const y = (height - padBottom) - (v / maxVal) * plotH;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Очищенная / выбранная кривая (Emerald)
    if (cleanSV.length > 0) {
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      cleanSV.forEach((v, idx) => {
        const x = padLeft + (idx / (cleanSV.length - 1)) * plotW;
        const y = (height - padBottom) - (v / maxVal) * plotH;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Легенда
    ctx.textAlign = 'left';
    ctx.fillStyle = '#00f0ff';
    ctx.fillText('● Исходная M^T (Cond = ' + initialCond.toFixed(2) + ')', padLeft + 6, padTop - 12);
    ctx.fillStyle = '#10b981';
    ctx.fillText('■ Выбранный Cond = ' + currentCondVal.toFixed(2) + ' (' + (50 - currentStepIndex) + ' факт.)', padLeft + 195, padTop - 12);
  }



  /* ═══════════════════════════════════════════════════════════════════════════
     ── V2 HUMAN-CENTRIC CORE ENGINE ──────────────────────────────────────────
     Двойной SVD-слайдер, Экономический Компас, Арена Дебатов и переключатель версий
     idea by imEvt • UI/UX by technocat • powered by Gemini
     ═══════════════════════════════════════════════════════════════════════════ */

  window.v2MergedSchoolsMap = new Map(); // id слитой школы -> id партнерской школы
  let v2SchoolReductionStep = 0; // 0..20
  let v2FactorReductionStep = 0; // 0..25

  let v2ActiveSchoolIndices = schools.map((_, i) => i);
  let v2ActiveFactorIndices = factors.map((_, i) => i);

  let v2SchoolReductionSeq = [];
  let v2FactorReductionSeq = [];

  // 1. Быстрый математический SVD-движок (алгоритм вращений Якоби с ранней сходимостью)
  function computeJacobiEigenvalues(A, maxSweeps = 15, tol = 1e-7) {
    const n = A.length;
    if (n === 0) return [];
    if (n === 1) return [A[0][0]];
    const a = [];
    const d = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      a[i] = new Float64Array(n);
      for (let j = 0; j < n; j++) a[i][j] = A[i][j];
      d[i] = a[i][i];
    }
    for (let sweep = 0; sweep < maxSweeps; sweep++) {
      let sm = 0;
      for (let i = 0; i < n - 1; i++) {
        for (let j = i + 1; j < n; j++) sm += Math.abs(a[i][j]);
      }
      if (sm < tol) break;
      const thresh = sweep < 3 ? 0.2 * sm / (n * n) : 0.0;
      for (let p = 0; p < n - 1; p++) {
        for (let q = p + 1; q < n; q++) {
          const gap = 100.0 * Math.abs(a[p][q]);
          if (sweep > 3 && (Math.abs(d[p]) + gap === Math.abs(d[p])) && (Math.abs(d[q]) + gap === Math.abs(d[q]))) {
            a[p][q] = 0.0;
          } else if (Math.abs(a[p][q]) > thresh) {
            const h = d[q] - d[p];
            let t;
            if (Math.abs(h) + gap === Math.abs(h)) {
              t = a[p][q] / h;
            } else {
              const theta = 0.5 * h / a[p][q];
              t = 1.0 / (Math.abs(theta) + Math.sqrt(1.0 + theta * theta));
              if (theta < 0.0) t = -t;
            }
            const c = 1.0 / Math.sqrt(1.0 + t * t);
            const s = t * c;
            const tau = s / (1.0 + c);
            const apq = a[p][q];
            a[p][q] = 0.0;
            d[p] -= t * apq;
            d[q] += t * apq;
            for (let j = 0; j < p; j++) {
              const g = a[j][p]; const hj = a[j][q];
              a[j][p] = g - s * (hj + g * tau);
              a[j][q] = hj + s * (g - hj * tau);
            }
            for (let j = p + 1; j < q; j++) {
              const g = a[p][j]; const hj = a[j][q];
              a[p][j] = g - s * (hj + g * tau);
              a[j][q] = hj + s * (g - hj * tau);
            }
            for (let j = q + 1; j < n; j++) {
              const g = a[p][j]; const hj = a[q][j];
              a[p][j] = g - s * (hj + g * tau);
              a[q][j] = hj + s * (g - hj * tau);
            }
          }
        }
      }
    }
    const eig = Array.from(d);
    eig.sort((x, y) => y - x);
    return eig;
  }

  function computeSubmatrixCond(rowIdxs, colIdxs) {
    const k = rowIdxs.length;
    const l = colIdxs.length;
    if (k < 2 || l < 2) return 1.0;

    if (k <= l) {
      const B = [];
      for (let i = 0; i < k; i++) {
        B[i] = new Float64Array(k);
        const rI = rowIdxs[i];
        for (let j = 0; j <= i; j++) {
          const rJ = rowIdxs[j];
          let dot = 0;
          for (let c = 0; c < l; c++) {
            const col = colIdxs[c];
            dot += matrix[rI][col] * matrix[rJ][col];
          }
          B[i][j] = dot;
          B[j][i] = dot;
        }
      }
      const eigs = computeJacobiEigenvalues(B);
      const sigmaMax = Math.sqrt(Math.max(0, eigs[0]));
      const sigmaMin = Math.sqrt(Math.max(0, eigs[eigs.length - 1]));
      return (sigmaMin > 1e-9) ? (sigmaMax / sigmaMin) : 999.0;
    } else {
      const B = [];
      for (let i = 0; i < l; i++) {
        B[i] = new Float64Array(l);
        const cI = colIdxs[i];
        for (let j = 0; j <= i; j++) {
          const cJ = colIdxs[j];
          let dot = 0;
          for (let r = 0; r < k; r++) {
            const row = rowIdxs[r];
            dot += matrix[row][cI] * matrix[row][cJ];
          }
          B[i][j] = dot;
          B[j][i] = dot;
        }
      }
      const eigs = computeJacobiEigenvalues(B);
      const sigmaMax = Math.sqrt(Math.max(0, eigs[0]));
      const sigmaMin = Math.sqrt(Math.max(0, eigs[eigs.length - 1]));
      return (sigmaMin > 1e-9) ? (sigmaMax / sigmaMin) : 999.0;
    }
  }

  // 2. Сверхбыстрый расчет цепочки слияния школ (по максимальной косинусной близости)
  function calculateSchoolReductionSequence(activeCols, maxSteps = 20) {
    let currentRows = schools.map((_, i) => i);
    const history = [];
    let prevCond = computeSubmatrixCond(currentRows, activeCols);

    for (let step = 1; step <= maxSteps && currentRows.length > 5; step++) {
      let maxSim = -Infinity;
      let bestA = currentRows[0];
      let bestB = currentRows[1];

      for (let i = 0; i < currentRows.length - 1; i++) {
        const rA = currentRows[i];
        for (let j = i + 1; j < currentRows.length; j++) {
          const rB = currentRows[j];
          let dot = 0, nA = 0, nB = 0;
          for (let c = 0; c < activeCols.length; c++) {
            const col = activeCols[c];
            const vA = matrix[rA][col];
            const vB = matrix[rB][col];
            dot += vA * vB;
            nA += vA * vA;
            nB += vB * vB;
          }
          const sim = (nA > 0 && nB > 0) ? (dot / (Math.sqrt(nA) * Math.sqrt(nB))) : 0;
          if (sim > maxSim) {
            maxSim = sim;
            bestA = rA;
            bestB = rB;
          }
        }
      }

      // Сохраняем более раннюю базовую школу, а вторую сливаем
      const partnerIndex = Math.min(bestA, bestB);
      const removedSchoolIndex = Math.max(bestA, bestB);

      currentRows = currentRows.filter(r => r !== removedSchoolIndex);

      const diffs = activeCols.map(col => ({
        col,
        diff: Math.abs(matrix[removedSchoolIndex][col] - matrix[partnerIndex][col]),
        name: factors[col].name_ru
      }));
      diffs.sort((a, b) => a.diff - b.diff);

      const commonPoints = diffs.slice(0, 3).map(d => d.name);
      const conflictPoint = diffs[diffs.length - 1].name;
      const condAfter = computeSubmatrixCond(currentRows, activeCols);

      history.push({
        step,
        removedSchoolIndex,
        removedSchool: schools[removedSchoolIndex],
        partnerIndex,
        partnerSchool: schools[partnerIndex],
        similarity: maxSim,
        commonPoints,
        conflictPoint,
        condBefore: prevCond,
        condAfter,
        delta: Math.max(0, prevCond - condAfter),
        remainingRows: [...currentRows]
      });

      prevCond = condAfter;
    }

    return history;
  }

  // 3. Сверхбыстрый расчет цепочки слияния факторов (по максимальной корреляции Пирсона)
  function calculateFactorReductionSequence(activeRows, maxSteps = 25) {
    let currentCols = factors.map((_, i) => i);
    const history = [];
    let prevCond = computeSubmatrixCond(activeRows, currentCols);
    const n = activeRows.length;

    for (let step = 1; step <= maxSteps && currentCols.length > 5; step++) {
      let maxAbsCorr = -1;
      let bestA = currentCols[0];
      let bestB = currentCols[1];
      let bestCorr = 0;

      for (let i = 0; i < currentCols.length - 1; i++) {
        const cA = currentCols[i];
        let sumA = 0;
        for (let r = 0; r < n; r++) sumA += matrix[activeRows[r]][cA];
        const meanA = sumA / n;

        for (let j = i + 1; j < currentCols.length; j++) {
          const cB = currentCols[j];
          let sumB = 0;
          for (let r = 0; r < n; r++) sumB += matrix[activeRows[r]][cB];
          const meanB = sumB / n;

          let num = 0, denA = 0, denB = 0;
          for (let r = 0; r < n; r++) {
            const da = matrix[activeRows[r]][cA] - meanA;
            const db = matrix[activeRows[r]][cB] - meanB;
            num += da * db;
            denA += da * da;
            denB += db * db;
          }
          const corr = (denA > 1e-12 && denB > 1e-12) ? (num / (Math.sqrt(denA) * Math.sqrt(denB))) : 0;
          const absC = Math.abs(corr);
          if (absC > maxAbsCorr) {
            maxAbsCorr = absC;
            bestA = cA;
            bestB = cB;
            bestCorr = corr;
          }
        }
      }

      // Сохраняем более ранний фактор, а парный сливаем
      const partnerIndex = Math.min(bestA, bestB);
      const removedFactorIndex = Math.max(bestA, bestB);

      currentCols = currentCols.filter(c => c !== removedFactorIndex);
      const condAfter = computeSubmatrixCond(activeRows, currentCols);

      history.push({
        step,
        removedIndex: removedFactorIndex,
        removedFactorIndex,
        removedFactor: factors[removedFactorIndex],
        partnerIndex,
        partnerFactor: factors[partnerIndex],
        correlation: bestCorr,
        condBefore: prevCond,
        condAfter,
        delta: Math.max(0, prevCond - condAfter),
        remainingCols: [...currentCols]
      });

      prevCond = condAfter;
    }

    return history;
  }

  // 4. Обновление состояния двойного слайдера с троттлингом через rAF
  let dualSvdRafId = null;

  function updateDualSvdState(immediate = false) {
    if (v2SchoolReductionStep === 0) {
      v2ActiveSchoolIndices = schools.map((_, i) => i);
      window.v2MergedSchoolsMap.clear();
    } else {
      const stepIdx = Math.min(v2SchoolReductionStep - 1, v2SchoolReductionSeq.length - 1);
      const stepData = v2SchoolReductionSeq[stepIdx];
      v2ActiveSchoolIndices = stepData ? stepData.remainingRows : schools.map((_, i) => i);
      window.v2MergedSchoolsMap.clear();
      for (let s = 0; s < v2SchoolReductionStep && s < v2SchoolReductionSeq.length; s++) {
        const item = v2SchoolReductionSeq[s];
        window.v2MergedSchoolsMap.set(item.removedSchool.id, {
          partnerId: item.partnerSchool.id,
          partnerSchool: item.partnerSchool,
          similarity: item.similarity
        });
      }
    }

    window.v2MergedFactorsMap = new Map();
    if (v2FactorReductionStep === 0) {
      v2ActiveFactorIndices = factors.map((_, i) => i);
    } else {
      const stepIdx = Math.min(v2FactorReductionStep - 1, v2FactorReductionSeq.length - 1);
      const stepData = v2FactorReductionSeq[stepIdx];
      v2ActiveFactorIndices = stepData ? stepData.remainingCols : factors.map((_, i) => i);
      for (let f = 0; f < v2FactorReductionStep && f < v2FactorReductionSeq.length; f++) {
        const item = v2FactorReductionSeq[f];
        window.v2MergedFactorsMap.set(item.removedIndex, {
          partnerIndex: item.partnerIndex,
          partnerFactor: item.partnerFactor,
          correlation: item.correlation
        });
      }
    }

    // Расчет текущего cond (по возможности из готовых последовательностей, чтобы не нагружать CPU)
    let currentCond = 193.87;
    if (v2SchoolReductionStep > 0 && v2FactorReductionStep === 0) {
      const sItem = v2SchoolReductionSeq[Math.min(v2SchoolReductionStep - 1, v2SchoolReductionSeq.length - 1)];
      if (sItem) currentCond = sItem.condAfter;
    } else if (v2FactorReductionStep > 0 && v2SchoolReductionStep === 0) {
      const fItem = v2FactorReductionSeq[Math.min(v2FactorReductionStep - 1, v2FactorReductionSeq.length - 1)];
      if (fItem) currentCond = fItem.condAfter;
    } else if (v2SchoolReductionStep > 0 && v2FactorReductionStep > 0) {
      currentCond = computeSubmatrixCond(v2ActiveSchoolIndices, v2ActiveFactorIndices);
    }

    const shapeEl = document.getElementById('dual-svd-shape-val');
    const condEl = document.getElementById('dual-svd-cond-val');
    if (shapeEl) shapeEl.textContent = `${v2ActiveSchoolIndices.length} школ × ${v2ActiveFactorIndices.length} признаков`;
    if (condEl) condEl.textContent = currentCond.toFixed(2);

    const badgeSchools = document.getElementById('badge-schools-active-count');
    const labelSchools = document.getElementById('label-schools-slider-val');
    if (badgeSchools) badgeSchools.textContent = `${v2ActiveSchoolIndices.length} активны (${v2SchoolReductionStep} слито)`;
    if (labelSchools) labelSchools.textContent = `Шаг: ${v2SchoolReductionStep}`;

    const badgeFactors = document.getElementById('badge-factors-active-count');
    const labelFactors = document.getElementById('label-factors-slider-val');
    if (badgeFactors) badgeFactors.textContent = `${v2ActiveFactorIndices.length} активны (${v2FactorReductionStep} слито)`;
    if (labelFactors) labelFactors.textContent = `Шаг: ${v2FactorReductionStep}`;

    // Карточка подсказки ШКОЛ
    const hudSchoolStep = document.getElementById('hud-school-step-badge');
    const hudSchoolCond = document.getElementById('hud-school-cond-badge');
    const hudSchoolBody = document.getElementById('hud-school-body');
    if (v2SchoolReductionStep === 0) {
      if (hudSchoolStep) hudSchoolStep.textContent = 'Шаг 0: Все школы активны';
      if (hudSchoolCond) hudSchoolCond.textContent = `Cond: ${currentCond.toFixed(2)}`;
      if (hudSchoolBody) hudSchoolBody.innerHTML = '<p class="hud-text-main">Базовый режим: все 34 исторические и современные школы представлены полностью во всей полноте деталей.</p>';
    } else {
      const cur = v2SchoolReductionSeq[Math.min(v2SchoolReductionStep - 1, v2SchoolReductionSeq.length - 1)];
      if (cur) {
        if (hudSchoolStep) hudSchoolStep.textContent = `Шаг ${cur.step}: Слияние "${cur.removedSchool.name_ru}"`;
        if (hudSchoolCond) hudSchoolCond.textContent = `Cond: ${cur.condAfter.toFixed(2)} (Δ -${cur.delta.toFixed(2)})`;
        if (hudSchoolBody) {
          hudSchoolBody.innerHTML = `
            <div class="hud-partner-row">
              <span>🎯 Ближайший аналог:</span>
              <strong style="color: var(--accent-cyan);">${cur.partnerSchool.name_ru}</strong>
              <span class="badge-mini" style="background: rgba(0, 240, 255, 0.15); color: var(--accent-cyan);">${Math.round(cur.similarity * 100)}% сходства</span>
            </div>
            <div class="hud-tag-box">
              <div class="hud-agree-text">🤝 <strong>Совпадают:</strong> ${cur.commonPoints.join(', ')}</div>
              <div class="hud-conflict-text">⚡ <strong>Нюанс различия:</strong> ${cur.conflictPoint}</div>
            </div>
          `;
        }
      }
    }

    // Карточка подсказки ПРИЗНАКОВ
    const hudFactorStep = document.getElementById('hud-factor-step-badge');
    const hudFactorCond = document.getElementById('hud-factor-cond-badge');
    const hudFactorBody = document.getElementById('hud-factor-body');
    if (v2FactorReductionStep === 0) {
      if (hudFactorStep) hudFactorStep.textContent = 'Шаг 0: Все признаки активны';
      if (hudFactorCond) hudFactorCond.textContent = `Cond: ${currentCond.toFixed(2)}`;
      if (hudFactorBody) hudFactorBody.innerHTML = '<p class="hud-text-main">Базовый режим: все 50 факторов из всех 9 сфер экономической теории активны.</p>';
    } else {
      const cur = v2FactorReductionSeq[Math.min(v2FactorReductionStep - 1, v2FactorReductionSeq.length - 1)];
      if (cur) {
        const sign = cur.correlation >= 0 ? '+' : '';
        if (hudFactorStep) hudFactorStep.textContent = `Шаг ${cur.step}: Исключен "${cur.removedFactor.name_ru.slice(0, 32)}..."`;
        if (hudFactorCond) hudFactorCond.textContent = `Cond: ${cur.condAfter.toFixed(2)} (Δ -${cur.delta.toFixed(2)})`;
        if (hudFactorBody) {
          hudFactorBody.innerHTML = `
            <div class="hud-partner-row">
              <span>🎯 Дублирует фактор:</span>
              <strong style="color: var(--accent-amber);">${cur.partnerFactor.name_ru}</strong>
              <span class="badge-mini" style="background: rgba(245, 158, 11, 0.15); color: var(--accent-amber);">r = ${sign}${cur.correlation.toFixed(2)}</span>
            </div>
            <p style="font-size: 11.5px; color: var(--text-muted); margin-top: 4px;">
              💡 При текущем составе активных школ этот критерий вносит максимальную избыточность в число обусловленности и дублирует парный признак.
            </p>
          `;
        }
      }
    }

    // Отрисовка строго по rAF и только активной вкладки (60+ FPS)
    if (dualSvdRafId) cancelAnimationFrame(dualSvdRafId);

    const renderActiveTabOnly = () => {
      dualSvdRafId = null;
      const activeTab = document.querySelector('.nav-tab.active')?.getAttribute('data-tab');
      if (activeTab === 'pca') {
        drawPcaCanvas();
      } else if (activeTab === 'heatmap') {
        renderHeatmap();
      } else if (activeTab === 'arena') {
        renderArena();
      }
    };

    if (immediate) {
      renderActiveTabOnly();
    } else {
      dualSvdRafId = requestAnimationFrame(renderActiveTabOnly);
    }
  }

  function initDualSvdReducer() {
    // Быстрый предрасчет базовых цепочек
    v2SchoolReductionSeq = calculateSchoolReductionSequence(v2ActiveFactorIndices, 20);
    v2FactorReductionSeq = calculateFactorReductionSequence(v2ActiveSchoolIndices, 25);

    const sliderSchools = document.getElementById('slider-schools-reducer');
    const sliderFactors = document.getElementById('slider-factors-reducer');
    const toggleBtn = document.getElementById('btn-toggle-dual-svd');
    const panel = document.getElementById('dual-svd-panel');
    const toggleLabel = document.getElementById('label-toggle-dual-svd');
    const toggleIcon = toggleBtn ? toggleBtn.querySelector('.toggle-icon') : null;

    if (toggleBtn && panel) {
      toggleBtn.addEventListener('click', () => {
        const isCollapsed = panel.classList.toggle('collapsed');
        if (toggleLabel) toggleLabel.textContent = isCollapsed ? 'Развернуть' : 'Свернуть';
        if (toggleIcon) toggleIcon.textContent = isCollapsed ? '▸' : '▾';
      });
    }

    let pendingFactorsRecompute = false;
    let pendingSchoolsRecompute = false;

    if (sliderSchools) {
      sliderSchools.addEventListener('input', (e) => {
        v2SchoolReductionStep = parseInt(e.target.value, 10);
        pendingFactorsRecompute = true;
        updateDualSvdState();
      });

      const finalizeSchools = () => {
        if (pendingFactorsRecompute) {
          pendingFactorsRecompute = false;
          v2ActiveSchoolIndices = v2SchoolReductionStep === 0 
            ? schools.map((_, i) => i) 
            : (v2SchoolReductionSeq[Math.min(v2SchoolReductionStep - 1, v2SchoolReductionSeq.length - 1)]?.remainingRows || schools.map((_, i) => i));
          v2FactorReductionSeq = calculateFactorReductionSequence(v2ActiveSchoolIndices, 25);
          updateDualSvdState(true);
        }
      };

      sliderSchools.addEventListener('change', finalizeSchools);
      sliderSchools.addEventListener('touchend', finalizeSchools);
      sliderSchools.addEventListener('mouseup', finalizeSchools);
    }

    if (sliderFactors) {
      sliderFactors.addEventListener('input', (e) => {
        if (pendingFactorsRecompute) {
          pendingFactorsRecompute = false;
          v2ActiveSchoolIndices = v2SchoolReductionStep === 0 
            ? schools.map((_, i) => i) 
            : (v2SchoolReductionSeq[Math.min(v2SchoolReductionStep - 1, v2SchoolReductionSeq.length - 1)]?.remainingRows || schools.map((_, i) => i));
          v2FactorReductionSeq = calculateFactorReductionSequence(v2ActiveSchoolIndices, 25);
        }

        v2FactorReductionStep = parseInt(e.target.value, 10);
        pendingSchoolsRecompute = true;
        updateDualSvdState();
      });

      const finalizeFactors = () => {
        if (pendingSchoolsRecompute) {
          pendingSchoolsRecompute = false;
          v2ActiveFactorIndices = v2FactorReductionStep === 0 
            ? factors.map((_, i) => i) 
            : (v2FactorReductionSeq[Math.min(v2FactorReductionStep - 1, v2FactorReductionSeq.length - 1)]?.remainingCols || factors.map((_, i) => i));
          v2SchoolReductionSeq = calculateSchoolReductionSequence(v2ActiveFactorIndices, 20);
          updateDualSvdState(true);
        }
      };

      sliderFactors.addEventListener('change', finalizeFactors);
      sliderFactors.addEventListener('touchend', finalizeFactors);
      sliderFactors.addEventListener('mouseup', finalizeFactors);
    }

    updateDualSvdState(true);
  }

  // 5. Переключатель версий v2 Human / v1 Classic Pro
  function initVersionSwitcher() {
    const btnV2 = document.getElementById('btn-toggle-v2');
    const btnV1 = document.getElementById('btn-toggle-v1');
    const badge = document.getElementById('brand-version-badge');

    function applyMode(mode) {
      const isV1 = mode === 'v1';
      document.body.classList.toggle('mode-v1', isV1);
      document.body.classList.toggle('mode-v2', !isV1);

      if (btnV2) btnV2.classList.toggle('active', !isV1);
      if (btnV1) btnV1.classList.toggle('active', isV1);
      if (badge) badge.textContent = isV1 ? 'v1.0 Classic Pro' : 'v2.0 Human';

      localStorage.setItem('econmatrix_version', mode);

      // Если переключились на v1 и открыт компас или арена — переключаем на heatmap
      if (isV1) {
        const activeTab = document.querySelector('.nav-tab.active')?.getAttribute('data-tab');
        if (activeTab === 'compass' || activeTab === 'arena') {
          const heatmapBtn = document.getElementById('tab-btn-heatmap');
          if (heatmapBtn) heatmapBtn.click();
        }
      }

      // Обновляем видимость контекстных панелей (SVD индикатор и селектор сравнения)
      updateContextualPanels();
    }

    if (btnV2) btnV2.addEventListener('click', () => applyMode('v2'));
    if (btnV1) btnV1.addEventListener('click', () => applyMode('v1'));

    const savedMode = localStorage.getItem('econmatrix_version') || 'v2';
    applyMode(savedMode);
  }

  // 6. Экономический Компас (Квиз 5 дилемм)
  const COMPASS_DILEMMAS = [
    {
      id: 'd1',
      factorIndex: 0, // f01_state_intervention
      name: 'Роль государства в экономике',
      question: 'Как должно функционировать государственное регулирование рынков?',
      leftPole: '🏛️ Госплан, контроль цен и национализация',
      rightPole: '🗽 Полная свобода рынка и Laissez-faire',
      defaultValue: 0.0
    },
    {
      id: 'd2',
      factorIndex: 15, // f16_progressive_income_tax
      name: 'Налоги и социальная справедливость',
      question: 'Нужно ли высокое прогрессивное налогообложение капитала и сверхбогатых?',
      leftPole: '⚖️ Высокий прогрессивный налог ради равенства',
      rightPole: '📉 Низкие плоские налоги для стимулов бизнеса',
      defaultValue: 0.0
    },
    {
      id: 'd3',
      factorIndex: 3, // f04_free_trade_globalism
      name: 'Международная торговля',
      question: 'Как стране выстраивать внешнеэкономические связи?',
      leftPole: '🛡️ Протекционизм и тарифная защита промышленности',
      rightPole: '🌐 Свободная мировая торговля без барьеров',
      defaultValue: 0.0
    },
    {
      id: 'd4',
      factorIndex: 33, // f34_minimum_wage_support
      name: 'Рынок труда и заработная плата',
      question: 'Должно ли государство законодательно регулировать МРОТ и трудовые права?',
      leftPole: '👷 Обязательный МРОТ и сильные профсоюзы',
      rightPole: '💼 Гибкий рынок труда без внешних барьеров',
      defaultValue: 0.0
    },
    {
      id: 'd5',
      factorIndex: 41, // f42_ecological_limits_degrowth
      name: 'Экология и пределы роста',
      question: 'Что важнее: сохранение биосферы или непрерывный экономический рост ВВП?',
      leftPole: '🌱 Биофизические пределы роста / Антирост',
      rightPole: '🚀 Рыночный рост ВВП превыше экологических лимитов',
      defaultValue: 0.0
    }
  ];

  let compassValues = COMPASS_DILEMMAS.map(d => d.defaultValue);

  function initCompass() {
    renderCompass();
  }

  function renderCompass() {
    const container = document.getElementById('dilemmas-container');
    if (!container) return;

    // Рендерим слайдеры только один раз
    if (container.children.length === 0) {
      container.innerHTML = '';
      COMPASS_DILEMMAS.forEach((d, idx) => {
        const card = document.createElement('div');
        card.className = 'dilemma-card';
        card.innerHTML = `
          <div class="dilemma-header">
            <span class="dilemma-num">Дилемма #${idx + 1}: ${d.name}</span>
            <span class="dilemma-val-badge" id="dilemma-badge-${idx}">0.0 (Нейтрально)</span>
          </div>
          <div class="dilemma-question">${d.question}</div>
          <div class="dilemma-poles-row">
            <span class="pole-left">${d.leftPole}</span>
            <span class="pole-right">${d.rightPole}</span>
          </div>
          <input type="range" class="styled-range dilemma-slider" id="slider-dilemma-${idx}" min="-1.0" max="1.0" step="0.25" value="${compassValues[idx]}">
        `;
        container.appendChild(card);

        const slider = card.querySelector(`#slider-dilemma-${idx}`);
        slider.addEventListener('input', (e) => {
          compassValues[idx] = parseFloat(e.target.value);
          updateCompassBadge(idx, compassValues[idx]);
          calculateCompassAffinity();
        });
      });

      // Пресеты
      document.querySelectorAll('.compass-preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const p = btn.getAttribute('data-preset');
          if (p === 'market') compassValues = [-0.9, -0.9, 0.9, -0.9, -0.7];
          if (p === 'state') compassValues = [0.9, 0.9, -0.6, 0.9, 0.6];
          if (p === 'keynesian') compassValues = [0.6, 0.7, 0.4, 0.8, 0.3];
          if (p === 'reset') compassValues = [0.0, 0.0, 0.0, 0.0, 0.0];

          COMPASS_DILEMMAS.forEach((_, i) => {
            const sl = document.getElementById(`slider-dilemma-${i}`);
            if (sl) sl.value = compassValues[i];
            updateCompassBadge(i, compassValues[i]);
          });
          calculateCompassAffinity();
        });
      });

      const duelBtn = document.getElementById('btn-compass-open-duel');
      if (duelBtn) {
        duelBtn.addEventListener('click', () => {
          if (window.compassTopSchoolId) {
            setGlobalSchools(window.compassTopSchoolId, schoolBId === window.compassTopSchoolId ? 'austrian' : schoolBId);
            const arenaTabBtn = document.getElementById('tab-btn-arena');
            if (arenaTabBtn) arenaTabBtn.click();
          }
        });
      }
    }

    calculateCompassAffinity();
  }

  function updateCompassBadge(idx, val) {
    const badge = document.getElementById(`dilemma-badge-${idx}`);
    if (!badge) return;
    let label = `${val > 0 ? '+' : ''}${val.toFixed(2)}`;
    if (val <= -0.75) label += ' (Крайний левый)';
    else if (val <= -0.25) label += ' (Умеренный левый)';
    else if (val >= 0.75) label += ' (Крайний правый)';
    else if (val >= 0.25) label += ' (Умеренный правый)';
    else label += ' (Баланс / Нейтрально)';
    badge.textContent = label;
  }

  function calculateCompassAffinity() {
    // Вектор пользователя по 5 факторам
    // Для фактора f01: влево = +1 (госплан), вправо = -1 (рынок)
    // Сопоставляем значения со шкалой школы:
    const userVector = [
      -compassValues[0], // f01: left (state) = +1.0, right (market) = -1.0
      -compassValues[1], // f16: left (tax) = +1.0, right = -1.0
      compassValues[2],  // f04: right (free trade) = +1.0, left = -1.0
      -compassValues[3], // f34: left (wage support) = +1.0, right = -1.0
      -compassValues[4]  // f42: left (degrowth) = +1.0, right = -1.0
    ];

    const targetFactorIndices = COMPASS_DILEMMAS.map(d => d.factorIndex);

    // Считаем сходство со всеми активными школами
    const scores = [];
    v2ActiveSchoolIndices.forEach(sIdx => {
      const s = schools[sIdx];
      let dot = 0, nU = 0, nS = 0;
      targetFactorIndices.forEach((fIdx, k) => {
        const u = userVector[k];
        const val = matrix[sIdx][fIdx];
        dot += u * val;
        nU += u * u;
        nS += val * val;
      });
      const norm = Math.sqrt(nU) * Math.sqrt(nS);
      const sim = (norm > 0) ? (dot / norm) : 0;
      const pct = Math.max(0, Math.min(100, Math.round(((sim + 1) / 2) * 100)));
      scores.push({ school: s, sim, pct });
    });

    scores.sort((a, b) => b.sim - a.sim);

    if (scores.length === 0) return;

    const winner = scores[0];
    window.compassTopSchoolId = winner.school.id;

    // Выводим результат
    const nameEl = document.getElementById('compass-top-school-name');
    const pctEl = document.getElementById('compass-top-school-pct');
    const descEl = document.getElementById('compass-top-school-desc');
    const familyEl = document.getElementById('compass-best-family');

    if (nameEl) nameEl.textContent = winner.school.name_ru;
    if (pctEl) pctEl.textContent = `${winner.pct}% совпадения`;
    if (descEl) descEl.textContent = winner.school.description;
    if (familyEl) {
      const fam = getSchoolFamily(winner.school.id);
      familyEl.textContent = fam.toUpperCase();
      familyEl.style.backgroundColor = `${getSchoolColor(winner.school.id)}25`;
      familyEl.style.color = getSchoolColor(winner.school.id);
    }

    // Сайдбар со шкалами affinity топ-5
    const barsContainer = document.getElementById('compass-affinity-bars');
    if (barsContainer) {
      barsContainer.innerHTML = '';
      scores.slice(0, 5).forEach(item => {
        const div = document.createElement('div');
        div.className = 'affinity-item';
        div.innerHTML = `
          <div class="affinity-labels">
            <span class="affinity-school-name">${item.school.name_ru}</span>
            <span class="affinity-score">${item.pct}%</span>
          </div>
          <div class="affinity-bar-bg">
            <div class="affinity-bar-fill" style="width: ${item.pct}%; background: ${getSchoolColor(item.school.id)};"></div>
          </div>
        `;
        barsContainer.appendChild(div);
      });
    }
  }

  // 7. Арена Дебатов (Дуэль двух школ)
  function initArena() {
    document.querySelectorAll('.arena-duel-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const s1 = btn.getAttribute('data-s1');
        const s2 = btn.getAttribute('data-s2');
        setGlobalSchools(s1, s2);
        renderArena();
      });
    });
  }

  function renderArena() {
    const fightersContainer = document.getElementById('arena-fighters-grid');
    if (!fightersContainer) return;

    const sIdxA = schools.findIndex(s => s.id === schoolAId);
    const sIdxB = schools.findIndex(s => s.id === schoolBId);
    if (sIdxA === -1 || sIdxB === -1) return;

    const sA = schools[sIdxA];
    const sB = schools[sIdxB];

    // Вычисляем косинусное сходство между Школой А и Б по текущим активным факторам
    let dot = 0, nA = 0, nB = 0;
    v2ActiveFactorIndices.forEach(col => {
      const vA = matrix[sIdxA][col];
      const vB = matrix[sIdxB][col];
      dot += vA * vB;
      nA += vA * vA;
      nB += vB * vB;
    });
    const sim = (nA > 0 && nB > 0) ? (dot / (Math.sqrt(nA) * Math.sqrt(nB))) : 0;
    const simPct = Math.round(Math.max(0, Math.min(100, ((sim + 1) / 2) * 100)));
    // Опции для селекторов бойцов (из активных школ)
    const optionsHtml = v2ActiveSchoolIndices.map(idx => {
      const s = schools[idx];
      return `<option value="${s.id}">${s.name_ru}</option>`;
    }).join('');

    fightersContainer.innerHTML = `
      <div class="fighter-card fighter-a">
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
          <span class="fighter-badge" style="background: rgba(0, 240, 255, 0.15); color: var(--accent-cyan); border: 1px solid var(--accent-cyan);">🔵 Школа А (Базовая)</span>
          <span style="font-size: 11px; color: var(--text-muted); font-family: var(--font-mono);">${sA.period}</span>
        </div>
        <div class="arena-picker-wrap">
          <select class="control-select arena-picker-select" id="arena-picker-a">${optionsHtml}</select>
        </div>
        <div class="fighter-figures">👥 Мыслители: <strong>${(sA.key_figures || []).join(', ')}</strong></div>
        <div class="fighter-credo">${sA.description}</div>
      </div>

      <div class="vs-badge-wrap">
        <button class="vs-badge" id="btn-arena-swap" title="Поменять оппонентов местами (⇄)">⇄</button>
        <div class="similarity-val-pill">Сходство: ${simPct}%</div>
      </div>

      <div class="fighter-card fighter-b">
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
          <span class="fighter-badge" style="background: rgba(239, 68, 68, 0.15); color: var(--accent-crimson); border: 1px solid var(--accent-crimson);">🔴 Школа Б (Оппонент)</span>
          <span style="font-size: 11px; color: var(--text-muted); font-family: var(--font-mono);">${sB.period}</span>
        </div>
        <div class="arena-picker-wrap">
          <select class="control-select arena-picker-select" id="arena-picker-b">${optionsHtml}</select>
        </div>
        <div class="fighter-figures">👥 Мыслители: <strong>${(sB.key_figures || []).join(', ')}</strong></div>
        <div class="fighter-credo">${sB.description}</div>
      </div>
    `;

    const pickerA = document.getElementById('arena-picker-a');
    const pickerB = document.getElementById('arena-picker-b');
    const swapBtn = document.getElementById('btn-arena-swap');

    if (pickerA) {
      pickerA.value = schoolAId;
      pickerA.addEventListener('change', (e) => setGlobalSchools(e.target.value, null));
    }
    if (pickerB) {
      pickerB.value = schoolBId;
      pickerB.addEventListener('change', (e) => setGlobalSchools(null, e.target.value));
    }
    if (swapBtn) {
      swapBtn.addEventListener('click', () => setGlobalSchools(schoolBId, schoolAId));
    }

    // Вычисляем совпадения и разногласия по активным факторам
    const factorDiffs = v2ActiveFactorIndices.map(col => ({
      factor: factors[col],
      diff: Math.abs(matrix[sIdxA][col] - matrix[sIdxB][col]),
      valA: matrix[sIdxA][col],
      valB: matrix[sIdxB][col]
    }));

    factorDiffs.sort((a, b) => a.diff - b.diff);

    // Консенсус (наименьшая разница)
    const consensusPoints = factorDiffs.filter(d => d.diff <= 0.35).slice(0, 6);
    // Конфликт (наибольшая разница)
    const conflictPoints = [...factorDiffs].reverse().filter(d => d.diff >= 1.2).slice(0, 6);

    const consensusContainer = document.getElementById('arena-consensus-points');
    const conflictContainer = document.getElementById('arena-conflict-points');

    if (consensusContainer) {
      if (consensusPoints.length === 0) {
        consensusContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 12px; padding: 10px;">Прямых совпадений во взглядах практически нет.</div>';
      } else {
        consensusContainer.innerHTML = consensusPoints.map(p => `
          <div class="point-card">
            <span class="point-title">✓ ${p.factor.name_ru}</span>
            <span class="point-scores-pill" style="color: var(--accent-emerald);">А: ${p.valA > 0 ? '+' : ''}${p.valA.toFixed(1)} | Б: ${p.valB > 0 ? '+' : ''}${p.valB.toFixed(1)}</span>
          </div>
        `).join('');
      }
    }

    if (conflictContainer) {
      if (conflictPoints.length === 0) {
        conflictContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 12px; padding: 10px;">Радикальных противоречий не обнаружено (школы весьма близки).</div>';
      } else {
        conflictContainer.innerHTML = conflictPoints.map(p => `
          <div class="point-card">
            <span class="point-title">✗ ${p.factor.name_ru}</span>
            <span class="point-scores-pill" style="color: var(--accent-crimson);">А: ${p.valA > 0 ? '+' : ''}${p.valA.toFixed(1)} vs Б: ${p.valB > 0 ? '+' : ''}${p.valB.toFixed(1)}</span>
          </div>
        `).join('');
      }
    }
  }

  // Глобальные хелперы для быстрых кликов из карточек
  window.EconMatrixSetA = function(id) { setGlobalSchools(id, null); };
  window.EconMatrixSetB = function(id) { setGlobalSchools(null, id); };

  /* ─────────────────────────────────────────────────────────────────────────
     PERFORMANCE MONITOR (REAL-TIME FPS & FRAME TIME HUD)
  ───────────────────────────────────────────────────────────────────────── */
  function initFpsMeter() {
    const hud = document.getElementById('fps-meter-hud');
    const valEl = document.getElementById('fps-counter-val');
    const msEl = document.getElementById('fps-counter-ms');
    const dotEl = document.getElementById('fps-indicator-dot');
    if (!hud || !valEl || !msEl || !dotEl) return;

    let lastFrameTime = performance.now();
    let frameTimes = [];
    const maxSamples = 24; // Скользящее окно на 24 кадра
    let lastHudUpdate = 0;

    hud.addEventListener('click', () => {
      hud.classList.toggle('minimized');
    });

    function frameTick(now) {
      const delta = now - lastFrameTime;
      lastFrameTime = now;

      // Игнорируем аномальные паузы (сворачивание вкладки, долгий blur)
      if (delta > 0 && delta < 1000) {
        frameTimes.push(delta);
        if (frameTimes.length > maxSamples) {
          frameTimes.shift();
        }
      } else {
        frameTimes = [];
      }

      // Обновляем показания каждые 180 мс на основе скользящего среднего
      if (now - lastHudUpdate >= 180 && frameTimes.length >= 4) {
        lastHudUpdate = now;

        const sum = frameTimes.reduce((a, b) => a + b, 0);
        const avgDelta = sum / frameTimes.length;
        const fps = Math.min(144, Math.round(1000 / avgDelta));
        const frameMs = avgDelta.toFixed(1);

        valEl.textContent = `${fps} FPS`;
        msEl.textContent = `${frameMs} ms`;

        if (fps >= 50) {
          dotEl.style.backgroundColor = '#10b981';
          dotEl.style.boxShadow = '0 0 8px #10b981';
          valEl.style.color = '#10b981';
        } else if (fps >= 30) {
          dotEl.style.backgroundColor = '#f59e0b';
          dotEl.style.boxShadow = '0 0 8px #f59e0b';
          valEl.style.color = '#f59e0b';
        } else {
          dotEl.style.backgroundColor = '#ef4444';
          dotEl.style.boxShadow = '0 0 8px #ef4444';
          valEl.style.color = '#ef4444';
        }
      }

      requestAnimationFrame(frameTick);
    }

    requestAnimationFrame(frameTick);
  }

  /* ─────────────────────────────────────────────────────────────────────────
     ГЛАВНЫЙ СТАРТ
  ───────────────────────────────────────────────────────────────────────── */
  window.addEventListener('DOMContentLoaded', () => {
    initFpsMeter();
    initVersionSwitcher();
    initGlobalComparisonBar();
    initTabs();
    initHeatmapControls();
    renderHeatmap();
    initPca();
    initMulticollinearityView();
    renderRadar();
    renderDifferences();
    renderSimilarityGauge();
    renderGenealogyTree();

    // v2 Core Engine
    initDualSvdReducer();
    initCompass();
    initArena();

    // Финальная синхронизация контекстной видимости
    updateContextualPanels();
  });

})();

/**
 * Mainichi Mileage - ゲーミフィケーションタスク・習慣管理アプリ
 */

// ストレージキー
const STORAGE_KEY = 'mainichi_mileage_app_data_v1';

// デフォルト初期データ構造
const INITIAL_CATEGORIES = [
  { id: 'c1', name: '① 目標・自己実現（仕事日用）', targetMinutes: 30, executedMinutes: 0, isCompleted: false, icon: '🎯', resetTiming: 'daily', resetDayOfWeek: 1 },
  { id: 'c2', name: '② 目標・自己実現（休日用）', targetMinutes: 45, executedMinutes: 0, isCompleted: false, icon: '🚀', resetTiming: 'daily', resetDayOfWeek: 1 },
  { id: 'c3', name: '③ 日課・習慣（仕事日用）', targetMinutes: 20, executedMinutes: 0, isCompleted: false, icon: '⚡', resetTiming: 'daily', resetDayOfWeek: 1 },
  { id: 'c4', name: '④ 日課・習慣（休日用）', targetMinutes: 30, executedMinutes: 0, isCompleted: false, icon: '🌱', resetTiming: 'daily', resetDayOfWeek: 1 },
  { id: 'c5', name: '⑤ ノルマ・ToDo', targetMinutes: 60, executedMinutes: 0, isCompleted: false, icon: '📋', resetTiming: 'daily', resetDayOfWeek: 1 }
];

// アプリケーション状態
let state = {
  lastUpdatedDate: getTodayString(),
  totalPoints: 0,
  maxPoints: 0,
  categories: JSON.parse(JSON.stringify(INITIAL_CATEGORIES))
};

// 実行中のタイマー管理オブジェクト ({ categoryId: { intervalId, seconds } })
const activeTimers = {};

// 現在選択中の手動入力対象カテゴリーID
let currentManualCategoryId = null;

// --- 日付ヘルパー関数 ---
function getTodayString(dateObj = new Date()) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getNextDateString(dateStr) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + 1);
  return getTodayString(d);
}

// --- レベル / ランク判定 ---
function getRankName(points) {
  if (points >= 50) return '🔥 Master';
  if (points >= 30) return '💎 Expert';
  if (points >= 15) return '⭐ Advanced';
  if (points >= 5)  return '🌱 Regular';
  return '🐣 Beginner';
}

// --- リセットタイミング判定 ---
function shouldResetCategory(category, targetDateStr) {
  const lastReset = category.lastResetDate || state.lastUpdatedDate;
  
  if (lastReset >= targetDateStr) {
    return false; // すでに本日（またはそれ以降）リセット済み
  }
  
  if (category.resetTiming === 'manual') {
    return false; // 手動リセットの場合は自動日付変更ではリセットしない
  }
  
  if (category.resetTiming === 'weekly') {
    // 判定対象の日付（targetDateStr）が、設定された曜日と一致するか判定
    const targetDateObj = new Date(targetDateStr);
    const dayOfWeek = targetDateObj.getDay(); // 0 (日) - 6 (土)
    const resetDay = category.resetDayOfWeek !== undefined ? parseInt(category.resetDayOfWeek, 10) : 1;
    return dayOfWeek === resetDay;
  }
  
  // デフォルトは毎日リセット ('daily' など)
  return true;
}

// --- 初期化 & ローカルストレージロード ---
function initApp() {
  loadState();
  checkAndApplyDateTransition();
  renderApp();
  setupGlobalEventListeners();
}

// --- HTMLエスケープヘルパー ---
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// --- カテゴリー内タスク・リスト操作 ---
function addCategoryTaskItem(categoryId, text) {
  if (!text || !text.trim()) return;
  const category = state.categories.find(c => c.id === categoryId);
  if (category) {
    if (!category.items) category.items = [];
    category.items.push({
      id: 'item-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      text: text.trim(),
      isDone: false
    });
    saveState();
    renderApp();
  }
}

function submitTaskItem(categoryId) {
  const input = document.getElementById(`input-item-${categoryId}`);
  if (input && input.value) {
    addCategoryTaskItem(categoryId, input.value);
    input.value = '';
  }
}

function handleTaskInputKeyPress(event, categoryId) {
  if (event.key === 'Enter') {
    submitTaskItem(categoryId);
  }
}

function toggleCategoryTaskItem(categoryId, itemId) {
  const category = state.categories.find(c => c.id === categoryId);
  if (category && category.items) {
    const item = category.items.find(i => i.id === itemId);
    if (item) {
      // 画面全体と、該当カテゴリーカード内のタスクリストのスクロール位置を保存
      const windowScrollPos = window.scrollY;
      let listScrollTop = 0;
      const card = document.getElementById(`card-${categoryId}`);
      if (card) {
        const list = card.querySelector('.task-items-list');
        if (list) {
          listScrollTop = list.scrollTop;
        }
      }

      item.isDone = !item.isDone;
      saveState();
      renderApp();

      // スクロール位置を復元
      window.scrollTo(0, windowScrollPos);
      const newCard = document.getElementById(`card-${categoryId}`);
      if (newCard) {
        const list = newCard.querySelector('.task-items-list');
        if (list) {
          list.scrollTop = listScrollTop;
        }
      }
    }
  }
}

function removeCategoryTaskItem(categoryId, itemId) {
  const category = state.categories.find(c => c.id === categoryId);
  if (category && category.items) {
    // 画面全体と、該当カテゴリーカード内のタスクリストのスクロール位置を保存
    const windowScrollPos = window.scrollY;
    let listScrollTop = 0;
    const card = document.getElementById(`card-${categoryId}`);
    if (card) {
      const list = card.querySelector('.task-items-list');
      if (list) {
        listScrollTop = list.scrollTop;
      }
    }

    category.items = category.items.filter(i => i.id !== itemId);
    saveState();
    renderApp();

    // スクロール位置を復元
    window.scrollTo(0, windowScrollPos);
    const newCard = document.getElementById(`card-${categoryId}`);
    if (newCard) {
      const list = newCard.querySelector('.task-items-list');
      if (list) {
        list.scrollTop = listScrollTop;
      }
    }
  }
}

// --- 新規カテゴリー作成・削除 ---
function addNewCategory(name, targetMinutes, icon, resetTiming, resetDayOfWeek) {
  if (!name || !name.trim()) return;
  const newId = 'cat-' + Date.now();
  const newCat = {
    id: newId,
    name: name.trim(),
    targetMinutes: Math.max(1, parseInt(targetMinutes, 10) || 30),
    executedMinutes: 0,
    isCompleted: false,
    icon: icon || '🎯',
    items: [],
    resetTiming: resetTiming || 'daily',
    resetDayOfWeek: resetDayOfWeek !== undefined ? parseInt(resetDayOfWeek, 10) : 1,
    lastResetDate: getTodayString()
  };

  state.categories.push(newCat);
  saveState();
  renderApp();
  showToast('カテゴリー追加', `新しいカテゴリー「${newCat.name}」を作成しました！`, 'success');
}

function deleteCategory(categoryId) {
  const category = state.categories.find(c => c.id === categoryId);
  if (!category) return;

  if (confirm(`カテゴリー「${category.name}」を削除しますか？\n（※含まれるタスク項目も削除されます）`)) {
    state.categories = state.categories.filter(c => c.id !== categoryId);
    saveState();
    renderApp();
    showToast('カテゴリー削除', `「${category.name}」を削除しました。`, 'info');
  }
}

function openAddCategoryModal() {
  document.getElementById('add-cat-name-input').value = '';
  document.getElementById('add-cat-target-input').value = 30;
  document.getElementById('add-cat-icon-input').value = '🎯';
  document.getElementById('add-category-modal').classList.remove('hidden');
}

function closeAddCategoryModal() {
  document.getElementById('add-category-modal').classList.add('hidden');
}

// データ読み込み
function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      const points = typeof parsed.totalPoints === 'number' ? parsed.totalPoints : 0;
      const maxPts = typeof parsed.maxPoints === 'number' ? parsed.maxPoints : points;
      const loadedCategories = Array.isArray(parsed.categories) 
        ? parsed.categories 
        : (typeof SAMPLE_PROFILE_DATA !== 'undefined' 
            ? JSON.parse(JSON.stringify(SAMPLE_PROFILE_DATA.categories)) 
            : JSON.parse(JSON.stringify(INITIAL_CATEGORIES)));

      // items 配列の初期化保護と後方互換性担保
      const todayStr = getTodayString();
      loadedCategories.forEach(cat => {
        if (!Array.isArray(cat.items)) {
          cat.items = [];
        }
        if (!cat.resetTiming) {
          cat.resetTiming = 'daily';
        }
        if (cat.resetDayOfWeek === undefined) {
          cat.resetDayOfWeek = 1;
        }
        if (!cat.lastResetDate) {
          cat.lastResetDate = parsed.lastUpdatedDate || todayStr;
        }
      });

      state = {
        lastUpdatedDate: parsed.lastUpdatedDate || getTodayString(),
        totalPoints: points,
        maxPoints: Math.max(maxPts, points),
        categories: loadedCategories
      };
    } catch (e) {
      console.error('Failed to parse state from localStorage', e);
    }
  } else {
    // 初回起動時：優先順位に従って初期データを設定
    let initialProfile = null;
    if (typeof MY_PROFILE_DATA !== 'undefined') {
      initialProfile = MY_PROFILE_DATA;
    } else if (typeof SAMPLE_PROFILE_DATA !== 'undefined') {
      initialProfile = SAMPLE_PROFILE_DATA;
    }

    if (initialProfile) {
      state = JSON.parse(JSON.stringify(initialProfile));
      if (!state.lastUpdatedDate) {
        state.lastUpdatedDate = getTodayString();
      }
    } else {
      state.categories.forEach(cat => { cat.items = []; });
    }
    saveState();
  }
}

// データ保存
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// --- 日付切替ペナルティ処理 (要件4) ---
function checkAndApplyDateTransition() {
  const today = getTodayString();
  let lastDate = state.lastUpdatedDate;

  if (lastDate < today) {
    let daysPassed = 0;
    let pointDeductions = 0;
    let targetDeductions = 0;

    // 日付が飛んでいる場合、1日ごとにペナルティをループ計算
    while (lastDate < today) {
      daysPassed++;
      if (state.totalPoints > 0) {
        state.totalPoints = Math.max(0, state.totalPoints - 1);
        pointDeductions++;
      } else {
        // ポイントが0ならすべてのカテゴリーの目標時間を1分減少（下限1分）
        state.categories.forEach(cat => {
          cat.targetMinutes = Math.max(1, cat.targetMinutes - 1);
        });
        targetDeductions++;
      }

      const nextDate = getNextDateString(lastDate);

      // リセットタイミングに達したカテゴリーのみリセット
      state.categories.forEach(cat => {
        if (shouldResetCategory(cat, nextDate)) {
          cat.executedMinutes = 0;
          cat.isCompleted = false;
          if (cat.items && Array.isArray(cat.items)) {
            cat.items.forEach(item => {
              item.isDone = false;
            });
          }
          cat.lastResetDate = nextDate;
        }
      });

      lastDate = nextDate;
    }

    state.lastUpdatedDate = today;
    saveState();

    // 通知メッセージの作成
    let penaltyMsg = `${daysPassed}日が経過しました。\n`;
    if (pointDeductions > 0) {
      penaltyMsg += `ペナルティ: 合計ポイントが ${pointDeductions}pt 減少しました。`;
    }
    if (targetDeductions > 0) {
      penaltyMsg += `ペナルティ: ポイントが0のため、全カテゴリーの目標時間が ${targetDeductions}分 減少しました。`;
    }

    showToast('日付更新ペナルティ通知', penaltyMsg, 'warning');
  }
}

// 手動での「翌日に進める」シミュレーションテスト
function simulateNextDay() {
  // 現在動作中の全タイマーを停止
  Object.keys(activeTimers).forEach(id => stopTimer(id));

  const currentDate = new Date(state.lastUpdatedDate);
  const nextDate = getNextDateString(state.lastUpdatedDate);

  let penaltyMsg = `【日付切替テスト】(${state.lastUpdatedDate} ➔ ${nextDate})\n`;

  if (state.totalPoints > 0) {
    state.totalPoints = Math.max(0, state.totalPoints - 1);
    penaltyMsg += `▶ ポイントを -1pt 減分しました。(残り ${state.totalPoints}pt)`;
  } else {
    state.categories.forEach(cat => {
      cat.targetMinutes = Math.max(1, cat.targetMinutes - 1);
    });
    penaltyMsg += `▶ ポイントが0ptのため、全カテゴリーの目標時間を【1分減少】させました。`;
  }

  // リセットタイミングに達したカテゴリーのみリセット
  let resetCount = 0;
  state.categories.forEach(cat => {
    if (shouldResetCategory(cat, nextDate)) {
      cat.executedMinutes = 0;
      cat.isCompleted = false;
      if (cat.items && Array.isArray(cat.items)) {
        cat.items.forEach(item => {
          item.isDone = false;
        });
      }
      cat.lastResetDate = nextDate;
      resetCount++;
    }
  });

  penaltyMsg += `\n▶ ${resetCount}個のカテゴリーがリセットされました。`;

  state.lastUpdatedDate = nextDate;
  saveState();
  renderApp();

  showToast('日付進行シミュレーション', penaltyMsg, 'warning');
}

// --- タスク達成 & 増分処理 (要件3) ---
function completeTask(categoryId) {
  const category = state.categories.find(c => c.id === categoryId);
  if (!category) return;

  // タイマーが動いていれば停止
  stopTimer(categoryId);

  // 増分ルール適用: +1ポイント ＆ このカテゴリーの次回目標時間 +1分
  state.totalPoints += 1;
  if (state.totalPoints > state.maxPoints) {
    state.maxPoints = state.totalPoints;
  }
  category.targetMinutes += 1;
  category.isCompleted = true;

  saveState();
  renderApp();

  showToast(
    '🎉 タスク達成おめでとうございます！',
    `「${category.name}」を達成！\n+1pt獲得 (${state.totalPoints} / ${state.maxPoints} pt) / 次回目標時間が ${category.targetMinutes}分 にレベルアップ！`,
    'success'
  );
}

// --- タイマー機能 (要件2) ---
function toggleTimer(categoryId) {
  if (activeTimers[categoryId]?.intervalId) {
    stopTimer(categoryId);
  } else {
    startTimer(categoryId);
  }
}

function updateTimerTick(categoryId) {
  const timer = activeTimers[categoryId];
  if (!timer || !timer.intervalId || !timer.lastTick) return;

  const now = Date.now();
  const deltaMs = now - timer.lastTick;

  if (deltaMs >= 1000) {
    const deltaSeconds = Math.floor(deltaMs / 1000);
    timer.lastTick += deltaSeconds * 1000;
    timer.seconds += deltaSeconds;

    const category = state.categories.find(c => c.id === categoryId);
    if (category) {
      if (timer.seconds >= 60) {
        const addedMinutes = Math.floor(timer.seconds / 60);
        timer.seconds = timer.seconds % 60;
        category.executedMinutes += addedMinutes;
        saveState();

        // 目標時間到達時の自動停止チェック
        if (category.executedMinutes >= category.targetMinutes) {
          stopTimer(categoryId);
          showToast('🏆 目標達成！', `「${category.name}」の本日の目標時間に到達しました！`, 'success');
          return;
        }
      }
      updateCategoryCardUI(categoryId);
    }
  }
}

function startTimer(categoryId) {
  if (activeTimers[categoryId]?.intervalId) return;

  // 他のすべての動いているタイマーを自動で一時停止する（排他制御）
  Object.keys(activeTimers).forEach(id => {
    if (id !== categoryId && activeTimers[id]?.intervalId) {
      stopTimer(id);
    }
  });

  if (!activeTimers[categoryId]) {
    activeTimers[categoryId] = { seconds: 0, intervalId: null, lastTick: null };
  }

  activeTimers[categoryId].lastTick = Date.now();
  activeTimers[categoryId].intervalId = setInterval(() => {
    updateTimerTick(categoryId);
  }, 1000);

  updateCategoryCardUI(categoryId);
}

function stopTimer(categoryId) {
  if (activeTimers[categoryId]?.intervalId) {
    clearInterval(activeTimers[categoryId].intervalId);
    activeTimers[categoryId].intervalId = null;
    activeTimers[categoryId].lastTick = null;
    saveState();
    updateCategoryCardUI(categoryId);
  }
}

function resetTimer(categoryId) {
  stopTimer(categoryId);
  if (activeTimers[categoryId]) {
    activeTimers[categoryId].seconds = 0;
    activeTimers[categoryId].lastTick = null;
  }
  const category = state.categories.find(c => c.id === categoryId);
  if (category) {
    category.executedMinutes = 0;
    saveState();
  }
  updateCategoryCardUI(categoryId);
}

// --- カテゴリー詳細編集（名称・目標時間・アイコン） ---
let currentEditCategoryId = null;

function openEditCategoryModal(categoryId) {
  const category = state.categories.find(c => c.id === categoryId);
  if (!category) return;

  currentEditCategoryId = categoryId;
  document.getElementById('edit-cat-name-input').value = category.name;
  document.getElementById('edit-cat-target-input').value = category.targetMinutes;
  document.getElementById('edit-cat-icon-input').value = category.icon || '🎯';
  
  const timing = category.resetTiming || 'daily';
  const day = category.resetDayOfWeek !== undefined ? category.resetDayOfWeek : 1;
  document.getElementById('edit-cat-reset-timing').value = timing;
  const daySelect = document.getElementById('edit-cat-reset-day');
  daySelect.value = day;
  daySelect.disabled = (timing !== 'weekly');

  document.getElementById('edit-category-modal').classList.remove('hidden');
}

function closeEditCategoryModal() {
  currentEditCategoryId = null;
  document.getElementById('edit-category-modal').classList.add('hidden');
}

// --- 手動個別リセット処理 ---
function resetCategoryProgress(categoryId) {
  const category = state.categories.find(c => c.id === categoryId);
  if (!category) return;
  
  if (confirm(`カテゴリー「${category.name}」の実績時間とチェックリストをリセットしますか？`)) {
    // タイマーが動いていれば停止
    stopTimer(categoryId);
    
    category.executedMinutes = 0;
    category.isCompleted = false;
    if (category.items && Array.isArray(category.items)) {
      category.items.forEach(item => {
        item.isDone = false;
      });
    }
    category.lastResetDate = getTodayString();
    
    if (activeTimers[categoryId]) {
      activeTimers[categoryId].seconds = 0;
      activeTimers[categoryId].lastTick = null;
    }
    
    saveState();
    renderApp();
    showToast('手動リセット完了', `「${category.name}」の進捗をリセットしました。`, 'info');
  }
}

function saveCategoryEdit(newName, newTarget, newIcon, newResetTiming, newResetDayOfWeek) {
  if (!currentEditCategoryId) return;
  const category = state.categories.find(c => c.id === currentEditCategoryId);
  if (category) {
    if (newName && newName.trim()) {
      category.name = newName.trim();
    }
    const parsedTarget = parseInt(newTarget, 10);
    if (!isNaN(parsedTarget) && parsedTarget >= 1) {
      category.targetMinutes = parsedTarget;
    }
    if (newIcon && newIcon.trim()) {
      category.icon = newIcon.trim();
    }
    if (newResetTiming) {
      category.resetTiming = newResetTiming;
    }
    if (newResetDayOfWeek !== undefined) {
      category.resetDayOfWeek = parseInt(newResetDayOfWeek, 10);
    }
    saveState();
    renderApp();
    showToast('カテゴリー更新', `「${category.name}」の設定を更新しました。`, 'info');
  }
  closeEditCategoryModal();
}

// --- 全データ初期化 ---
function resetAllData() {
  if (confirm('すべてのポイント、目標時間、実績データを初期状態にリセットしますか？\n(読み込まれているプロファイルの初期状態に戻ります)')) {
    Object.keys(activeTimers).forEach(id => stopTimer(id));
    
    let initialProfile = null;
    if (typeof MY_PROFILE_DATA !== 'undefined') {
      initialProfile = MY_PROFILE_DATA;
    } else if (typeof SAMPLE_PROFILE_DATA !== 'undefined') {
      initialProfile = SAMPLE_PROFILE_DATA;
    }

    if (initialProfile) {
      state = JSON.parse(JSON.stringify(initialProfile));
      state.lastUpdatedDate = getTodayString();
    } else {
      state = {
        lastUpdatedDate: getTodayString(),
        totalPoints: 0,
        maxPoints: 0,
        categories: JSON.parse(JSON.stringify(INITIAL_CATEGORIES))
      };
    }
    saveState();
    renderApp();
    showToast('リセット完了', '初期プロファイルデータにリセットしました。', 'info');
  }
}

// --- UI描画処理 ---
function renderApp() {
  // ステータス表示
  document.getElementById('total-points').innerText = state.totalPoints;
  const maxPtsElem = document.getElementById('max-points');
  if (maxPtsElem) {
    maxPtsElem.innerText = state.maxPoints;
  }

  document.getElementById('user-level').innerText = getRankName(state.totalPoints);
  document.getElementById('last-date').innerText = state.lastUpdatedDate;

  // ポイントプログレスバー更新
  const pointsProgressBar = document.getElementById('points-progress-bar');
  if (pointsProgressBar) {
    const ratio = state.maxPoints > 0 ? Math.min(100, Math.round((state.totalPoints / state.maxPoints) * 100)) : 0;
    pointsProgressBar.style.width = `${ratio}%`;
  }

  // カテゴリーグリッド描画
  const gridContainer = document.getElementById('category-grid');
  gridContainer.innerHTML = '';

  if (state.categories.length === 0) {
    gridContainer.innerHTML = `
      <div class="empty-categories-msg">
        <i class="fa-solid fa-folder-open"></i>
        <p style="font-size:1.1rem; font-weight:700; color:var(--text-main); margin-bottom:0.5rem;">カテゴリーが登録されていません</p>
        <p style="font-size:0.9rem; margin-bottom:1.5rem;">「新規カテゴリー追加」ボタンから管理したいカテゴリーを作成してください。</p>
        <button class="btn btn-primary" onclick="openAddCategoryModal()"><i class="fa-solid fa-plus"></i> 新しいカテゴリーを作成</button>
      </div>
    `;
    return;
  }

  state.categories.forEach(category => {
    const card = document.createElement('div');
    card.className = `category-card ${category.isCompleted ? 'completed' : ''}`;
    card.id = `card-${category.id}`;

    const dayLabels = ['日', '月', '火', '水', '木', '金', '土'];
    let resetLabel = '';
    if (category.resetTiming === 'weekly') {
      const dayStr = dayLabels[category.resetDayOfWeek !== undefined ? category.resetDayOfWeek : 1];
      resetLabel = `毎週${dayStr}曜`;
    } else if (category.resetTiming === 'manual') {
      resetLabel = '手動';
    } else {
      resetLabel = '毎日';
    }

    card.innerHTML = `
      <div class="card-header">
        <div class="card-title-group">
          <div class="category-icon">${category.icon}</div>
          <div>
            <h2 class="category-name">${category.name}</h2>
            <div style="margin-top:0.25rem;">
              <span class="reset-badge"><i class="fa-solid fa-clock-rotate-left"></i> ${resetLabel}リセット</span>
            </div>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:0.4rem;">
          ${category.isCompleted ? '<span class="completed-badge"><i class="fa-solid fa-check"></i> 達成記録あり</span>' : ''}
          <button class="btn-icon btn-delete-category" onclick="deleteCategory('${category.id}')" title="カテゴリーを削除">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </div>

      <div class="time-info">
        <div class="time-row" style="margin-bottom: 0.5rem;">
          <span class="target-label"><i class="fa-solid fa-bullseye"></i> 本日の目標時間</span>
          <div class="target-val">
            <span class="target-num">${category.targetMinutes}</span> <span class="unit">分</span>
          </div>
        </div>
        <div class="time-row" style="margin-bottom: 0.8rem; align-items: baseline;">
          <span class="target-label"><i class="fa-solid fa-clock-rotate-left"></i> 実績時間</span>
          <div class="executed-val">
            <span>${category.executedMinutes}</span> / ${category.targetMinutes} <span style="font-size:0.8rem; font-weight:normal; color:var(--text-muted);">分</span>
          </div>
        </div>
        <div class="progress-container" style="margin-bottom: 1rem;">
          <div class="progress-bar" style="width: ${Math.min(100, Math.round((category.executedMinutes / category.targetMinutes) * 100))}%"></div>
        </div>
      </div>

      <!-- タイマーセクション -->
      <div class="timer-section" style="margin-bottom: 1.2rem;">
        <div id="timer-disp-${category.id}" class="timer-display ${activeTimers[category.id]?.intervalId ? 'running' : ''}">
          <i class="fa-solid fa-stopwatch" style="font-size:1rem; opacity:0.7; margin-right:0.3rem;"></i> ${category.executedMinutes}分 ${String(activeTimers[category.id]?.seconds || 0).padStart(2, '0')}秒
        </div>
        <div class="timer-controls">
          <button id="timer-btn-${category.id}" class="btn btn-sm ${activeTimers[category.id]?.intervalId ? 'btn-secondary' : 'btn-primary'}" onclick="toggleTimer('${category.id}')">
            ${activeTimers[category.id]?.intervalId ? '<i class="fa-solid fa-pause"></i> 一時停止' : '<i class="fa-solid fa-play"></i> スタート'}
          </button>
          <button class="btn btn-sm btn-ghost" onclick="resetTimer('${category.id}')" title="タイマーをリセット">
            <i class="fa-solid fa-arrow-rotate-left"></i>
          </button>
        </div>
      </div>

      <!-- タスク・習慣リストセクション -->
      <div class="task-list-section">
        <div class="task-list-header">
          <span><i class="fa-solid fa-list-check"></i> タスク・習慣リスト</span>
          <div style="display:flex; align-items:center; gap:0.4rem;">
            ${category.resetTiming === 'manual' ? `<button class="btn-reset-checklist" onclick="resetCategoryProgress('${category.id}')" title="進捗とチェックリストを手動リセット"><i class="fa-solid fa-arrows-rotate"></i> リセット</button>` : ''}
            <span class="task-count">${(category.items || []).filter(i => i.isDone).length}/${(category.items || []).length}</span>
          </div>
        </div>
        <div class="task-input-row">
          <input type="text" id="input-item-${category.id}" class="task-item-input" placeholder="タスク・習慣を追加..." onkeypress="handleTaskInputKeyPress(event, '${category.id}')">
          <button class="btn btn-sm btn-secondary" onclick="submitTaskItem('${category.id}')"><i class="fa-solid fa-plus"></i> 追加</button>
        </div>
        <ul class="task-items-list">
          ${(category.items || []).length === 0 ? '<li style="font-size:0.8rem; color:var(--text-dim); text-align:center; padding:0.5rem 0;">タスクや習慣を追加できます</li>' : ''}
          ${(category.items || []).map(item => `
            <li class="task-item ${item.isDone ? 'done' : ''}">
              <label class="task-item-label">
                <input type="checkbox" ${item.isDone ? 'checked' : ''} onchange="toggleCategoryTaskItem('${category.id}', '${item.id}')">
                <span class="task-item-text">${escapeHtml(item.text)}</span>
              </label>
              <button class="btn-icon btn-delete-item" onclick="removeCategoryTaskItem('${category.id}', '${item.id}')" title="削除">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </li>
          `).join('')}
        </ul>
      </div>

      <div class="card-actions">
        <button class="btn btn-secondary btn-sm" onclick="openEditCategoryModal('${category.id}')">
          <i class="fa-solid fa-pen-to-square"></i> 設定変更
        </button>
        <button class="btn btn-sm btn-success" onclick="completeTask('${category.id}')">
          <i class="fa-solid fa-trophy"></i> 達成完了！
        </button>
      </div>
    `;

    gridContainer.appendChild(card);
  });
}

// タイマー更新時の部分UI描写
function updateCategoryCardUI(categoryId) {
  const category = state.categories.find(c => c.id === categoryId);
  if (!category) return;

  const card = document.getElementById(`card-${categoryId}`);
  if (!card) return;

  // 実績時間の表示更新
  const progressPercent = Math.min(100, Math.round((category.executedMinutes / category.targetMinutes) * 100));
  const executedDisplay = card.querySelector('.executed-val');
  if (executedDisplay) {
    executedDisplay.innerHTML = `<span>${category.executedMinutes}</span> / ${category.targetMinutes} <span style="font-size:0.8rem; font-weight:normal; color:var(--text-muted);">分</span>`;
  }

  const progressBar = card.querySelector('.progress-bar');
  if (progressBar) {
    progressBar.style.width = `${progressPercent}%`;
  }

  updateTimerDisplayUI(categoryId);
}

function updateTimerDisplayUI(categoryId) {
  const category = state.categories.find(c => c.id === categoryId);
  if (!category) return;

  const timerDisp = document.getElementById(`timer-disp-${categoryId}`);
  if (timerDisp) {
    const isRunning = !!activeTimers[categoryId]?.intervalId;
    const currentTimerSeconds = activeTimers[categoryId]?.seconds || 0;
    const formattedSeconds = String(currentTimerSeconds).padStart(2, '0');

    timerDisp.className = `timer-display ${isRunning ? 'running' : ''}`;
    timerDisp.innerHTML = `<i class="fa-solid fa-stopwatch" style="font-size:1rem; opacity:0.7; margin-right:0.3rem;"></i> ${category.executedMinutes}分 ${formattedSeconds}秒`;
  }

  // スタート / 一時停止 ボタンの見た目を更新
  const timerBtn = document.getElementById(`timer-btn-${categoryId}`);
  if (timerBtn) {
    const isRunning = !!activeTimers[categoryId]?.intervalId;
    if (isRunning) {
      timerBtn.className = 'btn btn-sm btn-secondary';
      timerBtn.innerHTML = '<i class="fa-solid fa-pause"></i> 一時停止';
    } else {
      timerBtn.className = 'btn btn-sm btn-primary';
      timerBtn.innerHTML = '<i class="fa-solid fa-play"></i> スタート';
    }
  }
}

// --- トースト通知機能 ---
function showToast(title, message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let iconClass = 'fa-info-circle';
  if (type === 'success') iconClass = 'fa-circle-check';
  if (type === 'warning') iconClass = 'fa-triangle-exclamation';

  toast.innerHTML = `
    <i class="fa-solid ${iconClass} toast-icon"></i>
    <div>
      <div class="toast-title">${title}</div>
      <div class="toast-msg" style="white-space: pre-line;">${message}</div>
    </div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}

// --- イベントリスナー設定 ---
function setupGlobalEventListeners() {
  // 翌日に進めるボタン
  document.getElementById('btn-next-day').addEventListener('click', simulateNextDay);

  // 全リセットボタン
  document.getElementById('btn-reset-all').addEventListener('click', resetAllData);

  // カテゴリー編集モーダルイベント
  document.getElementById('edit-cat-close-btn').addEventListener('click', closeEditCategoryModal);
  document.getElementById('edit-cat-cancel-btn').addEventListener('click', closeEditCategoryModal);

  document.getElementById('edit-cat-submit-btn').addEventListener('click', () => {
    const name = document.getElementById('edit-cat-name-input').value;
    const target = document.getElementById('edit-cat-target-input').value;
    const icon = document.getElementById('edit-cat-icon-input').value;
    const resetTiming = document.getElementById('edit-cat-reset-timing').value;
    const resetDay = document.getElementById('edit-cat-reset-day').value;
    saveCategoryEdit(name, target, icon, resetTiming, resetDay);
  });

  // 編集モーダルのリセットタイミング変更イベント
  document.getElementById('edit-cat-reset-timing').addEventListener('change', (e) => {
    document.getElementById('edit-cat-reset-day').disabled = (e.target.value !== 'weekly');
  });

  // 編集モーダルのクイック時間設定ボタン
  document.querySelectorAll('.edit-quick-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetVal = parseInt(e.target.getAttribute('data-edit-target'), 10);
      document.getElementById('edit-cat-target-input').value = targetVal;
    });
  });

  // 編集モーダルのアイコン選択チップ
  document.querySelectorAll('.edit-icon-chip').forEach(chip => {
    chip.addEventListener('click', (e) => {
      e.preventDefault();
      const selectedIcon = e.target.getAttribute('data-icon');
      document.getElementById('edit-cat-icon-input').value = selectedIcon;
    });
  });

  // 新規カテゴリー追加モーダル
  document.getElementById('btn-open-add-category').addEventListener('click', () => {
    openAddCategoryModal();
    document.getElementById('add-cat-reset-timing').value = 'daily';
    document.getElementById('add-cat-reset-day').value = '1';
    document.getElementById('add-cat-reset-day').disabled = true;
  });
  document.getElementById('add-cat-close-btn').addEventListener('click', closeAddCategoryModal);
  document.getElementById('add-cat-cancel-btn').addEventListener('click', closeAddCategoryModal);

  document.getElementById('add-cat-submit-btn').addEventListener('click', () => {
    const name = document.getElementById('add-cat-name-input').value;
    const target = document.getElementById('add-cat-target-input').value;
    const icon = document.getElementById('add-cat-icon-input').value;
    const resetTiming = document.getElementById('add-cat-reset-timing').value;
    const resetDay = document.getElementById('add-cat-reset-day').value;
    if (name && name.trim()) {
      addNewCategory(name, target, icon, resetTiming, resetDay);
      closeAddCategoryModal();
    } else {
      alert('カテゴリー名を入力してください。');
    }
  });

  // 新規追加モーダルのリセットタイミング変更イベント
  document.getElementById('add-cat-reset-timing').addEventListener('change', (e) => {
    document.getElementById('add-cat-reset-day').disabled = (e.target.value !== 'weekly');
  });

  // アイコン選択チップのイベント
  document.querySelectorAll('.icon-chip').forEach(chip => {
    chip.addEventListener('click', (e) => {
      e.preventDefault();
      const selectedIcon = e.target.getAttribute('data-icon');
      document.getElementById('add-cat-icon-input').value = selectedIcon;
    });
  });

  // スペースキーによるタイマー一括一時停止イベント
  window.addEventListener('keydown', (event) => {
    if (event.code === 'Space' && document.activeElement.tagName !== 'INPUT') {
      event.preventDefault(); // デフォルトのスクロール挙動を防止

      // 現在稼働中のタイマーをすべて取得して一時停止
      const runningTimerIds = Object.keys(activeTimers).filter(id => activeTimers[id]?.intervalId);

      if (runningTimerIds.length > 0) {
        runningTimerIds.forEach(id => stopTimer(id));
        showToast('⏸ 一時停止', '実行中のタイマーをすべて一時停止しました。', 'info');
      }
    }
  });

  // タブがアクティブになったときにタイマーの経過時間を即時同期する
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      Object.keys(activeTimers).forEach(categoryId => {
        if (activeTimers[categoryId]?.intervalId) {
          updateTimerTick(categoryId);
        }
      });
    }
  });

  // データのエクスポート（バックアップ出力）
  document.getElementById('btn-export-data').addEventListener('click', () => {
    // 実行中のタイマーがあれば一時停止する
    const runningTimerIds = Object.keys(activeTimers).filter(id => activeTimers[id]?.intervalId);
    if (runningTimerIds.length > 0) {
      runningTimerIds.forEach(id => stopTimer(id));
      showToast('⏸ タイマー一時停止', 'バックアップ出力のため、実行中のタイマーを一時停止しました。', 'info');
    }

    const dataStr = JSON.stringify(state, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStr = getTodayString();
    
    link.download = `mainichi_mileage_backup_${dateStr}.json`;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('💾 バックアップ出力', 'データをJSONファイルとして出力しました。', 'success');
  });

  // データのインポート（バックアップ読込）
  const fileInput = document.getElementById('import-file-input');
  document.getElementById('btn-import-data').addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        
        // 簡易バリデーション
        if (!parsed || typeof parsed !== 'object') {
          throw new Error('データ形式が正しくありません。');
        }
        if (!Array.isArray(parsed.categories)) {
          throw new Error('カテゴリーデータが見つかりません。');
        }
        
        // 実行中のタイマーがあればすべて停止
        Object.keys(activeTimers).forEach(id => stopTimer(id));

        // データの適用と初期値保護（ロード処理と互換）
        const todayStr = getTodayString();
        const points = typeof parsed.totalPoints === 'number' ? parsed.totalPoints : 0;
        const maxPts = typeof parsed.maxPoints === 'number' ? parsed.maxPoints : points;
        const loadedCategories = parsed.categories;

        loadedCategories.forEach(cat => {
          if (!Array.isArray(cat.items)) {
            cat.items = [];
          }
          if (!cat.resetTiming) {
            cat.resetTiming = 'daily';
          }
          if (cat.resetDayOfWeek === undefined) {
            cat.resetDayOfWeek = 1;
          }
          if (!cat.lastResetDate) {
            cat.lastResetDate = parsed.lastUpdatedDate || todayStr;
          }
        });

        state = {
          lastUpdatedDate: parsed.lastUpdatedDate || todayStr,
          totalPoints: points,
          maxPoints: Math.max(maxPts, points),
          categories: loadedCategories
        };

        // 状態保存と描画更新
        saveState();
        renderApp();
        showToast('🔄 バックアップ復元', 'データをバックアップファイルから復元しました！', 'success');
      } catch (err) {
        showToast('❌ 読み込み失敗', `無効なファイルです: ${err.message}`, 'warning');
      } finally {
        // 同じファイルを再度インポートできるように入力をリセット
        fileInput.value = '';
      }
    };
    reader.readAsText(file);
  });
}

// アプリケーション起動
document.addEventListener('DOMContentLoaded', initApp);

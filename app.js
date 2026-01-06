// ========================================
// 野球スコア管理 PWA - メインアプリケーション
// ========================================

// ========================================
// データ管理
// ========================================

const Storage = {
    get(key) {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    },
    
    set(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    },
    
    getTeams() {
        return this.get('teams') || [];
    },
    
    saveTeams(teams) {
        this.set('teams', teams);
    },
    
    getTeam(teamId) {
        const teams = this.getTeams();
        return teams.find(t => t.id === teamId);
    },
    
    saveTeam(team) {
        const teams = this.getTeams();
        const index = teams.findIndex(t => t.id === team.id);
        if (index >= 0) {
            teams[index] = team;
        } else {
            teams.push(team);
        }
        this.saveTeams(teams);
    },
    
    deleteTeam(teamId) {
        const teams = this.getTeams().filter(t => t.id !== teamId);
        this.saveTeams(teams);
    },
    
    getLocations(teamId) {
        return this.get(`locations_${teamId}`) || [];
    },
    
    addLocation(teamId, location) {
        const locations = this.getLocations(teamId);
        if (!locations.includes(location)) {
            locations.unshift(location);
            this.set(`locations_${teamId}`, locations.slice(0, 20));
        }
    },
    
    getOpponents(teamId) {
        return this.get(`opponents_${teamId}`) || [];
    },
    
    addOpponent(teamId, opponent) {
        const opponents = this.getOpponents(teamId);
        if (!opponents.includes(opponent)) {
            opponents.unshift(opponent);
            this.set(`opponents_${teamId}`, opponents.slice(0, 20));
        }
    }
};

// ========================================
// ユーティリティ
// ========================================

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
}

function formatDateShort(dateStr) {
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    const weekday = weekdays[date.getDay()];
    return `${month}/${day} (${weekday})`;
}

function getYear(dateStr) {
    return new Date(dateStr).getFullYear();
}

function calculatePlayerStats(team, playerId) {
    const stats = { atBats: 0, hits: 0, walks: 0, homeRuns: 0, singles: 0, doubles: 0, triples: 0 };
    const games = team.games || [];
    games.forEach(game => {
        (game.innings || []).forEach(inning => {
            (inning.atBats || []).forEach(ab => {
                if (ab.playerId === playerId) {
                    stats.atBats++;
                    switch (ab.result) {
                        case 'single': stats.hits++; stats.singles++; break;
                        case 'double': stats.hits++; stats.doubles++; break;
                        case 'triple': stats.hits++; stats.triples++; break;
                        case 'homeRun': stats.hits++; stats.homeRuns++; break;
                        case 'walk': stats.walks++; break;
                    }
                }
            });
        });
    });
    const avg = stats.atBats > 0 ? (stats.hits / stats.atBats) : 0;
    const obp = (stats.atBats + stats.walks) > 0 ? ((stats.hits + stats.walks) / (stats.atBats + stats.walks)) : 0;
    const totalBases = stats.singles + (stats.doubles * 2) + (stats.triples * 3) + (stats.homeRuns * 4);
    const slg = stats.atBats > 0 ? (totalBases / stats.atBats) : 0;
    const ops = obp + slg;
    return {
        avg: avg.toFixed(3).replace('0.', '.'),
        obp: obp.toFixed(3).replace('0.', '.'),
        homeRuns: stats.homeRuns,
        ops: ops.toFixed(3)
    };
}

const AtBatResults = {
    single: { name: 'ヒット', icon: '1B', type: 'hit', outs: 0 },
    double: { name: '2塁打', icon: '2B', type: 'hit', outs: 0 },
    triple: { name: '3塁打', icon: '3B', type: 'hit', outs: 0 },
    homeRun: { name: 'HR', icon: 'HR', type: 'hit', outs: 0 },
    walk: { name: '四死球', icon: 'BB', type: 'walk', outs: 0 },
    error: { name: 'エラー', icon: 'E', type: 'walk', outs: 0 },
    sacrifice: { name: '犠牲', icon: '犠', type: 'sacrifice', outs: 1 },
    out: { name: 'アウト', icon: '凡', type: 'out', outs: 1 },
    doublePlay: { name: '併殺', icon: '併', type: 'out', outs: 2 },
    triplePlay: { name: '三殺', icon: '三', type: 'out', outs: 3 }
};

// ========================================
// アプリ状態管理
// ========================================

const App = {
    currentView: 'home',
    currentTeam: null,
    currentYear: null,
    currentGame: null,
    
    init() { this.render(); },
    
    navigate(view, params = {}) {
        this.currentView = view;
        Object.assign(this, params);
        this.render();
    },
    
    render() {
        const app = document.getElementById('app');
        switch (this.currentView) {
            case 'home': app.innerHTML = HomeView.render(); HomeView.attachEvents(); break;
            case 'teamManagement': app.innerHTML = TeamManagementView.render(); TeamManagementView.attachEvents(); break;
            case 'playerManagement': app.innerHTML = PlayerManagementView.render(this.currentTeam); PlayerManagementView.attachEvents(); break;
            case 'yearList': app.innerHTML = YearListView.render(this.currentTeam); YearListView.attachEvents(); break;
            case 'gameList': app.innerHTML = GameListView.render(this.currentTeam, this.currentYear); GameListView.attachEvents(); break;
            case 'gameSetup': app.innerHTML = GameSetupView.render(this.currentTeam); GameSetupView.attachEvents(); break;
            case 'gameScore': app.innerHTML = GameScoreView.render(this.currentTeam, this.currentGame); GameScoreView.attachEvents(); break;
            case 'playerStats': app.innerHTML = PlayerStatsView.render(this.currentTeam, this.currentPlayer); PlayerStatsView.attachEvents(); break;
        }
    }
};

// ========================================
// ホーム画面
// ========================================

const HomeView = {
    render() {
        const teams = Storage.getTeams();
        return `
            <div class="header">
                <div class="header-icon">⚾</div>
                <h1>野球スコア管理</h1>
            </div>
            <div class="card">
                <button class="btn btn-outline" onclick="HomeView.openTeamManagement()">⚙️ チーム・選手管理</button>
            </div>
            ${teams.length === 0 ? `
                <div class="empty-state">
                    <div class="empty-state-icon">👥</div>
                    <div class="empty-state-text">チームが登録されていません</div>
                    <button class="btn btn-primary" onclick="HomeView.openTeamManagement()">チームを追加</button>
                </div>
            ` : `
                <div class="card"><div class="card-title">チームを選択</div></div>
                ${teams.map(team => `
                    <div class="list-item" onclick="HomeView.selectTeam('${team.id}')">
                        <div class="list-item-icon">${team.name.charAt(0)}</div>
                        <div class="list-item-content">
                            <div class="list-item-title">${team.name}</div>
                            <div class="list-item-subtitle">${team.players ? team.players.length : 0}人 • ${team.games ? team.games.length : 0}試合</div>
                        </div>
                        <div class="list-item-arrow">›</div>
                    </div>
                `).join('')}
            `}
        `;
    },
    attachEvents() {},
    selectTeam(teamId) { App.navigate('yearList', { currentTeam: Storage.getTeam(teamId) }); },
    openTeamManagement() { App.navigate('teamManagement'); }
};

// ========================================
// チーム管理
// ========================================

const TeamManagementView = {
    render() {
        const teams = Storage.getTeams();
        return `
            <div class="header"><div class="header-with-back">
                <button class="back-button" onclick="App.navigate('home')">←</button>
                <h1>チーム管理</h1>
            </div></div>
            <div class="card">
                <div class="form-group"><input type="text" id="newTeamName" class="form-input" placeholder="新しいチーム名"></div>
                <button class="btn btn-primary" onclick="TeamManagementView.addTeam()">＋ チームを追加</button>
            </div>
            ${teams.map(team => `
                <div class="list-item">
                    <div class="list-item-icon">${team.name.charAt(0)}</div>
                    <div class="list-item-content" onclick="TeamManagementView.managePlayersFor('${team.id}')">
                        <div class="list-item-title">${team.name}</div>
                        <div class="list-item-subtitle">${team.players ? team.players.length : 0}人の選手</div>
                    </div>
                    <button class="btn btn-small btn-danger" onclick="TeamManagementView.deleteTeam('${team.id}')" style="width:auto;">削除</button>
                </div>
            `).join('')}
        `;
    },
    attachEvents() {},
    addTeam() {
        const input = document.getElementById('newTeamName');
        const name = input.value.trim();
        if (!name) { alert('チーム名を入力してください'); return; }
        Storage.saveTeam({ id: generateId(), name, players: [], games: [], createdAt: new Date().toISOString() });
        input.value = '';
        App.render();
    },
    deleteTeam(teamId) { if (confirm('このチームを削除しますか？')) { Storage.deleteTeam(teamId); App.render(); } },
    managePlayersFor(teamId) { App.navigate('playerManagement', { currentTeam: Storage.getTeam(teamId) }); }
};

// ========================================
// 選手管理
// ========================================

const PlayerManagementView = {
    render(team) {
        const players = team.players || [];
        const pitchers = players.filter(p => p.isPitcher);
        const fielders = players.filter(p => !p.isPitcher);
        return `
            <div class="header"><div class="header-with-back">
                <button class="back-button" onclick="App.navigate('teamManagement')">←</button>
                <h1>${team.name} - 選手管理</h1>
            </div></div>
            <div class="card">
                <div class="form-group"><input type="text" id="playerName" class="form-input" placeholder="選手名"></div>
                <div class="form-group"><input type="number" id="playerNumber" class="form-input" placeholder="背番号"></div>
                <div class="form-group"><label style="display:flex;align-items:center;gap:10px;"><input type="checkbox" id="isPitcher"><span>投手として登録</span></label></div>
                <button class="btn btn-primary" onclick="PlayerManagementView.addPlayer()">＋ 選手を追加</button>
            </div>
            ${pitchers.length > 0 ? `<div class="card"><div class="card-title">投手 (${pitchers.length}人)</div>${pitchers.map(p => this.renderPlayerItem(p)).join('')}</div>` : ''}
            ${fielders.length > 0 ? `<div class="card"><div class="card-title">野手 (${fielders.length}人)</div>${fielders.map(p => this.renderPlayerItem(p)).join('')}</div>` : ''}
            ${players.length === 0 ? `<div class="empty-state"><div class="empty-state-icon">👤</div><div class="empty-state-text">選手が登録されていません</div></div>` : ''}
        `;
    },
    renderPlayerItem(player) {
        return `<div class="batting-order-item"><div class="player-number">#${player.number || '-'}</div><div class="batting-order-name">${player.name}</div>${player.isPitcher ? '<span class="player-position">投手</span>' : ''}<button class="batting-order-remove" onclick="PlayerManagementView.deletePlayer('${player.id}')">×</button></div>`;
    },
    attachEvents() {},
    addPlayer() {
        const name = document.getElementById('playerName').value.trim();
        const number = document.getElementById('playerNumber').value;
        const isPitcher = document.getElementById('isPitcher').checked;
        if (!name) { alert('選手名を入力してください'); return; }
        const team = App.currentTeam;
        if (!team.players) team.players = [];
        team.players.push({ id: generateId(), name, number: number ? parseInt(number) : null, isPitcher });
        Storage.saveTeam(team);
        document.getElementById('playerName').value = '';
        document.getElementById('playerNumber').value = '';
        document.getElementById('isPitcher').checked = false;
        App.render();
    },
    deletePlayer(playerId) {
        if (confirm('この選手を削除しますか？')) {
            const team = App.currentTeam;
            team.players = team.players.filter(p => p.id !== playerId);
            Storage.saveTeam(team);
            App.render();
        }
    }
};

// ========================================
// 年度一覧
// ========================================

const YearListView = {
    render(team) {
        const games = team.games || [];
        const years = [...new Set(games.map(g => getYear(g.date)))].sort((a, b) => b - a);
        return `
            <div class="header"><div class="header-with-back">
                <button class="back-button" onclick="App.navigate('home')">←</button>
                <h1>${team.name}</h1>
            </div></div>
            <div class="card">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">
                    <div><div class="card-title" style="margin:0;">登録選手</div><div style="font-size:1.5rem;font-weight:700;">${team.players ? team.players.length : 0}人</div></div>
                    <div><div class="card-title" style="margin:0;">総試合数</div><div style="font-size:1.5rem;font-weight:700;">${games.length}試合</div></div>
                </div>
                <button class="btn btn-outline btn-small" onclick="YearListView.managePlayersFor()">選手を管理</button>
            </div>
            <div class="card"><button class="btn btn-primary" onclick="YearListView.createGame()">＋ 新しい試合を登録</button></div>
            ${years.length === 0 ? `<div class="empty-state"><div class="empty-state-icon">📅</div><div class="empty-state-text">試合がありません</div></div>` : years.map(year => {
                const yearGames = games.filter(g => getYear(g.date) === year);
                const wins = yearGames.filter(g => g.teamTotalRuns > g.opponentTotalRuns).length;
                const losses = yearGames.filter(g => g.teamTotalRuns < g.opponentTotalRuns).length;
                const draws = yearGames.length - wins - losses;
                return `
                    <div class="list-item" onclick="YearListView.selectYear(${year})">
                        <div class="list-item-content"><div class="list-item-title">${year}年</div><div class="list-item-subtitle">${yearGames.length}試合</div></div>
                        <div style="display:flex;gap:15px;">
                            <div style="text-align:center;"><div style="font-weight:700;color:var(--success-color);">${wins}</div><div style="font-size:0.7rem;color:var(--text-secondary);">勝</div></div>
                            <div style="text-align:center;"><div style="font-weight:700;color:var(--danger-color);">${losses}</div><div style="font-size:0.7rem;color:var(--text-secondary);">敗</div></div>
                            ${draws > 0 ? `<div style="text-align:center;"><div style="font-weight:700;color:var(--text-secondary);">${draws}</div><div style="font-size:0.7rem;color:var(--text-secondary);">分</div></div>` : ''}
                        </div>
                        <div class="list-item-arrow">›</div>
                    </div>
                `;
            }).join('')}
        `;
    },
    attachEvents() {},
    selectYear(year) { App.navigate('gameList', { currentTeam: App.currentTeam, currentYear: year }); },
    createGame() { App.navigate('gameSetup', { currentTeam: App.currentTeam }); },
    managePlayersFor() { App.navigate('playerManagement', { currentTeam: App.currentTeam }); }
};

// ========================================
// 試合一覧
// ========================================

const GameListView = {
    render(team, year) {
        const games = (team.games || []).filter(g => getYear(g.date) === year).sort((a, b) => new Date(b.date) - new Date(a.date));
        const wins = games.filter(g => g.teamTotalRuns > g.opponentTotalRuns).length;
        const losses = games.filter(g => g.teamTotalRuns < g.opponentTotalRuns).length;
        const draws = games.length - wins - losses;
        const totalRuns = games.reduce((sum, g) => sum + (g.teamTotalRuns || 0), 0);
        const totalRunsAllowed = games.reduce((sum, g) => sum + (g.opponentTotalRuns || 0), 0);
        return `
            <div class="header"><div class="header-with-back">
                <button class="back-button" onclick="App.navigate('yearList', {currentTeam: App.currentTeam})">←</button>
                <h1>${year}年</h1>
            </div></div>
            <div class="card">
                <div class="stats-grid">
                    <div class="stat-card"><div class="stat-value win">${wins}</div><div class="stat-label">勝</div></div>
                    <div class="stat-card"><div class="stat-value loss">${losses}</div><div class="stat-label">敗</div></div>
                    <div class="stat-card"><div class="stat-value">${draws}</div><div class="stat-label">分</div></div>
                </div>
                <div style="display:flex;justify-content:space-around;text-align:center;">
                    <div><div style="font-size:1.3rem;font-weight:700;color:var(--primary-color);">${totalRuns}</div><div style="font-size:0.75rem;color:var(--text-secondary);">総得点</div></div>
                    <div><div style="font-size:1.3rem;font-weight:700;">${games.length > 0 ? (totalRuns / games.length).toFixed(1) : '0.0'}</div><div style="font-size:0.75rem;color:var(--text-secondary);">平均得点</div></div>
                    <div><div style="font-size:1.3rem;font-weight:700;color:var(--secondary-color);">${totalRunsAllowed}</div><div style="font-size:0.75rem;color:var(--text-secondary);">総失点</div></div>
                </div>
            </div>
            <div class="card"><button class="btn btn-primary" onclick="GameListView.createGame()">＋ 試合を追加</button></div>
            ${games.length === 0 ? `<div class="empty-state"><div class="empty-state-icon">⚾</div><div class="empty-state-text">${year}年の試合はありません</div></div>` : games.map(game => this.renderGameItem(game, team.name)).join('')}
        `;
    },
    renderGameItem(game, teamName) {
        const isWin = game.teamTotalRuns > game.opponentTotalRuns;
        const isLoss = game.teamTotalRuns < game.opponentTotalRuns;
        return `
            <div class="game-item" onclick="GameListView.openGame('${game.id}')">
                <div class="game-item-header">
                    <span class="game-date">${formatDateShort(game.date)}</span>
                    <span class="game-type ${game.gameType === '公式戦' ? 'official' : 'practice'}">${game.gameType}</span>
                </div>
                <div class="game-score">
                    <div class="game-score-team"><div class="game-score-name">${teamName}</div><div class="game-score-runs ${isWin ? 'winner' : ''}">${game.teamTotalRuns || 0}</div></div>
                    <div class="game-score-vs">-</div>
                    <div class="game-score-team"><div class="game-score-name">${game.opponent}</div><div class="game-score-runs ${isLoss ? 'winner' : ''}">${game.opponentTotalRuns || 0}</div></div>
                </div>
                <div class="game-location">📍 ${game.location}</div>
            </div>
        `;
    },
    attachEvents() {},
    createGame() { App.navigate('gameSetup', { currentTeam: App.currentTeam }); },
    openGame(gameId) { App.navigate('gameScore', { currentTeam: App.currentTeam, currentGame: App.currentTeam.games.find(g => g.id === gameId) }); }
};

// ========================================
// 試合設定
// ========================================

const GameSetupView = {
    battingOrder: [],
    selectedPitcher: null,
    isFirstBatting: true,
    step: 1,
    gameData: {},
    
    render(team) {
        const today = new Date().toISOString().slice(0, 10);
        const locations = Storage.getLocations(team.id);
        const opponents = Storage.getOpponents(team.id);
        return `
            <div class="header"><div class="header-with-back">
                <button class="back-button" onclick="GameSetupView.goBack()">←</button>
                <h1>試合を登録</h1>
            </div></div>
            <div style="display:flex;padding:10px 12px;gap:4px;">
                ${[1,2,3].map(s => `<div style="flex:1;height:4px;border-radius:2px;background:${this.step >= s ? 'var(--primary-color)' : '#e5e7eb'};"></div>`).join('')}
            </div>
            <div id="stepContent">
                ${this.step === 1 ? this.renderStep1(today, locations, opponents) : ''}
                ${this.step === 2 ? this.renderStep2(team) : ''}
                ${this.step === 3 ? this.renderStep3(team) : ''}
            </div>
        `;
    },
    
    renderStep1(today, locations, opponents) {
        return `
            <div class="card">
                <div class="card-title">試合情報</div>
                <div class="form-group"><label class="form-label">日付</label><input type="date" id="gameDate" class="form-input" value="${today}"></div>
                <div class="form-group"><label class="form-label">種別</label><select id="gameType" class="form-select"><option value="練習試合">練習試合</option><option value="公式戦">公式戦</option></select></div>
                <div class="form-group">
                    <label class="form-label">先攻・後攻</label>
                    <div style="display:flex;gap:10px;">
                        <button type="button" class="btn ${this.isFirstBatting ? 'btn-primary' : 'btn-outline'}" onclick="GameSetupView.setFirstBatting(true)" style="flex:1;">先攻</button>
                        <button type="button" class="btn ${!this.isFirstBatting ? 'btn-primary' : 'btn-outline'}" onclick="GameSetupView.setFirstBatting(false)" style="flex:1;">後攻</button>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">場所</label><input type="text" id="location" class="form-input" placeholder="場所を入力">
                    ${locations.length > 0 ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">${locations.slice(0, 5).map(loc => `<button type="button" class="btn btn-small btn-outline" onclick="document.getElementById('location').value='${loc}'" style="width:auto;">${loc}</button>`).join('')}</div>` : ''}
                </div>
                <div class="form-group">
                    <label class="form-label">対戦相手</label><input type="text" id="opponent" class="form-input" placeholder="対戦相手を入力">
                    ${opponents.length > 0 ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">${opponents.slice(0, 5).map(opp => `<button type="button" class="btn btn-small btn-outline" onclick="document.getElementById('opponent').value='${opp}'" style="width:auto;">${opp}</button>`).join('')}</div>` : ''}
                </div>
            </div>
            <div class="p-12"><button class="btn btn-primary" onclick="GameSetupView.nextStep()">次へ：打順設定 →</button></div>
        `;
    },
    
    renderStep2(team) {
        const players = team.players || [];
        const availablePlayers = players.filter(p => !this.battingOrder.find(b => b.id === p.id));
        const isFull = this.battingOrder.length >= 9;
        return `
            <div class="card">
                <div class="card-title">打順を設定（最大9人）</div>
                <div style="text-align:center;margin-bottom:10px;color:${isFull ? 'var(--success-color)' : 'var(--text-secondary)'};">${this.battingOrder.length}/9人</div>
                <div id="battingOrderList">
                    ${this.battingOrder.length === 0 ? `<div style="text-align:center;color:var(--text-secondary);padding:20px;">選手を追加してください</div>` : this.battingOrder.map((player, index) => `
                        <div class="batting-order-item">
                            <div class="batting-order-number">${index + 1}</div>
                            <div class="batting-order-name">${player.name}</div>
                            <button class="batting-order-remove" onclick="GameSetupView.removeFromOrder(${index})">×</button>
                        </div>
                    `).join('')}
                </div>
            </div>
            ${!isFull && availablePlayers.length > 0 ? `
                <div class="card">
                    <div class="card-title">選手を追加</div>
                    <div class="player-list">${availablePlayers.map(player => `
                        <div class="player-item" onclick="GameSetupView.addToOrder('${player.id}')">
                            <span class="player-number">#${player.number || '-'}</span>
                            <span class="player-name">${player.name}</span>
                            ${player.isPitcher ? '<span class="player-position">投手</span>' : ''}
                        </div>
                    `).join('')}</div>
                </div>
            ` : ''}
            <div class="p-12" style="display:flex;gap:10px;">
                <button class="btn btn-secondary" onclick="GameSetupView.prevStep()" style="flex:1;">← 戻る</button>
                <button class="btn btn-primary" onclick="GameSetupView.nextStep()" style="flex:2;" ${this.battingOrder.length === 0 ? 'disabled' : ''}>次へ：投手設定 →</button>
            </div>
        `;
    },
    
    renderStep3(team) {
        const players = team.players || [];
        const pitchers = players.filter(p => p.isPitcher);
        const others = players.filter(p => !p.isPitcher);
        return `
            <div class="card">
                <div class="card-title">先発投手を選択</div>
                ${this.selectedPitcher ? `
                    <div style="display:flex;align-items:center;padding:12px;background:var(--bg-color);border-radius:8px;margin-bottom:12px;">
                        <span style="font-size:1.5rem;margin-right:10px;">⚾</span>
                        <span style="flex:1;font-weight:600;">${this.selectedPitcher.name}</span>
                        <button class="btn btn-small btn-outline" onclick="GameSetupView.clearPitcher()" style="width:auto;">変更</button>
                    </div>
                ` : `
                    ${pitchers.length > 0 ? `<div class="card-title" style="font-size:0.8rem;">投手</div>${pitchers.map(player => `<div class="player-item" onclick="GameSetupView.selectPitcher('${player.id}')"><span class="player-number">#${player.number || '-'}</span><span class="player-name">${player.name}</span></div>`).join('')}` : ''}
                    ${others.length > 0 ? `<div class="card-title" style="font-size:0.8rem;margin-top:12px;">その他</div>${others.map(player => `<div class="player-item" onclick="GameSetupView.selectPitcher('${player.id}')"><span class="player-number">#${player.number || '-'}</span><span class="player-name">${player.name}</span></div>`).join('')}` : ''}
                `}
            </div>
            <div class="card">
                <div class="card-title">打順確認</div>
                <table style="width:100%;font-size:0.85rem;border-collapse:collapse;">
                    <thead><tr style="border-bottom:1px solid var(--border-color);"><th style="text-align:left;padding:8px 4px;">#</th><th style="text-align:left;padding:8px 4px;">名前</th><th style="text-align:center;padding:8px 4px;">打率</th><th style="text-align:center;padding:8px 4px;">出塁</th><th style="text-align:center;padding:8px 4px;">HR</th><th style="text-align:center;padding:8px 4px;">OPS</th></tr></thead>
                    <tbody>${this.battingOrder.map((player, index) => {
                        const stats = calculatePlayerStats(team, player.id);
                        return `<tr style="border-bottom:1px solid var(--border-color);"><td style="padding:8px 4px;font-weight:600;color:var(--primary-color);">${index + 1}</td><td style="padding:8px 4px;">${player.name}</td><td style="text-align:center;padding:8px 4px;font-family:monospace;">${stats.avg}</td><td style="text-align:center;padding:8px 4px;font-family:monospace;">${stats.obp}</td><td style="text-align:center;padding:8px 4px;">${stats.homeRuns}</td><td style="text-align:center;padding:8px 4px;font-family:monospace;">${stats.ops}</td></tr>`;
                    }).join('')}</tbody>
                </table>
            </div>
            <div class="card">
                <div class="stats-row"><span class="stats-row-label">先攻・後攻</span><span class="stats-row-value">${this.isFirstBatting ? '先攻' : '後攻'}</span></div>
                <div class="stats-row"><span class="stats-row-label">先発投手</span><span class="stats-row-value">${this.selectedPitcher ? this.selectedPitcher.name : '未設定'}</span></div>
            </div>
            <div class="p-12" style="display:flex;gap:10px;">
                <button class="btn btn-secondary" onclick="GameSetupView.prevStep()" style="flex:1;">← 戻る</button>
                <button class="btn btn-success" onclick="GameSetupView.createGame()" style="flex:2;" ${!this.selectedPitcher ? 'disabled' : ''}>試合を開始</button>
            </div>
        `;
    },
    
    attachEvents() {},
    setFirstBatting(isFirst) { this.isFirstBatting = isFirst; App.render(); },
    goBack() {
        if (this.step > 1) { this.prevStep(); }
        else { this.battingOrder = []; this.selectedPitcher = null; this.isFirstBatting = true; this.step = 1; App.navigate('yearList', { currentTeam: App.currentTeam }); }
    },
    nextStep() {
        if (this.step === 1) {
            const date = document.getElementById('gameDate').value;
            const location = document.getElementById('location').value.trim();
            const opponent = document.getElementById('opponent').value.trim();
            if (!date || !location || !opponent) { alert('すべての項目を入力してください'); return; }
            this.gameData = { date, gameType: document.getElementById('gameType').value, location, opponent };
        }
        this.step++;
        App.render();
    },
    prevStep() { this.step--; App.render(); },
    addToOrder(playerId) {
        if (this.battingOrder.length >= 9) { alert('打順は9人までです'); return; }
        const player = App.currentTeam.players.find(p => p.id === playerId);
        if (player && !this.battingOrder.find(b => b.id === playerId)) { this.battingOrder.push(player); App.render(); }
    },
    removeFromOrder(index) { this.battingOrder.splice(index, 1); App.render(); },
    selectPitcher(playerId) { this.selectedPitcher = App.currentTeam.players.find(p => p.id === playerId); App.render(); },
    clearPitcher() { this.selectedPitcher = null; App.render(); },
    createGame() {
        const team = App.currentTeam;
        const game = {
            id: generateId(),
            date: this.gameData.date,
            gameType: this.gameData.gameType,
            location: this.gameData.location,
            opponent: this.gameData.opponent,
            isFirstBatting: this.isFirstBatting,
            battingOrder: this.battingOrder.map(p => ({ id: p.id, name: p.name, number: p.number })),
            pitcher: { id: this.selectedPitcher.id, name: this.selectedPitcher.name },
            innings: [{ number: 1, teamRuns: 0, teamHits: 0, opponentRuns: 0, opponentHits: 0, atBats: [] }],
            pitchingRecord: { playerId: this.selectedPitcher.id, playerName: this.selectedPitcher.name, inningsPitched: 0, strikeouts: 0, runsAllowed: 0, earnedRuns: 0, hitsAllowed: 0 },
            teamTotalRuns: 0, teamTotalHits: 0, opponentTotalRuns: 0, opponentTotalHits: 0,
            currentInning: 1, isTeamBatting: this.isFirstBatting, currentBatterIndex: 0, currentOuts: 0, isFinished: false,
            createdAt: new Date().toISOString()
        };
        Storage.addLocation(team.id, game.location);
        Storage.addOpponent(team.id, game.opponent);
        if (!team.games) team.games = [];
        team.games.push(game);
        Storage.saveTeam(team);
        this.battingOrder = []; this.selectedPitcher = null; this.isFirstBatting = true; this.step = 1;
        App.navigate('gameScore', { currentTeam: team, currentGame: game });
    }
};

// ========================================
// 試合スコア
// ========================================

const GameScoreView = {
    editingAtBatId: null,
    
    render(team, game) {
        if (game.isFinished) return this.renderFinishedGame(team, game);
        return `
            <div class="game-screen">
                <div class="game-header"><div class="header-with-back">
                    <button class="back-button" onclick="GameScoreView.exitGame()">←</button>
                    <h1 style="font-size:1rem;">${team.name} vs ${game.opponent}</h1>
                </div></div>
                <div class="scoreboard-section">${this.renderScoreboard(team, game)}</div>
                <div class="input-section">${game.isTeamBatting ? this.renderBattingInput(team, game) : this.renderDefenseInput(team, game)}</div>
            </div>
        `;
    },
    
    renderFinishedGame(team, game) {
        return `
            <div class="header"><div class="header-with-back">
                <button class="back-button" onclick="GameScoreView.exitGame()">←</button>
                <h1 style="font-size:1rem;">${team.name} vs ${game.opponent}</h1>
            </div></div>
            ${this.renderScoreboard(team, game)}
            <div class="card">
                <div style="text-align:center;padding:20px;">
                    <div style="font-size:1.5rem;font-weight:700;margin-bottom:10px;">試合終了</div>
                    <div style="font-size:2rem;font-weight:700;">
                        <span style="color:${game.teamTotalRuns > game.opponentTotalRuns ? 'var(--success-color)' : ''}">${game.teamTotalRuns}</span>
                        <span style="margin:0 15px;">-</span>
                        <span style="color:${game.opponentTotalRuns > game.teamTotalRuns ? 'var(--success-color)' : ''}">${game.opponentTotalRuns}</span>
                    </div>
                </div>
            </div>
        `;
    },
    
    renderScoreboard(team, game) {
        const maxInnings = 7;
        const innings = game.innings || [];
        const topTeam = game.isFirstBatting ? team.name : game.opponent;
        const bottomTeam = game.isFirstBatting ? game.opponent : team.name;
        const getTopScore = (inning) => game.isFirstBatting ? inning.teamRuns : inning.opponentRuns;
        const getBottomScore = (inning) => game.isFirstBatting ? inning.opponentRuns : inning.teamRuns;
        const topTotalRuns = game.isFirstBatting ? game.teamTotalRuns : game.opponentTotalRuns;
        const bottomTotalRuns = game.isFirstBatting ? game.opponentTotalRuns : game.teamTotalRuns;
        const topTotalHits = game.isFirstBatting ? game.teamTotalHits : game.opponentTotalHits;
        const bottomTotalHits = game.isFirstBatting ? game.opponentTotalHits : game.teamTotalHits;
        return `
            <div class="scoreboard">
                <table class="scoreboard-table">
                    <thead><tr><th class="team-name"></th>${[...Array(maxInnings)].map((_, i) => `<th>${i + 1}</th>`).join('')}<th class="total">計</th><th class="hits">H</th></tr></thead>
                    <tbody>
                        <tr class="team-row"><td class="team-name">${topTeam}</td>${[...Array(maxInnings)].map((_, i) => { const inning = innings[i]; const score = inning ? getTopScore(inning) : null; return `<td class="score-cell ${score !== null ? 'has-score' : ''}">${score !== null ? score : '-'}</td>`; }).join('')}<td class="total">${topTotalRuns || 0}</td><td class="hits">${topTotalHits || 0}</td></tr>
                        <tr class="team-row"><td class="team-name">${bottomTeam}</td>${[...Array(maxInnings)].map((_, i) => { const inning = innings[i]; const score = inning ? getBottomScore(inning) : null; return `<td class="score-cell ${score !== null ? 'has-score' : ''}">${score !== null ? score : '-'}</td>`; }).join('')}<td class="total">${bottomTotalRuns || 0}</td><td class="hits">${bottomTotalHits || 0}</td></tr>
                    </tbody>
                </table>
            </div>
        `;
    },
    
    renderBattingInput(team, game) {
        const currentInning = game.innings[game.currentInning - 1] || { atBats: [] };
        const currentBatter = game.battingOrder[game.currentBatterIndex];
        return `
            <div class="inning-status">
                <div class="inning-info">${game.currentInning}回 <span style="color:var(--secondary-color);">攻撃中</span></div>
                <div class="out-count">${[0,1,2].map(i => `<div class="out-dot ${i < game.currentOuts ? 'active' : ''}"></div>`).join('')}<span style="font-size:0.8rem;font-weight:600;">OUT</span></div>
            </div>
            <div class="at-bat-list">
                ${(currentInning.atBats || []).map(ab => `
                    <div class="at-bat-item" onclick="GameScoreView.showEditAtBatModal('${ab.id}')">
                        <span class="at-bat-player">${ab.playerName}</span>
                        <span class="at-bat-result ${AtBatResults[ab.result].type}">${AtBatResults[ab.result].icon}</span>
                        <div class="at-bat-stats">
                            ${ab.stolenBases > 0 ? `<span class="stat-badge steal">盗${ab.stolenBases}</span>` : ''}
                            ${ab.rbi > 0 ? `<span class="stat-badge rbi">打点${ab.rbi}</span>` : ''}
                        </div>
                        <span style="color:var(--text-secondary);font-size:0.75rem;">編集</span>
                    </div>
                `).join('')}
            </div>
            <div class="current-batter">
                <div class="current-batter-label">現在の打者</div>
                <div class="current-batter-name"><span class="current-batter-order">${game.currentBatterIndex + 1}番</span>${currentBatter ? currentBatter.name : '---'}</div>
            </div>
            <div class="batting-buttons">
                <div class="batting-row">
                    <button class="batting-btn hit" onclick="GameScoreView.recordAtBat('single')">ヒット</button>
                    <button class="batting-btn hit" onclick="GameScoreView.recordAtBat('double')">2塁打</button>
                    <button class="batting-btn hit" onclick="GameScoreView.recordAtBat('triple')">3塁打</button>
                    <button class="batting-btn hit" onclick="GameScoreView.recordAtBat('homeRun')">HR</button>
                </div>
                <div class="batting-row">
                    <button class="batting-btn walk" onclick="GameScoreView.recordAtBat('walk')">四死球</button>
                    <button class="batting-btn walk" onclick="GameScoreView.recordAtBat('error')">エラー</button>
                </div>
                <div class="batting-row">
                    <button class="batting-btn sacrifice" onclick="GameScoreView.recordAtBat('sacrifice')">犠牲</button>
                    <button class="batting-btn out" onclick="GameScoreView.recordAtBat('out')">アウト</button>
                    <button class="batting-btn out" onclick="GameScoreView.recordAtBat('doublePlay')">併殺</button>
                    <button class="batting-btn out" onclick="GameScoreView.recordAtBat('triplePlay')">三殺</button>
                </div>
            </div>
            <div class="change-button">
                <button class="change-btn" onclick="GameScoreView.performChange()">チェンジ</button>
                <button class="btn btn-danger" style="margin-top:10px;" onclick="GameScoreView.endGame()">試合終了</button>
            </div>
            ${this.editingAtBatId ? this.renderEditAtBatModal(game) : ''}
        `;
    },
    
    renderDefenseInput(team, game) {
        const currentInning = game.innings[game.currentInning - 1] || { opponentRuns: 0, opponentHits: 0 };
        const record = game.pitchingRecord;
        return `
            <div class="inning-status">
                <div class="inning-info">${game.currentInning}回 <span style="color:var(--primary-color);">守備中</span></div>
            </div>
            <div class="card" style="margin:12px;">
                <div class="card-title">相手チームの攻撃</div>
                <div style="display:flex;gap:20px;justify-content:center;">
                    <div style="text-align:center;">
                        <div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:8px;">得点</div>
                        <div style="display:flex;align-items:center;justify-content:center;gap:10px;">
                            <button onclick="GameScoreView.adjustOpponentScore(-1)" style="width:40px;height:40px;border:none;border-radius:50%;background:rgba(239,68,68,0.15);color:var(--danger-color);font-size:1.2rem;font-weight:bold;cursor:pointer;">−</button>
                            <span style="font-size:2rem;font-weight:700;min-width:50px;text-align:center;">${currentInning.opponentRuns || 0}</span>
                            <button onclick="GameScoreView.adjustOpponentScore(1)" style="width:40px;height:40px;border:none;border-radius:50%;background:rgba(34,197,94,0.15);color:var(--success-color);font-size:1.2rem;font-weight:bold;cursor:pointer;">＋</button>
                        </div>
                    </div>
                    <div style="text-align:center;">
                        <div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:8px;">被安打</div>
                        <div style="display:flex;align-items:center;justify-content:center;gap:10px;">
                            <button onclick="GameScoreView.adjustOpponentHits(-1)" style="width:40px;height:40px;border:none;border-radius:50%;background:rgba(239,68,68,0.15);color:var(--danger-color);font-size:1.2rem;font-weight:bold;cursor:pointer;">−</button>
                            <span style="font-size:2rem;font-weight:700;min-width:50px;text-align:center;">${currentInning.opponentHits || 0}</span>
                            <button onclick="GameScoreView.adjustOpponentHits(1)" style="width:40px;height:40px;border:none;border-radius:50%;background:rgba(34,197,94,0.15);color:var(--success-color);font-size:1.2rem;font-weight:bold;cursor:pointer;">＋</button>
                        </div>
                    </div>
                </div>
            </div>
            <div class="card" style="margin:12px;">
                <div class="card-title">投手成績 - ${record.playerName}</div>
                <div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:15px;">
                    <div style="text-align:center;"><div style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:6px;">投球回</div><div style="display:flex;align-items:center;justify-content:center;gap:8px;"><button onclick="GameScoreView.adjustPitching('inningsPitched', -0.1)" style="width:32px;height:32px;border:none;border-radius:50%;background:rgba(239,68,68,0.15);color:var(--danger-color);font-weight:bold;cursor:pointer;">−</button><span style="font-size:1.3rem;font-weight:700;min-width:40px;">${record.inningsPitched.toFixed(1)}</span><button onclick="GameScoreView.adjustPitching('inningsPitched', 0.1)" style="width:32px;height:32px;border:none;border-radius:50%;background:rgba(34,197,94,0.15);color:var(--success-color);font-weight:bold;cursor:pointer;">＋</button></div></div>
                    <div style="text-align:center;"><div style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:6px;">三振</div><div style="display:flex;align-items:center;justify-content:center;gap:8px;"><button onclick="GameScoreView.adjustPitching('strikeouts', -1)" style="width:32px;height:32px;border:none;border-radius:50%;background:rgba(239,68,68,0.15);color:var(--danger-color);font-weight:bold;cursor:pointer;">−</button><span style="font-size:1.3rem;font-weight:700;min-width:40px;">${record.strikeouts}</span><button onclick="GameScoreView.adjustPitching('strikeouts', 1)" style="width:32px;height:32px;border:none;border-radius:50%;background:rgba(34,197,94,0.15);color:var(--success-color);font-weight:bold;cursor:pointer;">＋</button></div></div>
                    <div style="text-align:center;"><div style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:6px;">失点</div><div style="display:flex;align-items:center;justify-content:center;gap:8px;"><button onclick="GameScoreView.adjustPitching('runsAllowed', -1)" style="width:32px;height:32px;border:none;border-radius:50%;background:rgba(239,68,68,0.15);color:var(--danger-color);font-weight:bold;cursor:pointer;">−</button><span style="font-size:1.3rem;font-weight:700;min-width:40px;">${record.runsAllowed}</span><button onclick="GameScoreView.adjustPitching('runsAllowed', 1)" style="width:32px;height:32px;border:none;border-radius:50%;background:rgba(34,197,94,0.15);color:var(--success-color);font-weight:bold;cursor:pointer;">＋</button></div></div>
                    <div style="text-align:center;"><div style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:6px;">自責点</div><div style="display:flex;align-items:center;justify-content:center;gap:8px;"><button onclick="GameScoreView.adjustPitching('earnedRuns', -1)" style="width:32px;height:32px;border:none;border-radius:50%;background:rgba(239,68,68,0.15);color:var(--danger-color);font-weight:bold;cursor:pointer;">−</button><span style="font-size:1.3rem;font-weight:700;min-width:40px;">${record.earnedRuns}</span><button onclick="GameScoreView.adjustPitching('earnedRuns', 1)" style="width:32px;height:32px;border:none;border-radius:50%;background:rgba(34,197,94,0.15);color:var(--success-color);font-weight:bold;cursor:pointer;">＋</button></div></div>
                </div>
            </div>
            <div class="change-button">
                <button class="change-btn" onclick="GameScoreView.performChange()">チェンジ</button>
                <button class="btn btn-danger" style="margin-top:10px;" onclick="GameScoreView.endGame()">試合終了</button>
            </div>
        `;
    },
    
    renderEditAtBatModal(game) {
        const currentInning = game.innings[game.currentInning - 1];
        const atBat = currentInning.atBats.find(ab => ab.id === this.editingAtBatId);
        if (!atBat) return '';
        return `
            <div class="modal-overlay" onclick="GameScoreView.closeEditModal(event)">
                <div class="modal" onclick="event.stopPropagation()">
                    <div class="modal-header"><span class="modal-title">${atBat.playerName}の打席を編集</span><button class="modal-close" onclick="GameScoreView.closeEditModal()">×</button></div>
                    <div class="modal-body">
                        <div class="form-group"><label class="form-label">打席結果</label><select id="editResult" class="form-select">${Object.entries(AtBatResults).map(([key, val]) => `<option value="${key}" ${atBat.result === key ? 'selected' : ''}>${val.name}</option>`).join('')}</select></div>
                        <div class="form-group"><label class="form-label">盗塁</label><div style="display:flex;align-items:center;gap:15px;"><button onclick="GameScoreView.adjustEditValue('stolenBases', -1)" style="width:40px;height:40px;border:none;border-radius:50%;background:rgba(239,68,68,0.15);color:var(--danger-color);font-size:1.2rem;cursor:pointer;">−</button><span id="editStolenBases" style="font-size:1.5rem;font-weight:700;min-width:40px;text-align:center;">${atBat.stolenBases || 0}</span><button onclick="GameScoreView.adjustEditValue('stolenBases', 1)" style="width:40px;height:40px;border:none;border-radius:50%;background:rgba(34,197,94,0.15);color:var(--success-color);font-size:1.2rem;cursor:pointer;">＋</button></div></div>
                        <div class="form-group"><label class="form-label">打点</label><div style="display:flex;align-items:center;gap:15px;"><button onclick="GameScoreView.adjustEditValue('rbi', -1)" style="width:40px;height:40px;border:none;border-radius:50%;background:rgba(239,68,68,0.15);color:var(--danger-color);font-size:1.2rem;cursor:pointer;">−</button><span id="editRbi" style="font-size:1.5rem;font-weight:700;min-width:40px;text-align:center;">${atBat.rbi || 0}</span><button onclick="GameScoreView.adjustEditValue('rbi', 1)" style="width:40px;height:40px;border:none;border-radius:50%;background:rgba(34,197,94,0.15);color:var(--success-color);font-size:1.2rem;cursor:pointer;">＋</button></div></div>
                    </div>
                    <div class="modal-footer"><button class="btn btn-secondary" onclick="GameScoreView.closeEditModal()" style="flex:1;">キャンセル</button><button class="btn btn-primary" onclick="GameScoreView.saveAtBatEdit()" style="flex:1;">保存</button></div>
                </div>
            </div>
        `;
    },
    
    attachEvents() {},
    showEditAtBatModal(atBatId) { this.editingAtBatId = atBatId; App.render(); },
    closeEditModal(event) { if (event && event.target !== event.currentTarget) return; this.editingAtBatId = null; App.render(); },
    adjustEditValue(field, amount) {
        const element = document.getElementById(field === 'stolenBases' ? 'editStolenBases' : 'editRbi');
        let value = parseInt(element.textContent) || 0;
        element.textContent = Math.max(0, value + amount);
    },
    saveAtBatEdit() {
        const game = App.currentGame;
        const currentInning = game.innings[game.currentInning - 1];
        const atBat = currentInning.atBats.find(ab => ab.id === this.editingAtBatId);
        if (atBat) {
            const oldResult = atBat.result;
            const newResult = document.getElementById('editResult').value;
            if (AtBatResults[oldResult].type === 'hit' && AtBatResults[newResult].type !== 'hit') { currentInning.teamHits = Math.max(0, currentInning.teamHits - 1); game.teamTotalHits = Math.max(0, game.teamTotalHits - 1); }
            else if (AtBatResults[oldResult].type !== 'hit' && AtBatResults[newResult].type === 'hit') { currentInning.teamHits++; game.teamTotalHits++; }
            atBat.result = newResult;
            atBat.stolenBases = parseInt(document.getElementById('editStolenBases').textContent) || 0;
            atBat.rbi = parseInt(document.getElementById('editRbi').textContent) || 0;
            currentInning.teamRuns = currentInning.atBats.reduce((sum, ab) => sum + (ab.rbi || 0), 0);
            game.teamTotalRuns = game.innings.reduce((sum, inn) => sum + (inn.teamRuns || 0), 0);
            this.saveGame(App.currentTeam, game);
        }
        this.editingAtBatId = null;
        App.render();
    },
    recordAtBat(resultKey) {
        const game = App.currentGame;
        const team = App.currentTeam;
        const result = AtBatResults[resultKey];
        const currentBatter = game.battingOrder[game.currentBatterIndex];
        if (!currentBatter) return;
        let currentInning = game.innings[game.currentInning - 1];
        if (!currentInning) { currentInning = { number: game.currentInning, teamRuns: 0, teamHits: 0, opponentRuns: 0, opponentHits: 0, atBats: [] }; game.innings[game.currentInning - 1] = currentInning; }
        if (!currentInning.atBats) currentInning.atBats = [];
        currentInning.atBats.push({ id: generateId(), playerId: currentBatter.id, playerName: currentBatter.name, result: resultKey, rbi: 0, stolenBases: 0 });
        if (result.type === 'hit') { currentInning.teamHits++; game.teamTotalHits++; }
        game.currentOuts += result.outs;
        game.currentBatterIndex = (game.currentBatterIndex + 1) % game.battingOrder.length;
        if (game.currentOuts >= 3) { game.teamTotalRuns = game.innings.reduce((sum, inn) => sum + (inn.teamRuns || 0), 0); }
        this.saveGame(team, game);
        App.render();
    },
    adjustOpponentScore(amount) {
        const game = App.currentGame;
        const currentInning = game.innings[game.currentInning - 1];
        if (currentInning) { currentInning.opponentRuns = Math.max(0, (currentInning.opponentRuns || 0) + amount); game.opponentTotalRuns = game.innings.reduce((sum, inn) => sum + (inn.opponentRuns || 0), 0); this.saveGame(App.currentTeam, game); App.render(); }
    },
    adjustOpponentHits(amount) {
        const game = App.currentGame;
        const currentInning = game.innings[game.currentInning - 1];
        if (currentInning) { currentInning.opponentHits = Math.max(0, (currentInning.opponentHits || 0) + amount); game.opponentTotalHits = game.innings.reduce((sum, inn) => sum + (inn.opponentHits || 0), 0); this.saveGame(App.currentTeam, game); App.render(); }
    },
    adjustPitching(field, amount) {
        const game = App.currentGame;
        const record = game.pitchingRecord;
        if (field === 'inningsPitched') { record[field] = Math.max(0, Math.round((record[field] + amount) * 10) / 10); }
        else { record[field] = Math.max(0, (record[field] || 0) + amount); }
        this.saveGame(App.currentTeam, game);
        App.render();
    },
    performChange() {
        const game = App.currentGame;
        game.teamTotalRuns = game.innings.reduce((sum, inn) => sum + (inn.teamRuns || 0), 0);
        game.teamTotalHits = game.innings.reduce((sum, inn) => sum + (inn.teamHits || 0), 0);
        game.opponentTotalRuns = game.innings.reduce((sum, inn) => sum + (inn.opponentRuns || 0), 0);
        game.opponentTotalHits = game.innings.reduce((sum, inn) => sum + (inn.opponentHits || 0), 0);
        game.isTeamBatting = !game.isTeamBatting;
        if (game.isTeamBatting) { game.currentInning++; game.innings.push({ number: game.currentInning, teamRuns: 0, teamHits: 0, opponentRuns: 0, opponentHits: 0, atBats: [] }); }
        game.currentOuts = 0;
        this.saveGame(App.currentTeam, game);
        App.render();
    },
    endGame() {
        if (confirm('試合を終了しますか？')) {
            const game = App.currentGame;
            game.teamTotalRuns = game.innings.reduce((sum, inn) => sum + (inn.teamRuns || 0), 0);
            game.teamTotalHits = game.innings.reduce((sum, inn) => sum + (inn.teamHits || 0), 0);
            game.opponentTotalRuns = game.innings.reduce((sum, inn) => sum + (inn.opponentRuns || 0), 0);
            game.opponentTotalHits = game.innings.reduce((sum, inn) => sum + (inn.opponentHits || 0), 0);
            game.isFinished = true;
            this.saveGame(App.currentTeam, game);
            App.render();
        }
    },
    saveGame(team, game) {
        const gameIndex = team.games.findIndex(g => g.id === game.id);
        if (gameIndex >= 0) { team.games[gameIndex] = game; }
        Storage.saveTeam(team);
        App.currentGame = game;
        App.currentTeam = team;
    },
    exitGame() { App.navigate('gameList', { currentTeam: App.currentTeam, currentYear: getYear(App.currentGame.date) }); }
};

// ========================================
// 選手統計
// ========================================

const PlayerStatsView = {
    render(team, player) {
        const stats = this.calculateStats(team, player);
        return `
            <div class="header"><div class="header-with-back">
                <button class="back-button" onclick="App.navigate('playerManagement', {currentTeam: App.currentTeam})">←</button>
                <h1>${player.name}</h1>
            </div></div>
            <div class="card">
                <div style="display:flex;align-items:center;gap:15px;">
                    <div style="width:60px;height:60px;border-radius:50%;background:${player.isPitcher ? 'var(--secondary-color)' : 'var(--primary-color)'};color:white;display:flex;align-items:center;justify-content:center;font-size:1.3rem;font-weight:700;">#${player.number || '-'}</div>
                    <div><div style="font-size:1.3rem;font-weight:700;">${player.name}</div><div style="display:flex;gap:8px;">${player.isPitcher ? '<span class="badge badge-warning">投手</span>' : ''}<span style="color:var(--text-secondary);">${team.name}</span></div></div>
                </div>
            </div>
            <div class="stats-section">
                <div class="stats-section-title">打撃成績</div>
                <div class="stats-row"><span class="stats-row-label">試合数</span><span class="stats-row-value">${stats.games}</span></div>
                <div class="stats-row"><span class="stats-row-label">打席数</span><span class="stats-row-value">${stats.atBats}</span></div>
                <div class="stats-row"><span class="stats-row-label">安打</span><span class="stats-row-value">${stats.hits}</span></div>
                <div class="stats-row"><span class="stats-row-label">打率</span><span class="stats-row-value">${stats.average}</span></div>
                <div class="stats-row"><span class="stats-row-label">本塁打</span><span class="stats-row-value">${stats.homeRuns}</span></div>
                <div class="stats-row"><span class="stats-row-label">打点</span><span class="stats-row-value">${stats.rbis}</span></div>
                <div class="stats-row"><span class="stats-row-label">盗塁</span><span class="stats-row-value">${stats.stolenBases}</span></div>
            </div>
            ${player.isPitcher ? `
                <div class="stats-section">
                    <div class="stats-section-title">投手成績</div>
                    <div class="stats-row"><span class="stats-row-label">登板数</span><span class="stats-row-value">${stats.pitching.appearances}</span></div>
                    <div class="stats-row"><span class="stats-row-label">投球回</span><span class="stats-row-value">${stats.pitching.inningsPitched}</span></div>
                    <div class="stats-row"><span class="stats-row-label">奪三振</span><span class="stats-row-value">${stats.pitching.strikeouts}</span></div>
                    <div class="stats-row"><span class="stats-row-label">失点</span><span class="stats-row-value">${stats.pitching.runsAllowed}</span></div>
                    <div class="stats-row"><span class="stats-row-label">自責点</span><span class="stats-row-value">${stats.pitching.earnedRuns}</span></div>
                    <div class="stats-row"><span class="stats-row-label">防御率</span><span class="stats-row-value">${stats.pitching.era}</span></div>
                </div>
            ` : ''}
        `;
    },
    calculateStats(team, player) {
        const stats = { games: 0, atBats: 0, hits: 0, doubles: 0, triples: 0, homeRuns: 0, rbis: 0, stolenBases: 0, walks: 0, average: '.000', pitching: { appearances: 0, inningsPitched: 0, strikeouts: 0, runsAllowed: 0, earnedRuns: 0, hitsAllowed: 0, era: '0.00' } };
        (team.games || []).forEach(game => {
            let hasAtBat = false;
            (game.innings || []).forEach(inning => {
                (inning.atBats || []).forEach(ab => {
                    if (ab.playerId === player.id) {
                        hasAtBat = true; stats.atBats++; stats.rbis += ab.rbi || 0; stats.stolenBases += ab.stolenBases || 0;
                        switch (ab.result) { case 'single': stats.hits++; break; case 'double': stats.hits++; stats.doubles++; break; case 'triple': stats.hits++; stats.triples++; break; case 'homeRun': stats.hits++; stats.homeRuns++; break; case 'walk': stats.walks++; break; }
                    }
                });
            });
            if (hasAtBat) stats.games++;
            if (game.pitchingRecord && game.pitchingRecord.playerId === player.id) {
                stats.pitching.appearances++; stats.pitching.inningsPitched += game.pitchingRecord.inningsPitched || 0; stats.pitching.strikeouts += game.pitchingRecord.strikeouts || 0; stats.pitching.runsAllowed += game.pitchingRecord.runsAllowed || 0; stats.pitching.earnedRuns += game.pitchingRecord.earnedRuns || 0; stats.pitching.hitsAllowed += game.pitchingRecord.hitsAllowed || 0;
            }
        });
        if (stats.atBats > 0) { stats.average = (stats.hits / stats.atBats).toFixed(3).replace('0.', '.'); }
        if (stats.pitching.inningsPitched > 0) { stats.pitching.era = ((stats.pitching.earnedRuns / stats.pitching.inningsPitched) * 9).toFixed(2); }
        stats.pitching.inningsPitched = stats.pitching.inningsPitched.toFixed(1);
        return stats;
    },
    attachEvents() {}
};

// ========================================
// アプリ起動
// ========================================

document.addEventListener('DOMContentLoaded', () => { App.init(); });

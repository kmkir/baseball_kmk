// ========================================
// 野球スコア管理 PWA v2 - メインアプリケーション
// Firebase同期対応版
// ========================================

// ========================================
// ユーティリティ関数
// ========================================

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
}

function formatDateShort(dateStr) {
    const date = new Date(dateStr);
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    return `${date.getMonth() + 1}/${date.getDate()} (${weekdays[date.getDay()]})`;
}

function getYear(dateStr) {
    return new Date(dateStr).getFullYear();
}

// 五十音順ソート
function sortByJapanese(arr, key) {
    return arr.sort((a, b) => {
        const nameA = key ? a[key] : a;
        const nameB = key ? b[key] : b;
        return nameA.localeCompare(nameB, 'ja');
    });
}

// 投球回を表示用に変換（0, 0.1, 0.2 → 0, 1/3, 2/3）
function formatInnings(innings) {
    const full = Math.floor(innings);
    const fraction = Math.round((innings - full) * 10);
    if (fraction === 0) return full.toString();
    if (fraction === 1) return full === 0 ? '1/3' : `${full} 1/3`;
    if (fraction === 2) return full === 0 ? '2/3' : `${full} 2/3`;
    return innings.toString();
}

// 投球回を加算（0 → 1/3 → 2/3 → 1 → 1 1/3 ...）
function addInning(current, amount) {
    if (amount > 0) {
        const fraction = Math.round((current % 1) * 10);
        if (fraction === 0) return Math.floor(current) + 0.1;
        if (fraction === 1) return Math.floor(current) + 0.2;
        if (fraction === 2) return Math.floor(current) + 1;
    } else {
        const fraction = Math.round((current % 1) * 10);
        if (fraction === 0) return Math.max(0, Math.floor(current) - 0.8);
        if (fraction === 1) return Math.floor(current);
        if (fraction === 2) return Math.floor(current) + 0.1;
    }
    return Math.max(0, current);
}

// 選手統計計算
function calculatePlayerBattingStats(team, playerId) {
    const stats = { 
        games: 0, 
        attendance: 0,  // 参加数
        plateAppearances: 0,  // 打席数
        atBats: 0, 
        hits: 0, 
        walks: 0, 
        homeRuns: 0, 
        singles: 0, 
        doubles: 0, 
        triples: 0, 
        rbis: 0, 
        stolenBases: 0 
    };
    (team.games || []).forEach(game => {
        // 出席チェック
        const wasPresent = (game.attendingPlayers && game.attendingPlayers.includes(playerId)) ||
                          (game.battingOrder && game.battingOrder.some(b => b.id === playerId));
        if (wasPresent) stats.attendance++;
        
        let hasAtBat = false;
        (game.innings || []).forEach(inning => {
            (inning.atBats || []).forEach(ab => {
                if (ab.playerId === playerId) {
                    hasAtBat = true;
                    stats.plateAppearances++;  // すべての打席をカウント
                    stats.rbis += ab.rbi || 0;
                    stats.stolenBases += ab.stolenBases || 0;
                    switch (ab.result) {
                        case 'single': 
                            stats.atBats++;
                            stats.hits++; 
                            stats.singles++; 
                            break;
                        case 'double': 
                            stats.atBats++;
                            stats.hits++; 
                            stats.doubles++; 
                            break;
                        case 'triple': 
                            stats.atBats++;
                            stats.hits++; 
                            stats.triples++; 
                            break;
                        case 'homeRun': 
                            stats.atBats++;
                            stats.hits++; 
                            stats.homeRuns++; 
                            break;
                        case 'walk': 
                        case 'error':
                            stats.walks++; 
                            break;
                        case 'out':
                        case 'doublePlay':
                        case 'triplePlay':
                            stats.atBats++;
                            break;
                        case 'sacrifice':
                            // 犠牲打は打席数に含むが打数には含まない
                            break;
                    }
                }
            });
        });
        if (hasAtBat) stats.games++;
    });
    const avg = stats.atBats > 0 ? (stats.hits / stats.atBats) : 0;
    const obp = stats.plateAppearances > 0 ? ((stats.hits + stats.walks) / stats.plateAppearances) : 0;
    const totalBases = stats.singles + (stats.doubles * 2) + (stats.triples * 3) + (stats.homeRuns * 4);
    const slg = stats.atBats > 0 ? (totalBases / stats.atBats) : 0;
    return { ...stats, avg: avg.toFixed(3).replace('0.', '.'), obp: obp.toFixed(3).replace('0.', '.'), slg: slg.toFixed(3).replace('0.', '.'), ops: (obp + slg).toFixed(3) };
}

function calculatePlayerPitchingStats(team, playerId) {
    const stats = { appearances: 0, inningsPitched: 0, strikeouts: 0, runsAllowed: 0, earnedRuns: 0, hitsAllowed: 0, walks: 0 };
    (team.games || []).forEach(game => {
        (game.pitchingRecords || []).forEach(record => {
            if (record.playerId === playerId) {
                stats.appearances++;
                stats.inningsPitched += record.inningsPitched || 0;
                stats.strikeouts += record.strikeouts || 0;
                stats.runsAllowed += record.runsAllowed || 0;
                stats.earnedRuns += record.earnedRuns || 0;
                stats.hitsAllowed += record.hitsAllowed || 0;
            }
        });
        // 旧形式のpitchingRecord対応
        if (game.pitchingRecord && game.pitchingRecord.playerId === playerId) {
            stats.appearances++;
            stats.inningsPitched += game.pitchingRecord.inningsPitched || 0;
            stats.strikeouts += game.pitchingRecord.strikeouts || 0;
            stats.runsAllowed += game.pitchingRecord.runsAllowed || 0;
            stats.earnedRuns += game.pitchingRecord.earnedRuns || 0;
            stats.hitsAllowed += game.pitchingRecord.hitsAllowed || 0;
        }
    });
    const era = stats.inningsPitched > 0 ? ((stats.earnedRuns / stats.inningsPitched) * 9).toFixed(2) : '0.00';
    return { ...stats, era, inningsPitchedDisplay: formatInnings(stats.inningsPitched) };
}

// 登板経験があるかチェック
function hasPitchingExperience(team, playerId) {
    return (team.games || []).some(game => {
        if (game.pitchingRecords?.some(r => r.playerId === playerId)) return true;
        if (game.pitchingRecord?.playerId === playerId) return true;
        return false;
    });
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
    teams: [],
    unsubscribe: null,
    
    async init() {
        // チームを読み込み
        this.teams = await Database.getTeams();
        
        // リアルタイム同期開始
        this.unsubscribe = Database.startRealtimeSync((teams) => {
            this.teams = teams;
            // 現在のチームを更新
            if (this.currentTeam) {
                this.currentTeam = teams.find(t => t.id === this.currentTeam.id) || this.currentTeam;
            }
            if (this.currentGame && this.currentTeam) {
                this.currentGame = (this.currentTeam.games || []).find(g => g.id === this.currentGame.id) || this.currentGame;
            }
            this.render();
        });
        
        this.render();
    },
    
    navigate(view, params = {}) {
        this.currentView = view;
        Object.assign(this, params);
        this.render();
    },
    
    render() {
        const app = document.getElementById('app');
        switch (this.currentView) {
            case 'home': app.innerHTML = HomeView.render(); break;
            case 'teamManagement': app.innerHTML = TeamManagementView.render(); break;
            case 'playerManagement': app.innerHTML = PlayerManagementView.render(this.currentTeam); break;
            case 'playerDetail': app.innerHTML = PlayerDetailView.render(this.currentTeam, this.currentPlayer); break;
            case 'playerGallery': app.innerHTML = PlayerGalleryView.render(this.currentTeam); break;
            case 'yearList': app.innerHTML = YearListView.render(this.currentTeam); break;
            case 'gameList': app.innerHTML = GameListView.render(this.currentTeam, this.currentYear); break;
            case 'gameSetup': app.innerHTML = GameSetupView.render(this.currentTeam); break;
            case 'gameScore': app.innerHTML = GameScoreView.render(this.currentTeam, this.currentGame); break;
            case 'inningEdit': app.innerHTML = InningEditView.render(this.currentTeam, this.currentGame, this.currentInningIndex); break;
        }
    },
    
    getTeam(teamId) {
        return this.teams.find(t => t.id === teamId);
    },
    
    async saveTeam(team) {
        await Database.saveTeam(team);
        const index = this.teams.findIndex(t => t.id === team.id);
        if (index >= 0) this.teams[index] = team;
        else this.teams.push(team);
    }
};

// ========================================
// ホーム画面
// ========================================

const HomeView = {
    render() {
        const teams = App.teams;
        const syncStatus = firebaseEnabled ? '<span style="color:var(--success-color);">● 同期中</span>' : '<span style="color:var(--text-secondary);">○ ローカル</span>';
        return `
            <div class="header">
                <div class="header-icon">⚾</div>
                <h1>野球スコア管理</h1>
                <div style="font-size:0.75rem;margin-top:5px;">${syncStatus}</div>
            </div>
            <div class="card">
                <button class="btn btn-outline" onclick="App.navigate('teamManagement')">⚙️ チーム・選手管理</button>
            </div>
            ${teams.length === 0 ? `
                <div class="empty-state">
                    <div class="empty-state-icon">👥</div>
                    <div class="empty-state-text">チームが登録されていません</div>
                    <button class="btn btn-primary" onclick="App.navigate('teamManagement')">チームを追加</button>
                </div>
            ` : `
                <div class="card"><div class="card-title">チームを選択</div></div>
                ${teams.map(team => `
                    <div class="list-item" onclick="App.navigate('yearList', { currentTeam: App.getTeam('${team.id}') })">
                        <div class="list-item-icon">${team.name.charAt(0)}</div>
                        <div class="list-item-content">
                            <div class="list-item-title">${team.name}</div>
                            <div class="list-item-subtitle">${(team.players || []).length}人 • ${(team.games || []).length}試合</div>
                        </div>
                        <div class="list-item-arrow">›</div>
                    </div>
                `).join('')}
            `}
        `;
    }
};

// ========================================
// チーム管理
// ========================================

const TeamManagementView = {
    render() {
        const teams = App.teams;
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
                    <div class="list-item-content" onclick="App.navigate('playerManagement', { currentTeam: App.getTeam('${team.id}') })">
                        <div class="list-item-title">${team.name}</div>
                        <div class="list-item-subtitle">${(team.players || []).length}人の選手</div>
                    </div>
                    <button class="btn btn-small btn-danger" onclick="TeamManagementView.deleteTeam('${team.id}')" style="width:auto;">削除</button>
                </div>
            `).join('')}
        `;
    },
    async addTeam() {
        const input = document.getElementById('newTeamName');
        const name = input.value.trim();
        if (!name) { alert('チーム名を入力してください'); return; }
        const team = { id: generateId(), name, players: [], games: [], locations: [], opponents: [], tournaments: [], createdAt: new Date().toISOString() };
        await App.saveTeam(team);
        input.value = '';
        App.render();
    },
    async deleteTeam(teamId) {
        if (confirm('このチームを削除しますか？')) {
            await Database.deleteTeam(teamId);
            App.teams = App.teams.filter(t => t.id !== teamId);
            App.render();
        }
    }
};

// ========================================
// 選手管理（改良版）
// ========================================

const PlayerManagementView = {
    tab: 'list', // 'list', 'batting', 'pitching'
    battingSortBy: 'name', // 'name', 'avg', 'ops', 'obp', 'plateAppearances', 'atBats', 'hits', 'doubles', 'triples', 'homeRuns', 'walks', 'rbis', 'stolenBases', 'attendance'
    battingSortOrder: 'desc', // 'asc', 'desc'
    pitchingSortBy: 'name', // 'name', 'era', 'appearances', 'inningsPitched', 'strikeouts', 'runsAllowed', 'earnedRuns'
    pitchingSortOrder: 'desc', // 'asc', 'desc'
    
    render(team) {
        const players = sortByJapanese([...(team.players || [])], 'name');
        const playersWithPitching = players.filter(p => p.isPitcher || hasPitchingExperience(team, p.id));
        
        return `
            <div class="header"><div class="header-with-back">
                <button class="back-button" onclick="App.navigate('yearList', { currentTeam: App.currentTeam })">←</button>
                <h1>${team.name} - 選手管理</h1>
            </div></div>
            
            <div class="card">
                <div class="form-group"><input type="text" id="playerName" class="form-input" placeholder="選手名"></div>
                <div class="form-group">
                    <input type="number" id="playerNumber" class="form-input" placeholder="背番号" oninput="PlayerManagementView.checkNumberDuplicate()">
                    <div id="numberWarning" class="warning-text" style="display:none;">⚠️ この背番号は既に使用されています</div>
                </div>
                <div class="form-group"><label style="display:flex;align-items:center;gap:10px;"><input type="checkbox" id="isPitcher"><span>投手として登録</span></label></div>
                <button class="btn btn-primary" onclick="PlayerManagementView.addPlayer()">＋ 選手を追加</button>
            </div>
            
            <div class="tab-nav">
                <button class="tab-btn ${this.tab === 'list' ? 'active' : ''}" onclick="PlayerManagementView.setTab('list')">選手一覧</button>
                <button class="tab-btn ${this.tab === 'batting' ? 'active' : ''}" onclick="PlayerManagementView.setTab('batting')">打者情報</button>
                <button class="tab-btn ${this.tab === 'pitching' ? 'active' : ''}" onclick="PlayerManagementView.setTab('pitching')">投手情報</button>
            </div>
            
            ${this.tab === 'list' ? this.renderPlayerList(team, players) : ''}
            ${this.tab === 'batting' ? this.renderBattingStats(team, players) : ''}
            ${this.tab === 'pitching' ? this.renderPitchingStats(team, playersWithPitching) : ''}
        `;
    },
    
    renderPlayerList(team, players) {
        const playersWithImages = players.filter(p => p.imageUrl);
        return `
            ${playersWithImages.length > 0 ? `
                <div class="card">
                    <button class="btn btn-outline btn-large" onclick="App.navigate('playerGallery', { currentTeam: App.currentTeam })">
                        📷 選手画像ギャラリー (${playersWithImages.length}人)
                    </button>
                </div>
            ` : ''}
            <div class="card">
                <div class="card-title">登録選手 (${players.length}人)</div>
                ${players.length === 0 ? '<div style="text-align:center;color:var(--text-secondary);padding:20px;">選手が登録されていません</div>' : players.map(player => {
                    const stats = calculatePlayerBattingStats(team, player.id);
                    return `
                        <div class="player-card" onclick="App.navigate('playerDetail', { currentTeam: App.currentTeam, currentPlayer: App.currentTeam.players.find(p => p.id === '${player.id}') })">
                            <div class="player-card-avatar" style="${player.imageUrl ? `background-image:url('${player.imageUrl}');` : ''}">
                                ${!player.imageUrl ? `#${player.number || '-'}` : ''}
                            </div>
                            <div class="player-card-info">
                                <div class="player-card-name">
                                    ${player.name}
                                    ${player.isPitcher ? '<span class="badge-small">投手</span>' : ''}
                                </div>
                                <div class="player-card-stats">
                                    <span>参加 <strong>${stats.attendance}</strong></span>
                                    <span>打率 <strong>${stats.avg}</strong></span>
                                    <span>安打 <strong>${stats.hits}</strong></span>
                                    <span>HR <strong>${stats.homeRuns}</strong></span>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },
    
    renderBattingStats(team, players) {
        // 統計情報を計算
        const playersWithStats = players.map(player => ({
            player,
            stats: calculatePlayerBattingStats(team, player.id)
        }));
        
        // 並び替え
        playersWithStats.sort((a, b) => {
            let valA, valB;
            if (this.battingSortBy === 'name') {
                valA = a.player.name;
                valB = b.player.name;
                return valA.localeCompare(valB, 'ja');
            } else if (this.battingSortBy === 'avg' || this.battingSortBy === 'obp' || this.battingSortBy === 'ops') {
                valA = parseFloat(a.stats[this.battingSortBy]);
                valB = parseFloat(b.stats[this.battingSortBy]);
            } else {
                valA = a.stats[this.battingSortBy];
                valB = b.stats[this.battingSortBy];
            }
            
            if (this.battingSortOrder === 'desc') {
                return valB - valA;
            } else {
                return valA - valB;
            }
        });
        
        return `
            <div class="card" style="margin:12px;overflow-x:auto;">
                <table class="stats-table-new">
                    <thead>
                        <tr>
                            <th class="sticky-col sortable ${this.battingSortBy === 'name' ? 'active' : ''}" onclick="PlayerManagementView.sortBatting('name')">
                                選手 ${this.battingSortBy === 'name' ? (this.battingSortOrder === 'desc' ? '▼' : '▲') : ''}
                            </th>
                            <th class="sortable ${this.battingSortBy === 'avg' ? 'active' : ''}" onclick="PlayerManagementView.sortBatting('avg')">
                                打率 ${this.battingSortBy === 'avg' ? (this.battingSortOrder === 'desc' ? '▼' : '▲') : ''}
                            </th>
                            <th class="sortable ${this.battingSortBy === 'ops' ? 'active' : ''}" onclick="PlayerManagementView.sortBatting('ops')">
                                OPS ${this.battingSortBy === 'ops' ? (this.battingSortOrder === 'desc' ? '▼' : '▲') : ''}
                            </th>
                            <th class="sortable ${this.battingSortBy === 'obp' ? 'active' : ''}" onclick="PlayerManagementView.sortBatting('obp')">
                                出塁 ${this.battingSortBy === 'obp' ? (this.battingSortOrder === 'desc' ? '▼' : '▲') : ''}
                            </th>
                            <th class="sortable ${this.battingSortBy === 'plateAppearances' ? 'active' : ''}" onclick="PlayerManagementView.sortBatting('plateAppearances')">
                                打席 ${this.battingSortBy === 'plateAppearances' ? (this.battingSortOrder === 'desc' ? '▼' : '▲') : ''}
                            </th>
                            <th class="sortable ${this.battingSortBy === 'atBats' ? 'active' : ''}" onclick="PlayerManagementView.sortBatting('atBats')">
                                打数 ${this.battingSortBy === 'atBats' ? (this.battingSortOrder === 'desc' ? '▼' : '▲') : ''}
                            </th>
                            <th class="sortable ${this.battingSortBy === 'hits' ? 'active' : ''}" onclick="PlayerManagementView.sortBatting('hits')">
                                安打 ${this.battingSortBy === 'hits' ? (this.battingSortOrder === 'desc' ? '▼' : '▲') : ''}
                            </th>
                            <th class="sortable ${this.battingSortBy === 'doubles' ? 'active' : ''}" onclick="PlayerManagementView.sortBatting('doubles')">
                                2B ${this.battingSortBy === 'doubles' ? (this.battingSortOrder === 'desc' ? '▼' : '▲') : ''}
                            </th>
                            <th class="sortable ${this.battingSortBy === 'triples' ? 'active' : ''}" onclick="PlayerManagementView.sortBatting('triples')">
                                3B ${this.battingSortBy === 'triples' ? (this.battingSortOrder === 'desc' ? '▼' : '▲') : ''}
                            </th>
                            <th class="sortable ${this.battingSortBy === 'homeRuns' ? 'active' : ''}" onclick="PlayerManagementView.sortBatting('homeRuns')">
                                HR ${this.battingSortBy === 'homeRuns' ? (this.battingSortOrder === 'desc' ? '▼' : '▲') : ''}
                            </th>
                            <th class="sortable ${this.battingSortBy === 'walks' ? 'active' : ''}" onclick="PlayerManagementView.sortBatting('walks')">
                                四死 ${this.battingSortBy === 'walks' ? (this.battingSortOrder === 'desc' ? '▼' : '▲') : ''}
                            </th>
                            <th class="sortable ${this.battingSortBy === 'rbis' ? 'active' : ''}" onclick="PlayerManagementView.sortBatting('rbis')">
                                打点 ${this.battingSortBy === 'rbis' ? (this.battingSortOrder === 'desc' ? '▼' : '▲') : ''}
                            </th>
                            <th class="sortable ${this.battingSortBy === 'stolenBases' ? 'active' : ''}" onclick="PlayerManagementView.sortBatting('stolenBases')">
                                盗塁 ${this.battingSortBy === 'stolenBases' ? (this.battingSortOrder === 'desc' ? '▼' : '▲') : ''}
                            </th>
                            <th class="sortable ${this.battingSortBy === 'attendance' ? 'active' : ''}" onclick="PlayerManagementView.sortBatting('attendance')">
                                参加 ${this.battingSortBy === 'attendance' ? (this.battingSortOrder === 'desc' ? '▼' : '▲') : ''}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        ${playersWithStats.map(({ player, stats }) => `
                            <tr onclick="App.navigate('playerDetail', { currentTeam: App.currentTeam, currentPlayer: App.currentTeam.players.find(p => p.id === '${player.id}') })">
                                <td class="sticky-col player-name-cell">
                                    <span class="table-player-number">#${player.number || '-'}</span>
                                    <span class="table-player-name">${player.name}</span>
                                </td>
                                <td class="stat-highlight">${stats.avg}</td>
                                <td>${stats.ops}</td>
                                <td>${stats.obp}</td>
                                <td>${stats.plateAppearances}</td>
                                <td>${stats.atBats}</td>
                                <td>${stats.hits}</td>
                                <td>${stats.doubles}</td>
                                <td>${stats.triples}</td>
                                <td>${stats.homeRuns}</td>
                                <td>${stats.walks}</td>
                                <td>${stats.rbis}</td>
                                <td>${stats.stolenBases}</td>
                                <td>${stats.attendance}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },
    
    sortBatting(field) {
        if (this.battingSortBy === field) {
            this.battingSortOrder = this.battingSortOrder === 'desc' ? 'asc' : 'desc';
        } else {
            this.battingSortBy = field;
            this.battingSortOrder = 'desc';
        }
        App.render();
    },
    
    renderPitchingStats(team, players) {
        // 統計情報を計算
        const playersWithStats = players.map(player => ({
            player,
            stats: calculatePlayerPitchingStats(team, player.id)
        }));
        
        // 並び替え
        playersWithStats.sort((a, b) => {
            let valA, valB;
            if (this.pitchingSortBy === 'name') {
                valA = a.player.name;
                valB = b.player.name;
                return valA.localeCompare(valB, 'ja');
            } else if (this.pitchingSortBy === 'era') {
                valA = parseFloat(a.stats.era === '-.--' ? 999 : a.stats.era);
                valB = parseFloat(b.stats.era === '-.--' ? 999 : b.stats.era);
                // 防御率は低い方が良い
                if (this.pitchingSortOrder === 'asc') {
                    return valA - valB;  // 昇順：低い方が先
                } else {
                    return valB - valA;  // 降順：高い方が先
                }
            } else {
                valA = a.stats[this.pitchingSortBy];
                valB = b.stats[this.pitchingSortBy];
                if (this.pitchingSortOrder === 'desc') {
                    return valB - valA;
                } else {
                    return valA - valB;
                }
            }
        });
        
        return `
            <div class="card" style="margin:12px;overflow-x:auto;">
                <table class="stats-table-new">
                    <thead>
                        <tr>
                            <th class="sticky-col sortable ${this.pitchingSortBy === 'name' ? 'active' : ''}" onclick="PlayerManagementView.sortPitching('name')">
                                選手 ${this.pitchingSortBy === 'name' ? (this.pitchingSortOrder === 'desc' ? '▼' : '▲') : ''}
                            </th>
                            <th class="sortable ${this.pitchingSortBy === 'era' ? 'active' : ''}" onclick="PlayerManagementView.sortPitching('era')">
                                防御率 ${this.pitchingSortBy === 'era' ? (this.pitchingSortOrder === 'desc' ? '▼' : '▲') : ''}
                            </th>
                            <th class="sortable ${this.pitchingSortBy === 'appearances' ? 'active' : ''}" onclick="PlayerManagementView.sortPitching('appearances')">
                                登板 ${this.pitchingSortBy === 'appearances' ? (this.pitchingSortOrder === 'desc' ? '▼' : '▲') : ''}
                            </th>
                            <th class="sortable ${this.pitchingSortBy === 'inningsPitched' ? 'active' : ''}" onclick="PlayerManagementView.sortPitching('inningsPitched')">
                                投球回 ${this.pitchingSortBy === 'inningsPitched' ? (this.pitchingSortOrder === 'desc' ? '▼' : '▲') : ''}
                            </th>
                            <th class="sortable ${this.pitchingSortBy === 'strikeouts' ? 'active' : ''}" onclick="PlayerManagementView.sortPitching('strikeouts')">
                                奪三振 ${this.pitchingSortBy === 'strikeouts' ? (this.pitchingSortOrder === 'desc' ? '▼' : '▲') : ''}
                            </th>
                            <th class="sortable ${this.pitchingSortBy === 'runsAllowed' ? 'active' : ''}" onclick="PlayerManagementView.sortPitching('runsAllowed')">
                                失点 ${this.pitchingSortBy === 'runsAllowed' ? (this.pitchingSortOrder === 'desc' ? '▼' : '▲') : ''}
                            </th>
                            <th class="sortable ${this.pitchingSortBy === 'earnedRuns' ? 'active' : ''}" onclick="PlayerManagementView.sortPitching('earnedRuns')">
                                自責 ${this.pitchingSortBy === 'earnedRuns' ? (this.pitchingSortOrder === 'desc' ? '▼' : '▲') : ''}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        ${playersWithStats.map(({ player, stats }) => `
                            <tr onclick="App.navigate('playerDetail', { currentTeam: App.currentTeam, currentPlayer: App.currentTeam.players.find(p => p.id === '${player.id}') })">
                                <td class="sticky-col player-name-cell">
                                    <span class="table-player-number">#${player.number || '-'}</span>
                                    <span class="table-player-name">${player.name}</span>
                                    ${!player.isPitcher ? '<span class="table-badge">野手</span>' : ''}
                                </td>
                                <td class="stat-highlight">${stats.era}</td>
                                <td>${stats.appearances}</td>
                                <td>${stats.inningsPitchedDisplay}</td>
                                <td>${stats.strikeouts}</td>
                                <td>${stats.runsAllowed}</td>
                                <td>${stats.earnedRuns}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },
    
    sortPitching(field) {
        if (this.pitchingSortBy === field) {
            this.pitchingSortOrder = this.pitchingSortOrder === 'desc' ? 'asc' : 'desc';
        } else {
            this.pitchingSortBy = field;
            this.pitchingSortOrder = field === 'era' ? 'asc' : 'desc'; // 防御率はデフォルト昇順
        }
        App.render();
    },
    
    setTab(tab) {
        this.tab = tab;
        App.render();
    },
    
    async addPlayer() {
        const name = document.getElementById('playerName').value.trim();
        const number = document.getElementById('playerNumber').value;
        const isPitcher = document.getElementById('isPitcher').checked;
        if (!name) { alert('選手名を入力してください'); return; }
        
        const team = App.currentTeam;
        if (!team.players) team.players = [];
        
        // 背番号の重複チェック
        if (number) {
            const existingPlayer = team.players.find(p => p.number === parseInt(number));
            if (existingPlayer) {
                alert(`背番号 ${number} は既に ${existingPlayer.name} さんが使用しています`);
                return;
            }
        }
        
        team.players.push({ id: generateId(), name, number: number ? parseInt(number) : null, isPitcher, imageUrl: null });
        await App.saveTeam(team);
        document.getElementById('playerName').value = '';
        document.getElementById('playerNumber').value = '';
        document.getElementById('isPitcher').checked = false;
        document.getElementById('numberWarning').style.display = 'none';
        App.render();
    },
    
    checkNumberDuplicate() {
        const number = document.getElementById('playerNumber').value;
        const warning = document.getElementById('numberWarning');
        if (!number) {
            warning.style.display = 'none';
            return;
        }
        
        const team = App.currentTeam;
        if (!team || !team.players) {
            warning.style.display = 'none';
            return;
        }
        
        const existingPlayer = team.players.find(p => p.number === parseInt(number));
        if (existingPlayer) {
            warning.textContent = `⚠️ 背番号 ${number} は ${existingPlayer.name} さんが使用中`;
            warning.style.display = 'block';
        } else {
            warning.style.display = 'none';
        }
    }
};

// ========================================
// 選手詳細・編集
// ========================================

const PlayerDetailView = {
    editing: false,
    
    render(team, player) {
        const battingStats = calculatePlayerBattingStats(team, player.id);
        const pitchingStats = calculatePlayerPitchingStats(team, player.id);
        const hasPitching = player.isPitcher || hasPitchingExperience(team, player.id);
        
        return `
            <div class="header"><div class="header-with-back">
                <button class="back-button" onclick="PlayerDetailView.editing = false; App.navigate('playerManagement', { currentTeam: App.currentTeam })">←</button>
                <h1>${player.name}</h1>
            </div></div>
            
            <div class="player-detail-container">
                <div class="player-image-section" onclick="PlayerDetailView.uploadImage('${player.id}')">
                    ${player.imageUrl ? `
                        <img src="${player.imageUrl}" class="player-image-large" alt="${player.name}">
                        <div class="image-change-hint">タップして画像を変更</div>
                    ` : `
                        <div class="player-image-placeholder">
                            <div class="placeholder-icon">📷</div>
                            <div class="placeholder-text">タップして画像を追加</div>
                        </div>
                    `}
                </div>
                
                <div class="player-info-section">
                    ${this.editing ? `
                        <div class="edit-form">
                            <div class="form-group"><input type="text" id="editName" class="form-input" value="${player.name}" placeholder="選手名"></div>
                            <div class="form-group"><input type="number" id="editNumber" class="form-input" value="${player.number || ''}" placeholder="背番号"></div>
                            <div class="form-group"><label style="display:flex;align-items:center;gap:10px;"><input type="checkbox" id="editIsPitcher" ${player.isPitcher ? 'checked' : ''}><span>投手</span></label></div>
                            <div style="display:flex;gap:10px;">
                                <button class="btn btn-primary" onclick="PlayerDetailView.saveEdit('${player.id}')">保存</button>
                                <button class="btn btn-secondary" onclick="PlayerDetailView.editing = false; App.render()">キャンセル</button>
                            </div>
                        </div>
                    ` : `
                        <div class="player-header-info">
                            <div class="player-number-large">#${player.number || '-'}</div>
                            <div class="player-name-large">${player.name}</div>
                            ${player.isPitcher ? '<span class="badge badge-warning">投手</span>' : '<span class="badge badge-primary">野手</span>'}
                        </div>
                        <button class="btn btn-outline" onclick="PlayerDetailView.editing = true; App.render()">選手情報を編集</button>
                    `}
                </div>
            </div>
            
            <div class="stats-section">
                <div class="stats-section-title">打撃成績</div>
                <div class="card" style="overflow-x:auto;padding:0;">
                    <table class="stats-table-new">
                        <thead>
                            <tr>
                                <th>打率</th>
                                <th>OPS</th>
                                <th>出塁</th>
                                <th>打席</th>
                                <th>打数</th>
                                <th>安打</th>
                                <th>2B</th>
                                <th>3B</th>
                                <th>HR</th>
                                <th>四死</th>
                                <th>打点</th>
                                <th>盗塁</th>
                                <th>参加</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td class="stat-highlight">${battingStats.avg}</td>
                                <td>${battingStats.ops}</td>
                                <td>${battingStats.obp}</td>
                                <td>${battingStats.plateAppearances}</td>
                                <td>${battingStats.atBats}</td>
                                <td>${battingStats.hits}</td>
                                <td>${battingStats.doubles}</td>
                                <td>${battingStats.triples}</td>
                                <td>${battingStats.homeRuns}</td>
                                <td>${battingStats.walks}</td>
                                <td>${battingStats.rbis}</td>
                                <td>${battingStats.stolenBases}</td>
                                <td>${battingStats.attendance}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
            
            ${hasPitching ? `
                <div class="stats-section">
                    <div class="stats-section-title">投手成績</div>
                    <div class="stats-grid-detail">
                        <div class="stat-box highlight"><div class="stat-box-value">${pitchingStats.era}</div><div class="stat-box-label">防御率</div></div>
                        <div class="stat-box"><div class="stat-box-value">${pitchingStats.appearances}</div><div class="stat-box-label">登板</div></div>
                        <div class="stat-box"><div class="stat-box-value">${pitchingStats.inningsPitchedDisplay}</div><div class="stat-box-label">投球回</div></div>
                        <div class="stat-box"><div class="stat-box-value">${pitchingStats.strikeouts}</div><div class="stat-box-label">奪三振</div></div>
                        <div class="stat-box"><div class="stat-box-value">${pitchingStats.runsAllowed}</div><div class="stat-box-label">失点</div></div>
                        <div class="stat-box"><div class="stat-box-value">${pitchingStats.earnedRuns}</div><div class="stat-box-label">自責点</div></div>
                    </div>
                </div>
            ` : ''}
            
            <div class="card">
                <button class="btn btn-danger" onclick="PlayerDetailView.deletePlayer('${player.id}')">この選手を削除</button>
            </div>
        `;
    },
    
    async uploadImage(playerId) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            // 画像をアップロード
            const imageUrl = await Database.uploadImage(file, `players/${playerId}/${file.name}`);
            
            // 選手情報を更新
            const team = App.currentTeam;
            const player = team.players.find(p => p.id === playerId);
            if (player) {
                player.imageUrl = imageUrl;
                await App.saveTeam(team);
                App.currentPlayer = player;
                App.render();
            }
        };
        input.click();
    },
    
    async saveEdit(playerId) {
        const team = App.currentTeam;
        const player = team.players.find(p => p.id === playerId);
        const newNumber = parseInt(document.getElementById('editNumber').value) || null;
        
        // 背番号の重複チェック（自分以外）
        if (newNumber) {
            const existingPlayer = team.players.find(p => p.id !== playerId && p.number === newNumber);
            if (existingPlayer) {
                alert(`背番号 ${newNumber} は既に ${existingPlayer.name} さんが使用しています`);
                return;
            }
        }
        
        if (player) {
            player.name = document.getElementById('editName').value.trim() || player.name;
            player.number = newNumber;
            player.isPitcher = document.getElementById('editIsPitcher').checked;
            await App.saveTeam(team);
            App.currentPlayer = player;
            this.editing = false;
            App.render();
        }
    },
    
    async deletePlayer(playerId) {
        if (confirm('この選手を削除しますか？')) {
            const team = App.currentTeam;
            team.players = team.players.filter(p => p.id !== playerId);
            await App.saveTeam(team);
            App.navigate('playerManagement', { currentTeam: team });
        }
    }
};

// ========================================
// 選手画像ギャラリー（フリック対応）
// ========================================

const PlayerGalleryView = {
    currentIndex: 0,
    touchStartX: 0,
    touchEndX: 0,
    
    render(team) {
        const playersWithImages = (team.players || []).filter(p => p.imageUrl);
        if (playersWithImages.length === 0) {
            return `
                <div class="header"><div class="header-with-back">
                    <button class="back-button" onclick="App.navigate('playerManagement', { currentTeam: App.currentTeam })">←</button>
                    <h1>選手ギャラリー</h1>
                </div></div>
                <div class="empty-state"><div class="empty-state-text">画像が登録されていません</div></div>
            `;
        }
        
        const player = playersWithImages[this.currentIndex];
        return `
            <div class="header"><div class="header-with-back">
                <button class="back-button" onclick="PlayerGalleryView.currentIndex = 0; App.navigate('playerManagement', { currentTeam: App.currentTeam })">←</button>
                <h1>選手ギャラリー</h1>
            </div></div>
            
            <div class="gallery-container-full" 
                 ontouchstart="PlayerGalleryView.handleTouchStart(event)" 
                 ontouchend="PlayerGalleryView.handleTouchEnd(event)">
                <img src="${player.imageUrl}" class="gallery-image-full" alt="${player.name}">
                <div class="gallery-nav-buttons">
                    <button class="gallery-nav-btn-large" onclick="PlayerGalleryView.prev()" ${this.currentIndex === 0 ? 'disabled' : ''}>‹</button>
                    <button class="gallery-nav-btn-large" onclick="PlayerGalleryView.next()" ${this.currentIndex === playersWithImages.length - 1 ? 'disabled' : ''}>›</button>
                </div>
                <div class="gallery-player-info">
                    <div class="gallery-player-number">#${player.number || '-'}</div>
                    <div class="gallery-player-name">${player.name}</div>
                    <div class="gallery-counter">${this.currentIndex + 1} / ${playersWithImages.length}</div>
                </div>
            </div>
            
            <div class="gallery-thumbnails-row">
                ${playersWithImages.map((p, i) => `
                    <div class="gallery-thumb-item ${i === this.currentIndex ? 'active' : ''}" 
                         style="background-image:url('${p.imageUrl}')" 
                         onclick="PlayerGalleryView.goTo(${i})">
                    </div>
                `).join('')}
            </div>
            
            <div class="gallery-hint">← 左右にスワイプ →</div>
        `;
    },
    
    handleTouchStart(e) {
        this.touchStartX = e.changedTouches[0].screenX;
    },
    
    handleTouchEnd(e) {
        this.touchEndX = e.changedTouches[0].screenX;
        this.handleSwipe();
    },
    
    handleSwipe() {
        const diff = this.touchStartX - this.touchEndX;
        if (Math.abs(diff) > 50) {
            if (diff > 0) this.next();
            else this.prev();
        }
    },
    
    prev() {
        if (this.currentIndex > 0) { this.currentIndex--; App.render(); }
    },
    next() {
        const count = (App.currentTeam.players || []).filter(p => p.imageUrl).length;
        if (this.currentIndex < count - 1) { this.currentIndex++; App.render(); }
    },
    goTo(index) {
        this.currentIndex = index;
        App.render();
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
                    <div><div class="card-title" style="margin:0;">登録選手</div><div style="font-size:1.5rem;font-weight:700;">${(team.players || []).length}人</div></div>
                    <div><div class="card-title" style="margin:0;">総試合数</div><div style="font-size:1.5rem;font-weight:700;">${games.length}試合</div></div>
                </div>
                <button class="btn btn-outline btn-small" onclick="App.navigate('playerManagement', { currentTeam: App.currentTeam })">選手を管理</button>
            </div>
            <div class="card"><button class="btn btn-primary" onclick="GameSetupView.reset(); App.navigate('gameSetup', { currentTeam: App.currentTeam })">＋ 新しい試合を登録</button></div>
            ${years.length === 0 ? `<div class="empty-state"><div class="empty-state-icon">📅</div><div class="empty-state-text">試合がありません</div></div>` : years.map(year => {
                const yearGames = games.filter(g => getYear(g.date) === year);
                const wins = yearGames.filter(g => g.teamTotalRuns > g.opponentTotalRuns).length;
                const losses = yearGames.filter(g => g.teamTotalRuns < g.opponentTotalRuns).length;
                const draws = yearGames.length - wins - losses;
                return `
                    <div class="list-item" onclick="App.navigate('gameList', { currentTeam: App.currentTeam, currentYear: ${year} })">
                        <div class="list-item-content"><div class="list-item-title">${year}年</div><div class="list-item-subtitle">${yearGames.length}試合</div></div>
                        <div style="display:flex;gap:15px;">
                            <div style="text-align:center;"><div style="font-weight:700;color:var(--success-color);">${wins}</div><div style="font-size:0.7rem;color:var(--text-secondary);">勝</div></div>
                            <div style="text-align:center;"><div style="font-weight:700;color:var(--danger-color);">${losses}</div><div style="font-size:0.7rem;color:var(--text-secondary);">敗</div></div>
                        </div>
                        <div class="list-item-arrow">›</div>
                    </div>
                `;
            }).join('')}
        `;
    }
};

// ========================================
// 試合一覧
// ========================================

const GameListView = {
    render(team, year) {
        const games = (team.games || []).filter(g => getYear(g.date) === year).sort((a, b) => new Date(b.date) - new Date(a.date));
        const wins = games.filter(g => g.teamTotalRuns > g.opponentTotalRuns).length;
        const losses = games.filter(g => g.teamTotalRuns < g.opponentTotalRuns).length;
        return `
            <div class="header"><div class="header-with-back">
                <button class="back-button" onclick="App.navigate('yearList', {currentTeam: App.currentTeam})">←</button>
                <h1>${year}年</h1>
            </div></div>
            <div class="card">
                <div class="stats-grid">
                    <div class="stat-card"><div class="stat-value win">${wins}</div><div class="stat-label">勝</div></div>
                    <div class="stat-card"><div class="stat-value loss">${losses}</div><div class="stat-label">敗</div></div>
                    <div class="stat-card"><div class="stat-value">${games.length - wins - losses}</div><div class="stat-label">分</div></div>
                </div>
            </div>
            <div class="card"><button class="btn btn-primary" onclick="GameSetupView.reset(); App.navigate('gameSetup', { currentTeam: App.currentTeam })">＋ 試合を追加</button></div>
            ${games.length === 0 ? `<div class="empty-state"><div class="empty-state-icon">⚾</div><div class="empty-state-text">${year}年の試合はありません</div></div>` : games.map(game => {
                const isWin = game.teamTotalRuns > game.opponentTotalRuns;
                const isLoss = game.teamTotalRuns < game.opponentTotalRuns;
                return `
                    <div class="game-item">
                        <div class="game-item-header">
                            <span class="game-date">${formatDateShort(game.date)}</span>
                            <span class="game-type ${game.gameType === '公式戦' ? 'official' : 'practice'}">${game.gameType}</span>
                            ${game.tournament ? `<span class="game-tournament">${game.tournament}${game.round ? ` ${game.round}` : ''}</span>` : ''}
                            <button class="btn btn-small btn-danger" onclick="event.stopPropagation(); GameListView.deleteGame('${game.id}')" style="width:auto;padding:4px 8px;font-size:0.7rem;">削除</button>
                        </div>
                        <div class="game-score" onclick="App.navigate('gameScore', { currentTeam: App.currentTeam, currentGame: App.currentTeam.games.find(g => g.id === '${game.id}') })">
                            <div class="game-score-team"><div class="game-score-name">${team.name}</div><div class="game-score-runs ${isWin ? 'winner' : ''}">${game.teamTotalRuns || 0}</div></div>
                            <div class="game-score-vs">-</div>
                            <div class="game-score-team"><div class="game-score-name">${game.opponent}</div><div class="game-score-runs ${isLoss ? 'winner' : ''}">${game.opponentTotalRuns || 0}</div></div>
                        </div>
                        <div class="game-location">📍 ${game.location}</div>
                    </div>
                `;
            }).join('')}
        `;
    },
    async deleteGame(gameId) {
        if (confirm('この試合を削除しますか？')) {
            const team = App.currentTeam;
            team.games = team.games.filter(g => g.id !== gameId);
            await App.saveTeam(team);
            App.render();
        }
    }
};

// ========================================
// 試合設定（4ステップに変更）
// ========================================

const GameSetupView = {
    battingOrder: [],
    selectedPitcher: null,
    isFirstBatting: true,
    step: 1,
    gameData: {},
    attendingPlayers: [], // 出席者リスト
    
    reset() {
        this.battingOrder = [];
        this.selectedPitcher = null;
        this.isFirstBatting = true;
        this.step = 1;
        this.gameData = {};
        this.attendingPlayers = [];
    },
    
    render(team) {
        const today = new Date().toISOString().slice(0, 10);
        return `
            <div class="header"><div class="header-with-back">
                <button class="back-button" onclick="GameSetupView.goBack()">←</button>
                <h1>試合を登録</h1>
            </div></div>
            <div style="display:flex;padding:10px 12px;gap:4px;">
                ${[1,2,3,4,5].map(s => `<div style="flex:1;height:4px;border-radius:2px;background:${this.step >= s ? 'var(--primary-color)' : '#e5e7eb'};"></div>`).join('')}
            </div>
            ${this.step === 1 ? this.renderStep1(team, today) : ''}
            ${this.step === 2 ? this.renderStep2(team) : ''}
            ${this.step === 3 ? this.renderStep3(team) : ''}
            ${this.step === 4 ? this.renderStep4(team) : ''}
            ${this.step === 5 ? this.renderStep5(team) : ''}
        `;
    },
    
    renderStep1(team, today) {
        const locations = team.locations || [];
        const opponents = team.opponents || [];
        const tournaments = team.tournaments || [];
        const showTournament = this.gameData.gameType === '公式戦';
        
        return `
            <div class="setup-section">
                <div class="setup-section-title">📅 日付・種別</div>
                <div class="setup-card">
                    <div class="setup-row">
                        <label class="setup-label">日付</label>
                        <input type="date" id="gameDate" class="setup-input" value="${this.gameData.date || today}">
                    </div>
                    <div class="setup-row">
                        <label class="setup-label">種別</label>
                        <div class="game-type-select">
                            <button type="button" class="game-type-btn ${this.gameData.gameType !== '公式戦' ? 'active practice' : ''}" onclick="GameSetupView.setGameType('練習試合')">
                                <div class="game-type-icon">⚾</div>
                                <div class="game-type-label">練習試合</div>
                                <div class="game-type-desc">非公式の試合</div>
                            </button>
                            <button type="button" class="game-type-btn ${this.gameData.gameType === '公式戦' ? 'active official' : ''}" onclick="GameSetupView.setGameType('公式戦')">
                                <div class="game-type-icon">🏆</div>
                                <div class="game-type-label">公式戦</div>
                                <div class="game-type-desc">大会・リーグ戦</div>
                            </button>
                        </div>
                    </div>
                    <div id="tournamentFields" style="${showTournament ? '' : 'display:none;'}">
                        <div class="setup-row">
                            <label class="setup-label">大会名</label>
                            <input type="text" id="tournament" class="setup-input" placeholder="大会名を入力" value="${this.gameData.tournament || ''}">
                            ${tournaments.length > 0 ? `<div class="quick-select">${tournaments.slice(0, 3).map(t => `<button type="button" class="quick-btn" onclick="document.getElementById('tournament').value='${t}'">${t}</button>`).join('')}</div>` : ''}
                        </div>
                        <div class="setup-row">
                            <label class="setup-label">回戦</label>
                            <div class="round-buttons">
                                ${['1回戦', '2回戦', '3回戦', '準々決勝', '準決勝', '決勝'].map(r => `
                                    <button type="button" class="round-btn ${this.gameData.round === r ? 'active' : ''}" onclick="GameSetupView.setRound('${r}')">${r}</button>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="setup-section">
                <div class="setup-section-title">📍 場所・対戦相手</div>
                <div class="setup-card">
                    <div class="setup-row">
                        <label class="setup-label">場所</label>
                        <input type="text" id="location" class="setup-input" placeholder="場所を入力" value="${this.gameData.location || ''}">
                        ${locations.length > 0 ? `<div class="quick-select">${locations.slice(0, 3).map(loc => `<button type="button" class="quick-btn" onclick="document.getElementById('location').value='${loc}'">${loc}</button>`).join('')}</div>` : ''}
                    </div>
                    <div class="setup-row">
                        <label class="setup-label">対戦相手</label>
                        <input type="text" id="opponent" class="setup-input" placeholder="対戦相手を入力" value="${this.gameData.opponent || ''}">
                        ${opponents.length > 0 ? `<div class="quick-select">${opponents.slice(0, 3).map(opp => `<button type="button" class="quick-btn" onclick="document.getElementById('opponent').value='${opp}'">${opp}</button>`).join('')}</div>` : ''}
                    </div>
                </div>
            </div>
            
            <div class="setup-section">
                <div class="setup-section-title">⚾ 先攻・後攻</div>
                <div class="batting-order-select">
                    <button type="button" class="batting-select-btn ${this.isFirstBatting ? 'active first' : ''}" onclick="GameSetupView.setFirstBatting(true)">
                        <div class="batting-select-icon">🏃</div>
                        <div class="batting-select-label">先攻</div>
                        <div class="batting-select-desc">先に攻撃</div>
                    </button>
                    <button type="button" class="batting-select-btn ${!this.isFirstBatting ? 'active second' : ''}" onclick="GameSetupView.setFirstBatting(false)">
                        <div class="batting-select-icon">🛡️</div>
                        <div class="batting-select-label">後攻</div>
                        <div class="batting-select-desc">先に守備</div>
                    </button>
                </div>
            </div>
            
            <div class="setup-footer">
                <button class="btn btn-primary btn-large" onclick="GameSetupView.nextStep()">次へ：出席者登録 →</button>
            </div>
        `;
    },
    
    renderStep2(team) {
        const players = sortByJapanese([...(team.players || [])], 'name');
        
        return `
            <div class="attendance-container">
                <div class="card" style="margin: 16px;">
                    <div class="card-title">出席者を選択</div>
                    <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 16px;">
                        今日の試合に参加する選手を選択してください
                    </p>
                    <div class="attendance-grid">
                        ${players.map(player => `
                            <div class="attendance-player ${this.attendingPlayers.includes(player.id) ? 'selected' : ''}" 
                                 onclick="GameSetupView.toggleAttendance('${player.id}')">
                                <div class="attendance-player-number">#${player.number || '-'}</div>
                                <div class="attendance-player-name">${player.name}</div>
                                ${player.isPitcher ? '<div class="attendance-player-badge">投</div>' : ''}
                                <div class="attendance-check ${this.attendingPlayers.includes(player.id) ? 'visible' : ''}">✓</div>
                            </div>
                        `).join('')}
                    </div>
                    <div style="margin-top: 16px; text-align: center; color: var(--text-secondary); font-size: 0.9rem;">
                        選択: ${this.attendingPlayers.length}/${players.length}人
                    </div>
                </div>
            </div>
            
            <div class="setup-footer">
                <button class="btn btn-secondary" onclick="GameSetupView.prevStep()" style="flex:1;">← 戻る</button>
                <button class="btn btn-primary" onclick="GameSetupView.nextStep()" style="flex:2;" ${this.attendingPlayers.length === 0 ? 'disabled' : ''}>次へ：打順設定 →</button>
            </div>
        `;
    },
    
    toggleAttendance(playerId) {
        const index = this.attendingPlayers.indexOf(playerId);
        if (index >= 0) {
            this.attendingPlayers.splice(index, 1);
        } else {
            this.attendingPlayers.push(playerId);
        }
        App.render();
    },
    
    renderStep3(team) {
        const players = sortByJapanese([...(team.players || [])], 'name')
            .filter(p => this.attendingPlayers.includes(p.id)); // 出席者のみ表示
        const availablePlayers = players.filter(p => !this.battingOrder.find(b => b.id === p.id));
        const isFull = this.battingOrder.length >= 9;
        
        return `
            <div class="lineup-container">
                <div class="lineup-section">
                    <div class="lineup-header">
                        <span class="lineup-title">スタメン</span>
                        <span class="lineup-count ${isFull ? 'full' : ''}">${this.battingOrder.length}/9</span>
                    </div>
                    <div class="lineup-slots" id="lineupSlots">
                        ${this.battingOrder.length === 0 ? `
                            <div class="lineup-empty">
                                <div class="lineup-empty-icon">👆</div>
                                <div>下から選手をドラッグ<br>または タップして追加</div>
                            </div>
                        ` : this.battingOrder.map((player, index) => `
                            <div class="lineup-slot-new" draggable="true" 
                                 ondragstart="GameSetupView.dragStart(event, ${index}, 'lineup')"
                                 ondragover="GameSetupView.dragOver(event)"
                                 ondrop="GameSetupView.dropOnSlot(event, ${index})">
                                <div class="lineup-order-badge">${index + 1}番</div>
                                <div class="lineup-player-info">
                                    <span class="lineup-player-number">#${player.number || '-'}</span>
                                    <span class="lineup-player-name">${player.name}</span>
                                </div>
                                <button class="lineup-remove-btn" onclick="GameSetupView.removeFromOrder(${index})">×</button>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div class="bench-section">
                    <div class="bench-header">
                        <span class="bench-title">控え選手</span>
                        <span class="bench-hint">タップまたはドラッグで追加</span>
                    </div>
                    <div class="bench-players" id="benchPlayers"
                         ondragover="GameSetupView.dragOver(event)"
                         ondrop="GameSetupView.dropOnBench(event)">
                        ${availablePlayers.length === 0 ? `
                            <div class="bench-empty">全選手がスタメンです</div>
                        ` : availablePlayers.map(player => `
                            <div class="bench-player" draggable="true"
                                 ondragstart="GameSetupView.dragStart(event, '${player.id}', 'bench')"
                                 onclick="GameSetupView.addToOrder('${player.id}')">
                                <span class="bench-player-number">#${player.number || '-'}</span>
                                <span class="bench-player-name">${player.name}</span>
                                ${player.isPitcher ? '<span class="bench-player-badge">投</span>' : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
            
            <div class="setup-footer">
                <button class="btn btn-secondary" onclick="GameSetupView.prevStep()" style="flex:1;">← 戻る</button>
                <button class="btn btn-primary" onclick="GameSetupView.nextStep()" style="flex:2;" ${this.battingOrder.length === 0 ? 'disabled' : ''}>次へ：投手選択 →</button>
            </div>
        `;
    },
    
    renderStep4(team) {
        const players = sortByJapanese([...(team.players || [])], 'name')
            .filter(p => this.attendingPlayers.includes(p.id)); // 出席者のみ
        const pitchers = players.filter(p => p.isPitcher);
        const others = players.filter(p => !p.isPitcher);
        
        // エラーチェック：選択された投手がスタメンにいるか
        let errorMessage = '';
        if (this.selectedPitcher && !this.battingOrder.find(p => p.id === this.selectedPitcher.id)) {
            errorMessage = '⚠️ 先発投手はスタメンに含まれている必要があります';
        }
        
        return `
            <div class="card">
                <div class="card-title">先発投手を選択</div>
                ${errorMessage ? `<div class="error-message">${errorMessage}</div>` : ''}
                ${this.selectedPitcher ? `
                    <div class="selected-pitcher-display ${errorMessage ? 'error' : ''}">
                        <div class="selected-pitcher-icon">⚾</div>
                        <div class="selected-pitcher-info">
                            <div class="selected-pitcher-number">#${this.selectedPitcher.number || '-'}</div>
                            <div class="selected-pitcher-name">${this.selectedPitcher.name}</div>
                        </div>
                        <button class="btn btn-outline" onclick="GameSetupView.clearPitcher()" style="width:auto;">変更</button>
                    </div>
                ` : `
                    ${pitchers.length > 0 ? `
                        <div class="pitcher-section-title">投手</div>
                        <div class="player-select-grid">${pitchers.map(p => `
                            <div class="player-select-item pitcher" onclick="GameSetupView.selectPitcher('${p.id}')">
                                <span class="player-select-number">#${p.number || '-'}</span>
                                <span class="player-select-name">${p.name}</span>
                            </div>
                        `).join('')}</div>
                    ` : ''}
                    ${others.length > 0 ? `
                        <div class="pitcher-section-title" style="margin-top:16px;">野手</div>
                        <div class="player-select-grid">${others.map(p => `
                            <div class="player-select-item" onclick="GameSetupView.selectPitcher('${p.id}')">
                                <span class="player-select-number">#${p.number || '-'}</span>
                                <span class="player-select-name">${p.name}</span>
                            </div>
                        `).join('')}</div>
                    ` : ''}
                `}
            </div>
            <div class="setup-footer">
                <button class="btn btn-secondary" onclick="GameSetupView.prevStep()" style="flex:1;">← 戻る</button>
                <button class="btn btn-primary" onclick="GameSetupView.nextStep()" style="flex:2;" ${!this.selectedPitcher || errorMessage ? 'disabled' : ''}>次へ：確認 →</button>
            </div>
        `;
    },
    
    renderStep5(team) {
        return `
            <div class="card">
                <div class="card-title">試合情報</div>
                <div class="confirm-info-grid">
                    <div class="confirm-info-item"><span class="confirm-label">日付</span><span class="confirm-value">${formatDate(this.gameData.date)}</span></div>
                    <div class="confirm-info-item"><span class="confirm-label">種別</span><span class="confirm-value">${this.gameData.gameType}</span></div>
                    ${this.gameData.tournament ? `<div class="confirm-info-item"><span class="confirm-label">大会</span><span class="confirm-value">${this.gameData.tournament}${this.gameData.round ? ` ${this.gameData.round}` : ''}</span></div>` : ''}
                    <div class="confirm-info-item"><span class="confirm-label">場所</span><span class="confirm-value">${this.gameData.location}</span></div>
                    <div class="confirm-info-item"><span class="confirm-label">対戦相手</span><span class="confirm-value">${this.gameData.opponent}</span></div>
                    <div class="confirm-info-item"><span class="confirm-label">先攻/後攻</span><span class="confirm-value">${this.isFirstBatting ? '先攻' : '後攻'}</span></div>
                </div>
            </div>
            
            <div class="card">
                <div class="card-title">先発投手</div>
                <div class="confirm-pitcher">
                    <span class="confirm-pitcher-number">#${this.selectedPitcher.number || '-'}</span>
                    <span class="confirm-pitcher-name">${this.selectedPitcher.name}</span>
                </div>
            </div>
            
            <div class="card">
                <div class="card-title">打順</div>
                <div class="confirm-batting-order">
                    ${this.battingOrder.map((player, index) => {
                        const stats = calculatePlayerBattingStats(team, player.id);
                        return `
                            <div class="confirm-batting-item">
                                <div class="confirm-batting-num">${index + 1}</div>
                                <div class="confirm-batting-player">${player.name}</div>
                                <div class="confirm-batting-stats">
                                    <span>打率 ${stats.avg}</span>
                                    <span>OPS ${stats.ops}</span>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
            
            <div class="p-12" style="display:flex;gap:10px;">
                <button class="btn btn-secondary btn-large" onclick="GameSetupView.prevStep()" style="flex:1;">← 戻る</button>
                <button class="btn btn-success btn-large" onclick="GameSetupView.createGame()" style="flex:2;">試合を開始</button>
            </div>
        `;
    },
    
    onGameTypeChange() {
        const gameType = document.getElementById('gameType').value;
        this.gameData.gameType = gameType;
        document.getElementById('tournamentFields').style.display = gameType === '公式戦' ? '' : 'none';
    },
    
    setGameType(type) {
        this.saveCurrentInputs();
        this.gameData.gameType = type;
        App.render();
    },
    
    setRound(round) {
        this.saveCurrentInputs();
        this.gameData.round = round;
        App.render();
    },
    
    setFirstBatting(isFirst) { 
        // 現在の入力値を保存
        this.saveCurrentInputs();
        this.isFirstBatting = isFirst; 
        App.render(); 
    },
    
    saveCurrentInputs() {
        const dateEl = document.getElementById('gameDate');
        const locationEl = document.getElementById('location');
        const opponentEl = document.getElementById('opponent');
        const tournamentEl = document.getElementById('tournament');
        
        if (dateEl) this.gameData.date = dateEl.value;
        if (locationEl) this.gameData.location = locationEl.value;
        if (opponentEl) this.gameData.opponent = opponentEl.value;
        if (tournamentEl) this.gameData.tournament = tournamentEl.value;
    },
    
    goBack() {
        if (this.step > 1) { this.prevStep(); }
        else { this.reset(); App.navigate('yearList', { currentTeam: App.currentTeam }); }
    },
    
    nextStep() {
        if (this.step === 1) {
            const date = document.getElementById('gameDate').value;
            const location = document.getElementById('location').value.trim();
            const opponent = document.getElementById('opponent').value.trim();
            const tournament = document.getElementById('tournament')?.value.trim() || '';
            if (!date || !location || !opponent) { alert('日付・場所・対戦相手を入力してください'); return; }
            this.gameData.date = date;
            this.gameData.location = location;
            this.gameData.opponent = opponent;
            this.gameData.tournament = tournament;
            if (!this.gameData.gameType) this.gameData.gameType = '練習試合';
        }
        this.step++;
        App.render();
    },
    
    prevStep() { this.step--; App.render(); },
    
    // ドラッグ&ドロップ関連
    dragData: null,
    
    dragStart(event, data, source) {
        this.dragData = { data, source };
        event.target.classList.add('dragging');
        event.dataTransfer.effectAllowed = 'move';
    },
    
    dragOver(event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    },
    
    dropOnSlot(event, targetIndex) {
        event.preventDefault();
        if (!this.dragData) return;
        
        const { data, source } = this.dragData;
        
        if (source === 'bench') {
            // ベンチからスロットへ
            const player = App.currentTeam.players.find(p => p.id === data);
            if (player && !this.battingOrder.find(b => b.id === data)) {
                this.battingOrder.splice(targetIndex, 0, player);
            }
        } else if (source === 'lineup') {
            // ラインナップ内での並び替え
            const fromIndex = data;
            if (fromIndex !== targetIndex) {
                const [moved] = this.battingOrder.splice(fromIndex, 1);
                this.battingOrder.splice(targetIndex > fromIndex ? targetIndex - 1 : targetIndex, 0, moved);
            }
        }
        
        this.dragData = null;
        App.render();
    },
    
    dropOnBench(event) {
        event.preventDefault();
        if (!this.dragData) return;
        
        const { data, source } = this.dragData;
        
        if (source === 'lineup') {
            // ラインナップからベンチへ（削除）
            this.battingOrder.splice(data, 1);
        }
        
        this.dragData = null;
        App.render();
    },
    
    addToOrder(playerId) {
        if (this.battingOrder.length >= 9) { alert('打順は9人までです'); return; }
        const player = App.currentTeam.players.find(p => p.id === playerId);
        if (player && !this.battingOrder.find(b => b.id === playerId)) { this.battingOrder.push(player); App.render(); }
    },
    
    removeFromOrder(index) { this.battingOrder.splice(index, 1); App.render(); },
    
    selectPitcher(playerId) { this.selectedPitcher = App.currentTeam.players.find(p => p.id === playerId); App.render(); },
    
    clearPitcher() { this.selectedPitcher = null; App.render(); },
    
    async createGame() {
        const team = App.currentTeam;
        const game = {
            id: generateId(),
            date: this.gameData.date,
            gameType: this.gameData.gameType,
            location: this.gameData.location,
            opponent: this.gameData.opponent,
            tournament: this.gameData.tournament || null,
            round: this.gameData.round || null,
            isFirstBatting: this.isFirstBatting,
            attendingPlayers: this.attendingPlayers,  // 出席者リスト
            battingOrder: this.battingOrder.map(p => ({ id: p.id, name: p.name, number: p.number })),
            currentPitcherId: this.selectedPitcher.id,
            pitchingRecords: [{ playerId: this.selectedPitcher.id, playerName: this.selectedPitcher.name, inningsPitched: 0, strikeouts: 0, runsAllowed: 0, earnedRuns: 0, hitsAllowed: 0 }],
            innings: [{ number: 1, teamRuns: 0, teamHits: 0, opponentRuns: 0, opponentHits: 0, atBats: [], topComplete: false, bottomComplete: false }],
            teamTotalRuns: 0, teamTotalHits: 0, opponentTotalRuns: 0, opponentTotalHits: 0,
            currentInning: 1, isTeamBatting: this.isFirstBatting, currentBatterIndex: 0, currentOuts: 0, isFinished: false,
            pendingRbi: 0, pendingSteals: 0,
            createdAt: new Date().toISOString()
        };
        
        // 履歴を保存
        if (!team.locations) team.locations = [];
        if (!team.locations.includes(game.location)) team.locations.unshift(game.location);
        team.locations = team.locations.slice(0, 20);
        
        if (!team.opponents) team.opponents = [];
        if (!team.opponents.includes(game.opponent)) team.opponents.unshift(game.opponent);
        team.opponents = team.opponents.slice(0, 20);
        
        if (game.tournament) {
            if (!team.tournaments) team.tournaments = [];
            if (!team.tournaments.includes(game.tournament)) team.tournaments.unshift(game.tournament);
            team.tournaments = team.tournaments.slice(0, 20);
        }
        
        if (!team.games) team.games = [];
        team.games.push(game);
        await App.saveTeam(team);
        
        this.reset();
        App.navigate('gameScore', { currentTeam: team, currentGame: game });
    }
};

// ========================================
// 試合スコア
// ========================================

const GameScoreView = {
    render(team, game) {
        if (game.isFinished) return this.renderFinishedGame(team, game);
        return `
            <div class="game-screen">
                <div class="scoreboard-section">${this.renderScoreboard(team, game)}</div>
                <div class="input-section">${game.isTeamBatting ? this.renderBattingInput(team, game) : this.renderDefenseInput(team, game)}</div>
            </div>
        `;
    },
    
    renderFinishedGame(team, game) {
        const isWin = game.teamTotalRuns > game.opponentTotalRuns;
        const isLoss = game.teamTotalRuns < game.opponentTotalRuns;
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
                        <span style="color:${isWin ? 'var(--success-color)' : ''}">${game.teamTotalRuns}</span>
                        <span style="margin:0 15px;">-</span>
                        <span style="color:${isLoss ? 'var(--success-color)' : ''}">${game.opponentTotalRuns}</span>
                    </div>
                    <div style="margin-top:10px;color:var(--text-secondary);">
                        ${isWin ? '勝利' : isLoss ? '敗北' : '引き分け'}
                    </div>
                </div>
            </div>
            <div class="card">
                <button class="btn btn-outline" onclick="GameScoreView.resumeGame()">試合を再開</button>
            </div>
        `;
    },
    
    renderScoreboard(team, game) {
        const maxInnings = Math.max(7, game.currentInning);
        const innings = game.innings || [];
        const topTeam = game.isFirstBatting ? team.name : game.opponent;
        const bottomTeam = game.isFirstBatting ? game.opponent : team.name;
        
        const getTopScore = (inn, inningIndex) => {
            // そのイニングが完了していれば点数を表示
            if (inn && inn.topComplete) {
                return game.isFirstBatting ? inn.teamRuns : inn.opponentRuns;
            }
            return null;
        };
        
        const getBottomScore = (inn, inningIndex) => {
            // そのイニングが完了していれば点数を表示
            if (inn && inn.bottomComplete) {
                return game.isFirstBatting ? inn.opponentRuns : inn.teamRuns;
            }
            return null;
        };
        
        const topTotalRuns = game.isFirstBatting ? game.teamTotalRuns : game.opponentTotalRuns;
        const bottomTotalRuns = game.isFirstBatting ? game.opponentTotalRuns : game.teamTotalRuns;
        const topTotalHits = game.isFirstBatting ? game.teamTotalHits : game.opponentTotalHits;
        const bottomTotalHits = game.isFirstBatting ? game.opponentTotalHits : game.teamTotalHits;
        
        return `
            <div class="scoreboard-with-back">
                <button class="scoreboard-back-btn" onclick="GameScoreView.exitGame()">←</button>
                <div class="scoreboard">
                    <table class="scoreboard-table">
                        <thead><tr><th class="team-name"></th>${[...Array(maxInnings)].map((_, i) => `<th class="inning-cell" onclick="GameScoreView.editInning(${i})">${i + 1}</th>`).join('')}<th class="total">計</th><th class="hits">H</th></tr></thead>
                        <tbody>
                            <tr class="team-row"><td class="team-name">${topTeam}</td>${[...Array(maxInnings)].map((_, i) => { const inn = innings[i]; const score = inn ? getTopScore(inn, i) : null; return `<td class="score-cell ${score !== null ? 'has-score' : ''}" onclick="GameScoreView.editInning(${i})">${score !== null ? score : '-'}</td>`; }).join('')}<td class="total">${topTotalRuns || 0}</td><td class="hits">${topTotalHits || 0}</td></tr>
                            <tr class="team-row"><td class="team-name">${bottomTeam}</td>${[...Array(maxInnings)].map((_, i) => { const inn = innings[i]; const score = inn ? getBottomScore(inn, i) : null; return `<td class="score-cell ${score !== null ? 'has-score' : ''}" onclick="GameScoreView.editInning(${i})">${score !== null ? score : '-'}</td>`; }).join('')}<td class="total">${bottomTotalRuns || 0}</td><td class="hits">${bottomTotalHits || 0}</td></tr>
                        </tbody>
                    </table>
                    <div style="font-size:0.7rem;text-align:center;color:#9ca3af;margin-top:5px;">スコアをタップで編集</div>
                </div>
            </div>
        `;
    },
    
    renderBattingInput(team, game) {
        const currentInning = game.innings[game.currentInning - 1] || { atBats: [] };
        const currentBatter = game.battingOrder[game.currentBatterIndex];
        const pendingRbi = game.pendingRbi || 0;
        const pendingSteals = game.pendingSteals || 0;
        
        return `
            <div class="outs-display">
                <div class="outs-circles">
                    ${[0,1,2].map(i => `<div class="out-circle ${i < game.currentOuts ? 'active' : ''}">🔴</div>`).join('')}
                </div>
            </div>
            
            <div class="game-main-content">
                ${(currentInning.atBats || []).length > 0 ? `
                    <div class="inning-history-simple">
                        <div class="history-label-simple">このイニング</div>
                        ${(currentInning.atBats || []).map((ab, idx) => {
                            const batterOrder = game.battingOrder.findIndex(b => b.id === ab.playerId) + 1;
                            return `
                                <div class="history-item-simple" onclick="GameScoreView.showEditAtBatModal(${idx})">
                                    <span class="history-order-simple">${batterOrder}番</span>
                                    <span class="history-name-simple">${ab.playerName}</span>
                                    <span class="history-result-simple">${AtBatResults[ab.result].name}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                ` : ''}
                
                <div class="batter-display-compact">
                    ${game.currentBatterIndex + 1}番　${currentBatter ? currentBatter.name : '---'}
                </div>
                
                <div class="result-buttons">
                    <div class="result-row hit-row">
                        <button class="result-btn hit" onclick="GameScoreView.recordAtBat('single')">
                            <span class="result-text">ヒット</span>
                        </button>
                        <button class="result-btn hit" onclick="GameScoreView.recordAtBat('double')">
                            <span class="result-text">2塁打</span>
                        </button>
                        <button class="result-btn hit" onclick="GameScoreView.recordAtBat('triple')">
                            <span class="result-text">3塁打</span>
                        </button>
                        <button class="result-btn hit hr" onclick="GameScoreView.recordAtBat('homeRun')">
                            <span class="result-text">HR</span>
                        </button>
                    </div>
                    <div class="result-row other-row">
                        <button class="result-btn walk" onclick="GameScoreView.recordAtBat('walk')">
                            <span class="result-text">四死球</span>
                        </button>
                        <button class="result-btn walk" onclick="GameScoreView.recordAtBat('error')">
                            <span class="result-text">エラー</span>
                        </button>
                        <button class="result-btn sacrifice" onclick="GameScoreView.recordAtBat('sacrifice')">
                            <span class="result-text">犠牲</span>
                        </button>
                    </div>
                    <div class="result-row out-row">
                        <button class="result-btn out" onclick="GameScoreView.recordAtBat('out')">
                            <span class="result-text">アウト</span>
                        </button>
                        <button class="result-btn out" onclick="GameScoreView.recordAtBat('doublePlay')">
                            <span class="result-text">併殺</span>
                        </button>
                        <button class="result-btn out" onclick="GameScoreView.recordAtBat('triplePlay')">
                            <span class="result-text">三殺</span>
                        </button>
                    </div>
                </div>
                
                <div class="extra-stats">
                    <div class="extra-stat-box">
                        <div class="extra-stat-label">打点</div>
                        <div class="extra-stat-control">
                            <button class="extra-btn minus" onclick="GameScoreView.adjustPending('rbi', -1)">−</button>
                            <span class="extra-value">${pendingRbi}</span>
                            <button class="extra-btn plus" onclick="GameScoreView.adjustPending('rbi', 1)">＋</button>
                        </div>
                    </div>
                    <div class="extra-stat-box">
                        <div class="extra-stat-label">盗塁</div>
                        <div class="extra-stat-control">
                            <button class="extra-btn minus" onclick="GameScoreView.adjustPending('steals', -1)">−</button>
                            <span class="extra-value">${pendingSteals}</span>
                            <button class="extra-btn plus" onclick="GameScoreView.adjustPending('steals', 1)">＋</button>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="game-footer">
                <button class="change-button-new" onclick="GameScoreView.performChange()">
                    <span class="change-icon">🔄</span>
                    <span>チェンジ</span>
                </button>
                <button class="end-button-new" onclick="GameScoreView.endGame()">試合終了</button>
            </div>
        `;
    },
    
    renderDefenseInput(team, game) {
        const currentInning = game.innings[game.currentInning - 1] || { opponentRuns: 0, opponentHits: 0 };
        const currentPitcher = game.pitchingRecords.find(r => r.playerId === game.currentPitcherId) || game.pitchingRecords[0];
        
        return `
            <div class="current-pitcher-display-small">
                <div class="current-pitcher-label">投手</div>
                <div class="current-pitcher-name">${currentPitcher.playerName}</div>
            </div>
            
            <div class="game-main-content defense">
                <div class="opponent-attack-section-small">
                    <div class="section-title">相手チームの攻撃</div>
                    <div class="opponent-stats-single">
                        <div class="opponent-stat-single hits">
                            <div class="opponent-stat-label">被安打</div>
                            <div class="opponent-stat-control">
                                <button class="counter-btn minus" onclick="GameScoreView.adjustOpponentHits(-1)">−</button>
                                <span class="counter-value">${currentInning.opponentHits || 0}</span>
                                <button class="counter-btn plus" onclick="GameScoreView.adjustOpponentHits(1)">＋</button>
                            </div>
                        </div>
                    </div>
                </div>
                
                ${game.pitchingRecords.length > 1 ? `
                    <div class="pitchers-list-section">
                        <div class="section-title">登板投手</div>
                        <div class="pitchers-list">
                            ${game.pitchingRecords.map(r => `
                                <div class="pitchers-list-item ${r.playerId === game.currentPitcherId ? 'current' : ''}">
                                    <span class="pitchers-name">${r.playerName}</span>
                                    <span class="pitchers-stats">${formatInnings(r.inningsPitched)}回 / ${r.strikeouts}K / ${r.earnedRuns}自責</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                
                <div class="pitcher-section">
                    <div class="section-title">投手成績</div>
                    <div class="pitcher-stats-grid">
                        <div class="pitcher-stat-box">
                            <div class="pitcher-stat-label">投球回</div>
                            <div class="pitcher-stat-control">
                                <button class="counter-btn small minus" onclick="GameScoreView.adjustPitching('inningsPitched', -1)">−</button>
                                <span class="pitcher-stat-value">${formatInnings(currentPitcher.inningsPitched)}</span>
                                <button class="counter-btn small plus" onclick="GameScoreView.adjustPitching('inningsPitched', 1)">＋</button>
                            </div>
                        </div>
                        <div class="pitcher-stat-box">
                            <div class="pitcher-stat-label">奪三振</div>
                            <div class="pitcher-stat-control">
                                <button class="counter-btn small minus" onclick="GameScoreView.adjustPitching('strikeouts', -1)">−</button>
                                <span class="pitcher-stat-value">${currentPitcher.strikeouts}</span>
                                <button class="counter-btn small plus" onclick="GameScoreView.adjustPitching('strikeouts', 1)">＋</button>
                            </div>
                        </div>
                        <div class="pitcher-stat-box">
                            <div class="pitcher-stat-label">失点</div>
                            <div class="pitcher-stat-control">
                                <button class="counter-btn small minus" onclick="GameScoreView.adjustPitching('runsAllowed', -1)">−</button>
                                <span class="pitcher-stat-value">${currentPitcher.runsAllowed}</span>
                                <button class="counter-btn small plus" onclick="GameScoreView.adjustPitching('runsAllowed', 1)">＋</button>
                            </div>
                        </div>
                        <div class="pitcher-stat-box">
                            <div class="pitcher-stat-label">自責点</div>
                            <div class="pitcher-stat-control">
                                <button class="counter-btn small minus" onclick="GameScoreView.adjustPitching('earnedRuns', -1)">−</button>
                                <span class="pitcher-stat-value">${currentPitcher.earnedRuns}</span>
                                <button class="counter-btn small plus" onclick="GameScoreView.adjustPitching('earnedRuns', 1)">＋</button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="pitcher-change-section">
                    <button class="pitcher-change-button-bottom" onclick="GameScoreView.showPitcherChange()">
                        <span>🔄</span> 投手交代
                    </button>
                </div>
            </div>
            
            <div class="game-footer">
                <button class="change-button-new" onclick="GameScoreView.performChange()">
                    <span class="change-icon">🔄</span>
                    <span>チェンジ</span>
                </button>
                <button class="end-button-new" onclick="GameScoreView.endGame()">試合終了</button>
            </div>
        `;
    },
    
    async adjustPending(type, amount) {
        const game = App.currentGame;
        if (type === 'rbi') game.pendingRbi = Math.max(0, (game.pendingRbi || 0) + amount);
        else game.pendingSteals = Math.max(0, (game.pendingSteals || 0) + amount);
        App.render();
    },
    
    showEditAtBatModal(index) {
        const game = App.currentGame;
        const currentInning = game.innings[game.currentInning - 1];
        const atBat = currentInning.atBats[index];
        if (!atBat) return;
        
        const resultButtons = Object.entries(AtBatResults).map(([key, val]) => `
            <button class="modal-result-btn ${val.type} ${atBat.result === key ? 'selected' : ''}" 
                    onclick="GameScoreView.updateAtBatResult(${index}, '${key}')">${val.name}</button>
        `).join('');
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal edit-modal">
                <div class="modal-header">
                    <span class="modal-title">${atBat.playerName}の打席を編集</span>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
                </div>
                <div class="modal-body">
                    <div class="modal-section">
                        <div class="modal-section-title">打席結果</div>
                        <div class="modal-result-grid">${resultButtons}</div>
                    </div>
                    <div class="modal-section">
                        <div class="modal-section-title">打点・盗塁</div>
                        <div class="modal-stats-row">
                            <div class="modal-stat-item">
                                <span class="modal-stat-label">打点</span>
                                <div class="modal-stat-controls">
                                    <button onclick="GameScoreView.updateAtBatStat(${index}, 'rbi', -1)">−</button>
                                    <span id="editRbi${index}">${atBat.rbi || 0}</span>
                                    <button onclick="GameScoreView.updateAtBatStat(${index}, 'rbi', 1)">＋</button>
                                </div>
                            </div>
                            <div class="modal-stat-item">
                                <span class="modal-stat-label">盗塁</span>
                                <div class="modal-stat-controls">
                                    <button onclick="GameScoreView.updateAtBatStat(${index}, 'stolenBases', -1)">−</button>
                                    <span id="editSteals${index}">${atBat.stolenBases || 0}</span>
                                    <button onclick="GameScoreView.updateAtBatStat(${index}, 'stolenBases', 1)">＋</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <button class="btn btn-primary btn-large" onclick="this.closest('.modal-overlay').remove(); App.render();">完了</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },
    
    async updateAtBatResult(index, result) {
        const game = App.currentGame;
        const currentInning = game.innings[game.currentInning - 1];
        const atBat = currentInning.atBats[index];
        const oldResult = atBat.result;
        
        // ヒット数の調整
        if (AtBatResults[oldResult].type === 'hit' && AtBatResults[result].type !== 'hit') {
            currentInning.teamHits = Math.max(0, currentInning.teamHits - 1);
            game.teamTotalHits = Math.max(0, game.teamTotalHits - 1);
        } else if (AtBatResults[oldResult].type !== 'hit' && AtBatResults[result].type === 'hit') {
            currentInning.teamHits++;
            game.teamTotalHits++;
        }
        
        atBat.result = result;
        
        // アウトカウントを再計算
        const totalOuts = currentInning.atBats.reduce((sum, ab) => sum + (AtBatResults[ab.result].outs || 0), 0);
        game.currentOuts = totalOuts % 3;
        
        await this.saveGame();
        
        // ボタンの選択状態を更新（モーダル内）
        document.querySelectorAll('.modal-result-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        event.target.classList.add('selected');
    },
    
    async updateAtBatStat(index, field, amount) {
        const game = App.currentGame;
        const currentInning = game.innings[game.currentInning - 1];
        const atBat = currentInning.atBats[index];
        
        atBat[field] = Math.max(0, (atBat[field] || 0) + amount);
        
        // 打点の場合は得点も更新
        if (field === 'rbi') {
            currentInning.teamRuns = currentInning.atBats.reduce((sum, ab) => sum + (ab.rbi || 0), 0);
            game.teamTotalRuns = game.innings.reduce((sum, inn) => sum + (inn.teamRuns || 0), 0);
        }
        
        await this.saveGame();
        
        // 表示を更新
        const el = document.getElementById(field === 'rbi' ? `editRbi${index}` : `editSteals${index}`);
        if (el) el.textContent = atBat[field];
    },
    
    editAtBat(index) {
        this.showEditAtBatModal(index);
    },
    
    async recordAtBat(resultKey) {
        const game = App.currentGame;
        const result = AtBatResults[resultKey];
        const currentBatter = game.battingOrder[game.currentBatterIndex];
        if (!currentBatter) return;
        
        let currentInning = game.innings[game.currentInning - 1];
        if (!currentInning) {
            currentInning = { number: game.currentInning, teamRuns: 0, teamHits: 0, opponentRuns: 0, opponentHits: 0, atBats: [], isComplete: false };
            game.innings[game.currentInning - 1] = currentInning;
        }
        if (!currentInning.atBats) currentInning.atBats = [];
        
        const rbi = game.pendingRbi || 0;
        const steals = game.pendingSteals || 0;
        
        currentInning.atBats.push({ id: generateId(), playerId: currentBatter.id, playerName: currentBatter.name, result: resultKey, rbi, stolenBases: steals });
        
        if (result.type === 'hit') { currentInning.teamHits++; game.teamTotalHits++; }
        currentInning.teamRuns += rbi;
        game.teamTotalRuns = game.innings.reduce((sum, inn) => sum + (inn.teamRuns || 0), 0);
        
        game.currentOuts += result.outs;
        game.currentBatterIndex = (game.currentBatterIndex + 1) % game.battingOrder.length;
        game.pendingRbi = 0;
        game.pendingSteals = 0;
        
        await this.saveGame();
        App.render();
    },
    
    editAtBat(index) {
        const game = App.currentGame;
        const currentInning = game.innings[game.currentInning - 1];
        const atBat = currentInning.atBats[index];
        if (!atBat) return;
        
        const newResult = prompt('打席結果を入力 (single, double, triple, homeRun, walk, error, sacrifice, out, doublePlay, triplePlay):', atBat.result);
        if (newResult && AtBatResults[newResult]) {
            const oldResult = atBat.result;
            if (AtBatResults[oldResult].type === 'hit' && AtBatResults[newResult].type !== 'hit') {
                currentInning.teamHits = Math.max(0, currentInning.teamHits - 1);
                game.teamTotalHits = Math.max(0, game.teamTotalHits - 1);
            } else if (AtBatResults[oldResult].type !== 'hit' && AtBatResults[newResult].type === 'hit') {
                currentInning.teamHits++;
                game.teamTotalHits++;
            }
            atBat.result = newResult;
        }
        
        const newRbi = prompt('打点:', atBat.rbi);
        if (newRbi !== null) {
            const diff = parseInt(newRbi) - atBat.rbi;
            atBat.rbi = parseInt(newRbi) || 0;
            currentInning.teamRuns += diff;
            game.teamTotalRuns = game.innings.reduce((sum, inn) => sum + (inn.teamRuns || 0), 0);
        }
        
        const newSteals = prompt('盗塁:', atBat.stolenBases);
        if (newSteals !== null) atBat.stolenBases = parseInt(newSteals) || 0;
        
        this.saveGame();
        App.render();
    },
    
    editInning(index) {
        if (index >= (App.currentGame.innings || []).length) return;
        App.currentInningIndex = index;
        App.navigate('inningEdit', { currentTeam: App.currentTeam, currentGame: App.currentGame, currentInningIndex: index });
    },
    
    async adjustOpponentScore(amount) {
        const game = App.currentGame;
        const currentInning = game.innings[game.currentInning - 1];
        if (currentInning) {
            currentInning.opponentRuns = Math.max(0, (currentInning.opponentRuns || 0) + amount);
            game.opponentTotalRuns = game.innings.reduce((sum, inn) => sum + (inn.opponentRuns || 0), 0);
            await this.saveGame();
            App.render();
        }
    },
    
    async adjustOpponentHits(amount) {
        const game = App.currentGame;
        const currentInning = game.innings[game.currentInning - 1];
        if (currentInning) {
            currentInning.opponentHits = Math.max(0, (currentInning.opponentHits || 0) + amount);
            game.opponentTotalHits = game.innings.reduce((sum, inn) => sum + (inn.opponentHits || 0), 0);
            await this.saveGame();
            App.render();
        }
    },
    
    async adjustPitching(field, amount) {
        const game = App.currentGame;
        const record = game.pitchingRecords.find(r => r.playerId === game.currentPitcherId);
        if (!record) return;
        
        if (field === 'inningsPitched') {
            record[field] = addInning(record[field], amount);
        } else {
            record[field] = Math.max(0, (record[field] || 0) + amount);
        }
        await this.saveGame();
        App.render();
    },
    
    showPitcherChange() {
        const team = App.currentTeam;
        const game = App.currentGame;
        const players = sortByJapanese([...(team.players || [])], 'name');
        const existingPitcherIds = game.pitchingRecords.map(r => r.playerId);
        
        let html = '<div style="max-height:300px;overflow-y:auto;">';
        players.forEach(p => {
            const isCurrentPitcher = p.id === game.currentPitcherId;
            const hasRecord = existingPitcherIds.includes(p.id);
            html += `<div class="player-item ${isCurrentPitcher ? 'disabled' : ''}" onclick="${isCurrentPitcher ? '' : `GameScoreView.changePitcher('${p.id}')`}">
                <span class="player-number">#${p.number || '-'}</span>
                <span class="player-name">${p.name}</span>
                ${p.isPitcher ? '<span class="player-position">投手</span>' : ''}
                ${isCurrentPitcher ? '<span style="color:var(--success-color);font-size:0.8rem;">登板中</span>' : ''}
                ${hasRecord && !isCurrentPitcher ? '<span style="color:var(--text-secondary);font-size:0.8rem;">登板済</span>' : ''}
            </div>`;
        });
        html += '</div>';
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `<div class="modal"><div class="modal-header"><span class="modal-title">投手交代</span><button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button></div><div class="modal-body">${html}</div></div>`;
        document.body.appendChild(modal);
    },
    
    async changePitcher(playerId) {
        const game = App.currentGame;
        const team = App.currentTeam;
        const player = team.players.find(p => p.id === playerId);
        if (!player) return;
        
        const existingRecord = game.pitchingRecords.find(r => r.playerId === playerId);
        if (!existingRecord) {
            game.pitchingRecords.push({ playerId: player.id, playerName: player.name, inningsPitched: 0, strikeouts: 0, runsAllowed: 0, earnedRuns: 0, hitsAllowed: 0 });
        }
        game.currentPitcherId = playerId;
        
        document.querySelector('.modal-overlay')?.remove();
        await this.saveGame();
        App.render();
    },
    
    async performChange() {
        const game = App.currentGame;
        const currentInning = game.innings[game.currentInning - 1];
        
        if (currentInning) {
            // 表裏の完了フラグを設定
            if (game.isFirstBatting) {
                // 先攻チームの場合
                if (game.isTeamBatting) {
                    // 自チーム攻撃→守備（表が完了）
                    currentInning.topComplete = true;
                } else {
                    // 自チーム守備→攻撃（裏が完了）
                    currentInning.bottomComplete = true;
                    // 投手の失点を相手得点に反映
                    const totalRunsAllowed = game.pitchingRecords.reduce((sum, r) => sum + r.runsAllowed, 0);
                    currentInning.opponentRuns = totalRunsAllowed - game.innings.slice(0, game.currentInning - 1).reduce((sum, inn) => sum + (inn.opponentRuns || 0), 0);
                }
            } else {
                // 後攻チームの場合
                if (game.isTeamBatting) {
                    // 自チーム攻撃→守備（裏が完了）
                    currentInning.bottomComplete = true;
                    // 投手の失点を相手得点に反映
                    const totalRunsAllowed = game.pitchingRecords.reduce((sum, r) => sum + r.runsAllowed, 0);
                    currentInning.opponentRuns = totalRunsAllowed - game.innings.slice(0, game.currentInning - 1).reduce((sum, inn) => sum + (inn.opponentRuns || 0), 0);
                } else {
                    // 自チーム守備→攻撃（表が完了）
                    currentInning.topComplete = true;
                }
            }
        }
        
        game.teamTotalRuns = game.innings.reduce((sum, inn) => sum + (inn.teamRuns || 0), 0);
        game.teamTotalHits = game.innings.reduce((sum, inn) => sum + (inn.teamHits || 0), 0);
        game.opponentTotalRuns = game.innings.reduce((sum, inn) => sum + (inn.opponentRuns || 0), 0);
        game.opponentTotalHits = game.innings.reduce((sum, inn) => sum + (inn.opponentHits || 0), 0);
        
        game.isTeamBatting = !game.isTeamBatting;
        if (game.isTeamBatting) {
            game.currentInning++;
            game.innings.push({ number: game.currentInning, teamRuns: 0, teamHits: 0, opponentRuns: 0, opponentHits: 0, atBats: [], topComplete: false, bottomComplete: false });
        }
        game.currentOuts = 0;
        
        await this.saveGame();
        App.render();
    },
    
    async endGame() {
        if (confirm('試合を終了しますか？')) {
            const game = App.currentGame;
            game.teamTotalRuns = game.innings.reduce((sum, inn) => sum + (inn.teamRuns || 0), 0);
            game.teamTotalHits = game.innings.reduce((sum, inn) => sum + (inn.teamHits || 0), 0);
            game.opponentTotalRuns = game.innings.reduce((sum, inn) => sum + (inn.opponentRuns || 0), 0);
            game.opponentTotalHits = game.innings.reduce((sum, inn) => sum + (inn.opponentHits || 0), 0);
            game.isFinished = true;
            await this.saveGame();
            App.render();
        }
    },
    
    async resumeGame() {
        const game = App.currentGame;
        game.isFinished = false;
        await this.saveGame();
        App.render();
    },
    
    async saveGame() {
        const team = App.currentTeam;
        const game = App.currentGame;
        const gameIndex = team.games.findIndex(g => g.id === game.id);
        if (gameIndex >= 0) team.games[gameIndex] = game;
        await App.saveTeam(team);
    },
    
    exitGame() {
        App.navigate('gameList', { currentTeam: App.currentTeam, currentYear: getYear(App.currentGame.date) });
    }
};

// ========================================
// イニング編集
// ========================================

const InningEditView = {
    render(team, game, inningIndex) {
        const inning = game.innings[inningIndex];
        if (!inning) return '<div>イニングが見つかりません</div>';
        
        return `
            <div class="header"><div class="header-with-back">
                <button class="back-button" onclick="App.navigate('gameScore', { currentTeam: App.currentTeam, currentGame: App.currentGame })">←</button>
                <h1>${inningIndex + 1}回の編集</h1>
            </div></div>
            
            <div class="card">
                <div class="card-title">${team.name}の攻撃</div>
                <div style="display:flex;gap:20px;justify-content:center;">
                    <div style="text-align:center;">
                        <div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:8px;">得点</div>
                        <div class="counter-control">
                            <button onclick="InningEditView.adjust('teamRuns', -1)">−</button>
                            <span>${inning.teamRuns || 0}</span>
                            <button onclick="InningEditView.adjust('teamRuns', 1)">＋</button>
                        </div>
                    </div>
                    <div style="text-align:center;">
                        <div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:8px;">安打</div>
                        <div class="counter-control">
                            <button onclick="InningEditView.adjust('teamHits', -1)">−</button>
                            <span>${inning.teamHits || 0}</span>
                            <button onclick="InningEditView.adjust('teamHits', 1)">＋</button>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="card">
                <div class="card-title">${game.opponent}の攻撃</div>
                <div style="display:flex;gap:20px;justify-content:center;">
                    <div style="text-align:center;">
                        <div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:8px;">得点</div>
                        <div class="counter-control">
                            <button onclick="InningEditView.adjust('opponentRuns', -1)">−</button>
                            <span>${inning.opponentRuns || 0}</span>
                            <button onclick="InningEditView.adjust('opponentRuns', 1)">＋</button>
                        </div>
                    </div>
                    <div style="text-align:center;">
                        <div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:8px;">被安打</div>
                        <div class="counter-control">
                            <button onclick="InningEditView.adjust('opponentHits', -1)">−</button>
                            <span>${inning.opponentHits || 0}</span>
                            <button onclick="InningEditView.adjust('opponentHits', 1)">＋</button>
                        </div>
                    </div>
                </div>
            </div>
            
            ${(inning.atBats || []).length > 0 ? `
                <div class="card">
                    <div class="card-title">打席結果</div>
                    ${inning.atBats.map((ab, idx) => `
                        <div class="at-bat-item" onclick="InningEditView.editAtBat(${idx})">
                            <span class="at-bat-player">${ab.playerName}</span>
                            <span class="at-bat-result ${AtBatResults[ab.result]?.type || 'out'}">${AtBatResults[ab.result]?.icon || ab.result}</span>
                            <div class="at-bat-stats">
                                ${ab.rbi > 0 ? `<span class="stat-badge rbi">打点${ab.rbi}</span>` : ''}
                                ${ab.stolenBases > 0 ? `<span class="stat-badge steal">盗${ab.stolenBases}</span>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
            
            <div class="p-12">
                <button class="btn btn-primary" onclick="App.navigate('gameScore', { currentTeam: App.currentTeam, currentGame: App.currentGame })">完了</button>
            </div>
        `;
    },
    
    async adjust(field, amount) {
        const game = App.currentGame;
        const inning = game.innings[App.currentInningIndex];
        inning[field] = Math.max(0, (inning[field] || 0) + amount);
        
        game.teamTotalRuns = game.innings.reduce((sum, inn) => sum + (inn.teamRuns || 0), 0);
        game.teamTotalHits = game.innings.reduce((sum, inn) => sum + (inn.teamHits || 0), 0);
        game.opponentTotalRuns = game.innings.reduce((sum, inn) => sum + (inn.opponentRuns || 0), 0);
        game.opponentTotalHits = game.innings.reduce((sum, inn) => sum + (inn.opponentHits || 0), 0);
        
        const team = App.currentTeam;
        const gameIndex = team.games.findIndex(g => g.id === game.id);
        if (gameIndex >= 0) team.games[gameIndex] = game;
        await App.saveTeam(team);
        App.render();
    },
    
    editAtBat(index) {
        const game = App.currentGame;
        const inning = game.innings[App.currentInningIndex];
        const atBat = inning.atBats[index];
        if (!atBat) return;
        
        const newResult = prompt('打席結果 (single, double, triple, homeRun, walk, error, sacrifice, out, doublePlay, triplePlay):', atBat.result);
        if (newResult && AtBatResults[newResult]) atBat.result = newResult;
        
        const newRbi = prompt('打点:', atBat.rbi);
        if (newRbi !== null) atBat.rbi = parseInt(newRbi) || 0;
        
        const newSteals = prompt('盗塁:', atBat.stolenBases);
        if (newSteals !== null) atBat.stolenBases = parseInt(newSteals) || 0;
        
        inning.teamRuns = inning.atBats.reduce((sum, ab) => sum + (ab.rbi || 0), 0);
        game.teamTotalRuns = game.innings.reduce((sum, inn) => sum + (inn.teamRuns || 0), 0);
        
        const team = App.currentTeam;
        const gameIndex = team.games.findIndex(g => g.id === game.id);
        if (gameIndex >= 0) team.games[gameIndex] = game;
        App.saveTeam(team);
        App.render();
    }
};

// ========================================
// アプリ起動
// ========================================

document.addEventListener('DOMContentLoaded', () => { App.init(); });

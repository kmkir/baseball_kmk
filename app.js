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
    const stats = { games: 0, atBats: 0, hits: 0, walks: 0, homeRuns: 0, singles: 0, doubles: 0, triples: 0, rbis: 0, stolenBases: 0 };
    (team.games || []).forEach(game => {
        let hasAtBat = false;
        (game.innings || []).forEach(inning => {
            (inning.atBats || []).forEach(ab => {
                if (ab.playerId === playerId) {
                    hasAtBat = true;
                    stats.atBats++;
                    stats.rbis += ab.rbi || 0;
                    stats.stolenBases += ab.stolenBases || 0;
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
        if (hasAtBat) stats.games++;
    });
    const avg = stats.atBats > 0 ? (stats.hits / stats.atBats) : 0;
    const obp = (stats.atBats + stats.walks) > 0 ? ((stats.hits + stats.walks) / (stats.atBats + stats.walks)) : 0;
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
        return `
            <div class="stats-cards-container">
                ${players.map(player => {
                    const stats = calculatePlayerBattingStats(team, player.id);
                    return `
                        <div class="stats-card-item" onclick="App.navigate('playerDetail', { currentTeam: App.currentTeam, currentPlayer: App.currentTeam.players.find(p => p.id === '${player.id}') })">
                            <div class="stats-card-header">
                                <span class="stats-card-number">#${player.number || '-'}</span>
                                <span class="stats-card-name">${player.name}</span>
                            </div>
                            <div class="stats-card-grid">
                                <div class="stats-card-stat">
                                    <div class="stats-card-value">${stats.avg}</div>
                                    <div class="stats-card-label">打率</div>
                                </div>
                                <div class="stats-card-stat">
                                    <div class="stats-card-value">${stats.obp}</div>
                                    <div class="stats-card-label">出塁率</div>
                                </div>
                                <div class="stats-card-stat">
                                    <div class="stats-card-value">${stats.ops}</div>
                                    <div class="stats-card-label">OPS</div>
                                </div>
                                <div class="stats-card-stat">
                                    <div class="stats-card-value">${stats.hits}</div>
                                    <div class="stats-card-label">安打</div>
                                </div>
                                <div class="stats-card-stat">
                                    <div class="stats-card-value">${stats.homeRuns}</div>
                                    <div class="stats-card-label">HR</div>
                                </div>
                                <div class="stats-card-stat">
                                    <div class="stats-card-value">${stats.rbis}</div>
                                    <div class="stats-card-label">打点</div>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },
    
    renderPitchingStats(team, players) {
        return `
            <div class="stats-cards-container">
                ${players.map(player => {
                    const stats = calculatePlayerPitchingStats(team, player.id);
                    return `
                        <div class="stats-card-item" onclick="App.navigate('playerDetail', { currentTeam: App.currentTeam, currentPlayer: App.currentTeam.players.find(p => p.id === '${player.id}') })">
                            <div class="stats-card-header">
                                <span class="stats-card-number">#${player.number || '-'}</span>
                                <span class="stats-card-name">${player.name}</span>
                                ${!player.isPitcher ? '<span class="badge-small">野手</span>' : ''}
                            </div>
                            <div class="stats-card-grid">
                                <div class="stats-card-stat highlight">
                                    <div class="stats-card-value">${stats.era}</div>
                                    <div class="stats-card-label">防御率</div>
                                </div>
                                <div class="stats-card-stat">
                                    <div class="stats-card-value">${stats.appearances}</div>
                                    <div class="stats-card-label">登板</div>
                                </div>
                                <div class="stats-card-stat">
                                    <div class="stats-card-value">${stats.inningsPitchedDisplay}</div>
                                    <div class="stats-card-label">投球回</div>
                                </div>
                                <div class="stats-card-stat">
                                    <div class="stats-card-value">${stats.strikeouts}</div>
                                    <div class="stats-card-label">奪三振</div>
                                </div>
                                <div class="stats-card-stat">
                                    <div class="stats-card-value">${stats.runsAllowed}</div>
                                    <div class="stats-card-label">失点</div>
                                </div>
                                <div class="stats-card-stat">
                                    <div class="stats-card-value">${stats.earnedRuns}</div>
                                    <div class="stats-card-label">自責点</div>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
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
                <div class="stats-grid-detail">
                    <div class="stat-box"><div class="stat-box-value">${battingStats.avg}</div><div class="stat-box-label">打率</div></div>
                    <div class="stat-box"><div class="stat-box-value">${battingStats.obp}</div><div class="stat-box-label">出塁率</div></div>
                    <div class="stat-box"><div class="stat-box-value">${battingStats.ops}</div><div class="stat-box-label">OPS</div></div>
                    <div class="stat-box"><div class="stat-box-value">${battingStats.atBats}</div><div class="stat-box-label">打席</div></div>
                    <div class="stat-box"><div class="stat-box-value">${battingStats.hits}</div><div class="stat-box-label">安打</div></div>
                    <div class="stat-box"><div class="stat-box-value">${battingStats.homeRuns}</div><div class="stat-box-label">HR</div></div>
                    <div class="stat-box"><div class="stat-box-value">${battingStats.rbis}</div><div class="stat-box-label">打点</div></div>
                    <div class="stat-box"><div class="stat-box-value">${battingStats.stolenBases}</div><div class="stat-box-label">盗塁</div></div>
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
    
    reset() {
        this.battingOrder = [];
        this.selectedPitcher = null;
        this.isFirstBatting = true;
        this.step = 1;
        this.gameData = {};
    },
    
    render(team) {
        const today = new Date().toISOString().slice(0, 10);
        return `
            <div class="header"><div class="header-with-back">
                <button class="back-button" onclick="GameSetupView.goBack()">←</button>
                <h1>試合を登録</h1>
            </div></div>
            <div style="display:flex;padding:10px 12px;gap:4px;">
                ${[1,2,3,4].map(s => `<div style="flex:1;height:4px;border-radius:2px;background:${this.step >= s ? 'var(--primary-color)' : '#e5e7eb'};"></div>`).join('')}
            </div>
            ${this.step === 1 ? this.renderStep1(team, today) : ''}
            ${this.step === 2 ? this.renderStep2(team) : ''}
            ${this.step === 3 ? this.renderStep3(team) : ''}
            ${this.step === 4 ? this.renderStep4(team) : ''}
        `;
    },
    
    renderStep1(team, today) {
        const locations = team.locations || [];
        const opponents = team.opponents || [];
        const tournaments = team.tournaments || [];
        const showTournament = this.gameData.gameType === '公式戦';
        
        return `
            <div class="card">
                <div class="card-title">試合情報</div>
                <div class="form-group"><label class="form-label">日付</label><input type="date" id="gameDate" class="form-input" value="${this.gameData.date || today}"></div>
                <div class="form-group">
                    <label class="form-label">種別</label>
                    <select id="gameType" class="form-select" onchange="GameSetupView.onGameTypeChange()">
                        <option value="練習試合" ${this.gameData.gameType !== '公式戦' ? 'selected' : ''}>練習試合</option>
                        <option value="公式戦" ${this.gameData.gameType === '公式戦' ? 'selected' : ''}>公式戦</option>
                    </select>
                </div>
                <div id="tournamentFields" style="${showTournament ? '' : 'display:none;'}">
                    <div class="form-group">
                        <label class="form-label">大会名</label>
                        <input type="text" id="tournament" class="form-input" placeholder="大会名を入力" value="${this.gameData.tournament || ''}">
                        ${tournaments.length > 0 ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">${tournaments.slice(0, 5).map(t => `<button type="button" class="btn btn-small btn-outline" onclick="document.getElementById('tournament').value='${t}'" style="width:auto;">${t}</button>`).join('')}</div>` : ''}
                    </div>
                    <div class="form-group">
                        <label class="form-label">回戦</label>
                        <select id="round" class="form-select">
                            <option value="">選択してください</option>
                            <option value="1回戦" ${this.gameData.round === '1回戦' ? 'selected' : ''}>1回戦</option>
                            <option value="2回戦" ${this.gameData.round === '2回戦' ? 'selected' : ''}>2回戦</option>
                            <option value="3回戦" ${this.gameData.round === '3回戦' ? 'selected' : ''}>3回戦</option>
                            <option value="準々決勝" ${this.gameData.round === '準々決勝' ? 'selected' : ''}>準々決勝</option>
                            <option value="準決勝" ${this.gameData.round === '準決勝' ? 'selected' : ''}>準決勝</option>
                            <option value="決勝" ${this.gameData.round === '決勝' ? 'selected' : ''}>決勝</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">場所</label>
                    <input type="text" id="location" class="form-input" placeholder="場所を入力" value="${this.gameData.location || ''}">
                    ${locations.length > 0 ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">${locations.slice(0, 5).map(loc => `<button type="button" class="btn btn-small btn-outline" onclick="document.getElementById('location').value='${loc}'" style="width:auto;">${loc}</button>`).join('')}</div>` : ''}
                </div>
                <div class="form-group">
                    <label class="form-label">対戦相手</label>
                    <input type="text" id="opponent" class="form-input" placeholder="対戦相手を入力" value="${this.gameData.opponent || ''}">
                    ${opponents.length > 0 ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">${opponents.slice(0, 5).map(opp => `<button type="button" class="btn btn-small btn-outline" onclick="document.getElementById('opponent').value='${opp}'" style="width:auto;">${opp}</button>`).join('')}</div>` : ''}
                </div>
                <div class="form-group">
                    <label class="form-label">先攻・後攻</label>
                    <div class="batting-order-toggle">
                        <button type="button" class="toggle-btn ${this.isFirstBatting ? 'active' : ''}" onclick="GameSetupView.setFirstBatting(true)">先攻</button>
                        <button type="button" class="toggle-btn ${!this.isFirstBatting ? 'active' : ''}" onclick="GameSetupView.setFirstBatting(false)">後攻</button>
                    </div>
                </div>
            </div>
            <div class="p-12"><button class="btn btn-primary btn-large" onclick="GameSetupView.nextStep()">次へ：打順設定 →</button></div>
        `;
    },
    
    renderStep2(team) {
        const players = sortByJapanese([...(team.players || [])], 'name');
        const availablePlayers = players.filter(p => !this.battingOrder.find(b => b.id === p.id));
        const isFull = this.battingOrder.length >= 9;
        return `
            <div class="card">
                <div class="card-title">打順を設定（最大9人）</div>
                <div class="batting-order-counter ${isFull ? 'full' : ''}">${this.battingOrder.length}/9人</div>
                ${this.battingOrder.length === 0 ? `<div style="text-align:center;color:var(--text-secondary);padding:20px;">選手を追加してください</div>` : `
                    <div class="batting-order-list">
                        ${this.battingOrder.map((player, index) => `
                            <div class="batting-order-item-new">
                                <div class="batting-order-num">${index + 1}</div>
                                <div class="batting-order-player">
                                    <span class="batting-order-player-number">#${player.number || '-'}</span>
                                    <span class="batting-order-player-name">${player.name}</span>
                                </div>
                                <button class="batting-order-remove-btn" onclick="GameSetupView.removeFromOrder(${index})">✕</button>
                            </div>
                        `).join('')}
                    </div>
                `}
            </div>
            ${!isFull && availablePlayers.length > 0 ? `
                <div class="card">
                    <div class="card-title">選手を追加</div>
                    <div class="player-select-grid">${availablePlayers.map(player => `
                        <div class="player-select-item" onclick="GameSetupView.addToOrder('${player.id}')">
                            <span class="player-select-number">#${player.number || '-'}</span>
                            <span class="player-select-name">${player.name}</span>
                        </div>
                    `).join('')}</div>
                </div>
            ` : ''}
            <div class="p-12" style="display:flex;gap:10px;">
                <button class="btn btn-secondary btn-large" onclick="GameSetupView.prevStep()" style="flex:1;">← 戻る</button>
                <button class="btn btn-primary btn-large" onclick="GameSetupView.nextStep()" style="flex:2;" ${this.battingOrder.length === 0 ? 'disabled' : ''}>次へ：投手選択 →</button>
            </div>
        `;
    },
    
    renderStep3(team) {
        const players = sortByJapanese([...(team.players || [])], 'name');
        const pitchers = players.filter(p => p.isPitcher);
        const others = players.filter(p => !p.isPitcher);
        
        return `
            <div class="card">
                <div class="card-title">先発投手を選択</div>
                ${this.selectedPitcher ? `
                    <div class="selected-pitcher-display">
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
            <div class="p-12" style="display:flex;gap:10px;">
                <button class="btn btn-secondary btn-large" onclick="GameSetupView.prevStep()" style="flex:1;">← 戻る</button>
                <button class="btn btn-primary btn-large" onclick="GameSetupView.nextStep()" style="flex:2;" ${!this.selectedPitcher ? 'disabled' : ''}>次へ：確認 →</button>
            </div>
        `;
    },
    
    renderStep4(team) {
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
    
    setFirstBatting(isFirst) { 
        // 現在の入力値を保存
        this.saveCurrentInputs();
        this.isFirstBatting = isFirst; 
        App.render(); 
    },
    
    saveCurrentInputs() {
        const dateEl = document.getElementById('gameDate');
        const gameTypeEl = document.getElementById('gameType');
        const locationEl = document.getElementById('location');
        const opponentEl = document.getElementById('opponent');
        const tournamentEl = document.getElementById('tournament');
        const roundEl = document.getElementById('round');
        
        if (dateEl) this.gameData.date = dateEl.value;
        if (gameTypeEl) this.gameData.gameType = gameTypeEl.value;
        if (locationEl) this.gameData.location = locationEl.value;
        if (opponentEl) this.gameData.opponent = opponentEl.value;
        if (tournamentEl) this.gameData.tournament = tournamentEl.value;
        if (roundEl) this.gameData.round = roundEl.value;
    },
    
    goBack() {
        if (this.step > 1) { this.prevStep(); }
        else { this.reset(); App.navigate('yearList', { currentTeam: App.currentTeam }); }
    },
    
    nextStep() {
        if (this.step === 1) {
            const date = document.getElementById('gameDate').value;
            const gameType = document.getElementById('gameType').value;
            const location = document.getElementById('location').value.trim();
            const opponent = document.getElementById('opponent').value.trim();
            const tournament = document.getElementById('tournament')?.value.trim() || '';
            const round = document.getElementById('round')?.value || '';
            if (!date || !location || !opponent) { alert('日付・場所・対戦相手を入力してください'); return; }
            this.gameData = { date, gameType, location, opponent, tournament, round };
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
            battingOrder: this.battingOrder.map(p => ({ id: p.id, name: p.name, number: p.number })),
            currentPitcherId: this.selectedPitcher.id,
            pitchingRecords: [{ playerId: this.selectedPitcher.id, playerName: this.selectedPitcher.name, inningsPitched: 0, strikeouts: 0, runsAllowed: 0, earnedRuns: 0, hitsAllowed: 0 }],
            innings: [{ number: 1, teamRuns: 0, teamHits: 0, opponentRuns: 0, opponentHits: 0, atBats: [], isComplete: false }],
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
        const getTopScore = (inn) => game.isFirstBatting ? inn.teamRuns : inn.opponentRuns;
        const getBottomScore = (inn) => game.isFirstBatting ? inn.opponentRuns : inn.teamRuns;
        const topTotalRuns = game.isFirstBatting ? game.teamTotalRuns : game.opponentTotalRuns;
        const bottomTotalRuns = game.isFirstBatting ? game.opponentTotalRuns : game.teamTotalRuns;
        const topTotalHits = game.isFirstBatting ? game.teamTotalHits : game.opponentTotalHits;
        const bottomTotalHits = game.isFirstBatting ? game.opponentTotalHits : game.teamTotalHits;
        
        return `
            <div class="scoreboard">
                <table class="scoreboard-table">
                    <thead><tr><th class="team-name"></th>${[...Array(maxInnings)].map((_, i) => `<th class="inning-cell" onclick="GameScoreView.editInning(${i})">${i + 1}</th>`).join('')}<th class="total">計</th><th class="hits">H</th></tr></thead>
                    <tbody>
                        <tr class="team-row"><td class="team-name">${topTeam}</td>${[...Array(maxInnings)].map((_, i) => { const inn = innings[i]; const score = inn ? getTopScore(inn) : null; return `<td class="score-cell ${score !== null ? 'has-score' : ''}" onclick="GameScoreView.editInning(${i})">${score !== null ? score : '-'}</td>`; }).join('')}<td class="total">${topTotalRuns || 0}</td><td class="hits">${topTotalHits || 0}</td></tr>
                        <tr class="team-row"><td class="team-name">${bottomTeam}</td>${[...Array(maxInnings)].map((_, i) => { const inn = innings[i]; const score = inn ? getBottomScore(inn) : null; return `<td class="score-cell ${score !== null ? 'has-score' : ''}" onclick="GameScoreView.editInning(${i})">${score !== null ? score : '-'}</td>`; }).join('')}<td class="total">${bottomTotalRuns || 0}</td><td class="hits">${bottomTotalHits || 0}</td></tr>
                    </tbody>
                </table>
                <div style="font-size:0.7rem;text-align:center;color:#9ca3af;margin-top:5px;">スコアをタップで編集</div>
            </div>
        `;
    },
    
    renderBattingInput(team, game) {
        const currentInning = game.innings[game.currentInning - 1] || { atBats: [] };
        const currentBatter = game.battingOrder[game.currentBatterIndex];
        const pendingRbi = game.pendingRbi || 0;
        const pendingSteals = game.pendingSteals || 0;
        
        return `
            <div class="inning-status-bar">
                <div class="inning-number">${game.currentInning}回</div>
                <div class="inning-phase attack">攻撃中</div>
                <div class="out-indicators">
                    ${[0,1,2].map(i => `<div class="out-indicator ${i < game.currentOuts ? 'active' : ''}"></div>`).join('')}
                    <span class="out-text">OUT</span>
                </div>
            </div>
            
            ${(currentInning.atBats || []).length > 0 ? `
                <div class="at-bat-history">
                    <div class="at-bat-history-title">このイニングの打席（タップで編集）</div>
                    <div class="at-bat-history-list">
                        ${(currentInning.atBats || []).map((ab, idx) => `
                            <div class="at-bat-history-item" onclick="GameScoreView.showEditAtBatModal(${idx})">
                                <span class="at-bat-history-name">${ab.playerName}</span>
                                <span class="at-bat-history-result ${AtBatResults[ab.result].type}">${AtBatResults[ab.result].icon}</span>
                                ${ab.rbi > 0 ? `<span class="at-bat-history-badge rbi">${ab.rbi}打点</span>` : ''}
                                ${ab.stolenBases > 0 ? `<span class="at-bat-history-badge steal">${ab.stolenBases}盗</span>` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            
            <div class="current-batter-box">
                <div class="current-batter-label">現在の打者</div>
                <div class="current-batter-info">
                    <span class="current-batter-order">${game.currentBatterIndex + 1}番</span>
                    <span class="current-batter-name">${currentBatter ? currentBatter.name : '---'}</span>
                </div>
            </div>
            
            <div class="batting-input-section">
                <div class="batting-buttons-grid">
                    <button class="batting-btn-large hit" onclick="GameScoreView.recordAtBat('single')">ヒット</button>
                    <button class="batting-btn-large hit" onclick="GameScoreView.recordAtBat('double')">2塁打</button>
                    <button class="batting-btn-large hit" onclick="GameScoreView.recordAtBat('triple')">3塁打</button>
                    <button class="batting-btn-large hit" onclick="GameScoreView.recordAtBat('homeRun')">HR</button>
                    <button class="batting-btn-large walk" onclick="GameScoreView.recordAtBat('walk')">四死球</button>
                    <button class="batting-btn-large walk" onclick="GameScoreView.recordAtBat('error')">エラー</button>
                    <button class="batting-btn-large sacrifice" onclick="GameScoreView.recordAtBat('sacrifice')">犠牲</button>
                    <button class="batting-btn-large out" onclick="GameScoreView.recordAtBat('out')">アウト</button>
                    <button class="batting-btn-large out" onclick="GameScoreView.recordAtBat('doublePlay')">併殺</button>
                    <button class="batting-btn-large out" onclick="GameScoreView.recordAtBat('triplePlay')">三殺</button>
                </div>
                
                <div class="stats-input-row">
                    <div class="stats-input-item">
                        <span class="stats-input-label">打点</span>
                        <div class="stats-input-controls">
                            <button class="stats-input-btn minus" onclick="GameScoreView.adjustPending('rbi', -1)">−</button>
                            <span class="stats-input-value">${pendingRbi}</span>
                            <button class="stats-input-btn plus" onclick="GameScoreView.adjustPending('rbi', 1)">＋</button>
                        </div>
                    </div>
                    <div class="stats-input-item">
                        <span class="stats-input-label">盗塁</span>
                        <div class="stats-input-controls">
                            <button class="stats-input-btn minus" onclick="GameScoreView.adjustPending('steals', -1)">−</button>
                            <span class="stats-input-value">${pendingSteals}</span>
                            <button class="stats-input-btn plus" onclick="GameScoreView.adjustPending('steals', 1)">＋</button>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="game-action-buttons">
                <button class="change-btn-large" onclick="GameScoreView.performChange()">チェンジ</button>
                <button class="end-game-btn" onclick="GameScoreView.endGame()">試合終了</button>
            </div>
        `;
    },
    
    renderDefenseInput(team, game) {
        const currentInning = game.innings[game.currentInning - 1] || { opponentRuns: 0, opponentHits: 0 };
        const currentPitcher = game.pitchingRecords.find(r => r.playerId === game.currentPitcherId) || game.pitchingRecords[0];
        
        return `
            <div class="inning-status-bar">
                <div class="inning-number">${game.currentInning}回</div>
                <div class="inning-phase defense">守備中</div>
            </div>
            
            <div class="defense-input-section">
                <div class="defense-card">
                    <div class="defense-card-title">相手チームの攻撃</div>
                    <div class="defense-stats-row">
                        <div class="defense-stat-item">
                            <div class="defense-stat-label">得点</div>
                            <div class="defense-stat-controls">
                                <button class="stats-input-btn minus large" onclick="GameScoreView.adjustOpponentScore(-1)">−</button>
                                <span class="defense-stat-value">${currentInning.opponentRuns || 0}</span>
                                <button class="stats-input-btn plus large" onclick="GameScoreView.adjustOpponentScore(1)">＋</button>
                            </div>
                        </div>
                        <div class="defense-stat-item">
                            <div class="defense-stat-label">被安打</div>
                            <div class="defense-stat-controls">
                                <button class="stats-input-btn minus large" onclick="GameScoreView.adjustOpponentHits(-1)">−</button>
                                <span class="defense-stat-value">${currentInning.opponentHits || 0}</span>
                                <button class="stats-input-btn plus large" onclick="GameScoreView.adjustOpponentHits(1)">＋</button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="defense-card">
                    <div class="defense-card-header">
                        <div class="defense-card-title">投手: ${currentPitcher.playerName}</div>
                        <button class="pitcher-change-btn" onclick="GameScoreView.showPitcherChange()">投手交代</button>
                    </div>
                    <div class="pitching-stats-row">
                        <div class="pitching-stat-item">
                            <div class="pitching-stat-label">投球回</div>
                            <div class="pitching-stat-controls">
                                <button class="stats-input-btn minus" onclick="GameScoreView.adjustPitching('inningsPitched', -1)">−</button>
                                <span class="pitching-stat-value">${formatInnings(currentPitcher.inningsPitched)}</span>
                                <button class="stats-input-btn plus" onclick="GameScoreView.adjustPitching('inningsPitched', 1)">＋</button>
                            </div>
                        </div>
                        <div class="pitching-stat-item">
                            <div class="pitching-stat-label">三振</div>
                            <div class="pitching-stat-controls">
                                <button class="stats-input-btn minus" onclick="GameScoreView.adjustPitching('strikeouts', -1)">−</button>
                                <span class="pitching-stat-value">${currentPitcher.strikeouts}</span>
                                <button class="stats-input-btn plus" onclick="GameScoreView.adjustPitching('strikeouts', 1)">＋</button>
                            </div>
                        </div>
                        <div class="pitching-stat-item">
                            <div class="pitching-stat-label">失点</div>
                            <div class="pitching-stat-controls">
                                <button class="stats-input-btn minus" onclick="GameScoreView.adjustPitching('runsAllowed', -1)">−</button>
                                <span class="pitching-stat-value">${currentPitcher.runsAllowed}</span>
                                <button class="stats-input-btn plus" onclick="GameScoreView.adjustPitching('runsAllowed', 1)">＋</button>
                            </div>
                        </div>
                        <div class="pitching-stat-item">
                            <div class="pitching-stat-label">自責点</div>
                            <div class="pitching-stat-controls">
                                <button class="stats-input-btn minus" onclick="GameScoreView.adjustPitching('earnedRuns', -1)">−</button>
                                <span class="pitching-stat-value">${currentPitcher.earnedRuns}</span>
                                <button class="stats-input-btn plus" onclick="GameScoreView.adjustPitching('earnedRuns', 1)">＋</button>
                            </div>
                        </div>
                    </div>
                </div>
                
                ${game.pitchingRecords.length > 1 ? `
                    <div class="defense-card">
                        <div class="defense-card-title">登板投手一覧</div>
                        <div class="pitcher-list">
                            ${game.pitchingRecords.map(r => `
                                <div class="pitcher-list-item ${r.playerId === game.currentPitcherId ? 'current' : ''}">
                                    <span class="pitcher-list-name">${r.playerName}</span>
                                    <span class="pitcher-list-stats">${formatInnings(r.inningsPitched)}回 ${r.strikeouts}K ${r.earnedRuns}自責</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
            
            <div class="game-action-buttons">
                <button class="change-btn-large" onclick="GameScoreView.performChange()">チェンジ</button>
                <button class="end-game-btn" onclick="GameScoreView.endGame()">試合終了</button>
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
        await this.saveGame();
        
        // ボタンの選択状態を更新
        document.querySelectorAll('.modal-result-btn').forEach(btn => btn.classList.remove('selected'));
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
        if (currentInning) currentInning.isComplete = game.isTeamBatting ? false : true;
        
        game.teamTotalRuns = game.innings.reduce((sum, inn) => sum + (inn.teamRuns || 0), 0);
        game.teamTotalHits = game.innings.reduce((sum, inn) => sum + (inn.teamHits || 0), 0);
        game.opponentTotalRuns = game.innings.reduce((sum, inn) => sum + (inn.opponentRuns || 0), 0);
        game.opponentTotalHits = game.innings.reduce((sum, inn) => sum + (inn.opponentHits || 0), 0);
        
        game.isTeamBatting = !game.isTeamBatting;
        if (game.isTeamBatting) {
            game.currentInning++;
            game.innings.push({ number: game.currentInning, teamRuns: 0, teamHits: 0, opponentRuns: 0, opponentHits: 0, atBats: [], isComplete: false });
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

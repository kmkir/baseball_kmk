// ========================================
// Firebase 設定ファイル
// ========================================
// 
// 【重要】以下の設定を自分のFirebaseプロジェクトの値に置き換えてください
// 設定方法は FIREBASE_SETUP.md を参照してください
//

const firebaseConfig = {
  apiKey: "AIzaSyB5tPPaSdLXoJ9_v5AOZl0IP8OisgWt-_c",
  authDomain: "baseball-score-app-kmk.firebaseapp.com",
  projectId: "baseball-score-app-kmk",
  storageBucket: "baseball-score-app-kmk.firebasestorage.app",
  messagingSenderId: "852482098028",
  appId: "1:852482098028:web:4acbf8e6b3301efcc8a949",
  measurementId: "G-39FQP0PPD9"
};

// Firebase初期化
let db = null;
let storage = null;
let firebaseEnabled = false;

try {
    // 設定が有効かチェック
    if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        storage = firebase.storage();
        firebaseEnabled = true;
        
        // オフライン永続化を有効化
        db.enablePersistence({ synchronizeTabs: true })
            .catch((err) => {
                if (err.code === 'failed-precondition') {
                    console.log('複数タブでの永続化は無効');
                } else if (err.code === 'unimplemented') {
                    console.log('このブラウザは永続化非対応');
                }
            });
        
        console.log('Firebase initialized successfully');
    } else {
        console.log('Firebase not configured - using local storage only');
    }
} catch (error) {
    console.error('Firebase initialization error:', error);
}

// ========================================
// データベース操作クラス
// ========================================

const Database = {
    // チーム一覧を取得
    async getTeams() {
        if (firebaseEnabled) {
            try {
                const snapshot = await db.collection('teams').get();
                return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } catch (error) {
                console.error('Error getting teams:', error);
                return this.getTeamsLocal();
            }
        }
        return this.getTeamsLocal();
    },
    
    getTeamsLocal() {
        const data = localStorage.getItem('teams');
        return data ? JSON.parse(data) : [];
    },
    
    // チームを保存
    async saveTeam(team) {
        // ローカルにも保存
        const teams = this.getTeamsLocal();
        const index = teams.findIndex(t => t.id === team.id);
        if (index >= 0) {
            teams[index] = team;
        } else {
            teams.push(team);
        }
        localStorage.setItem('teams', JSON.stringify(teams));
        
        // Firebaseにも保存
        if (firebaseEnabled) {
            try {
                await db.collection('teams').doc(team.id).set(team);
            } catch (error) {
                console.error('Error saving team to Firebase:', error);
            }
        }
    },
    
    // チームを削除
    async deleteTeam(teamId) {
        // ローカルから削除
        const teams = this.getTeamsLocal().filter(t => t.id !== teamId);
        localStorage.setItem('teams', JSON.stringify(teams));
        
        // Firebaseからも削除
        if (firebaseEnabled) {
            try {
                await db.collection('teams').doc(teamId).delete();
            } catch (error) {
                console.error('Error deleting team from Firebase:', error);
            }
        }
    },
    
    // 画像をアップロード
    async uploadImage(file, path) {
        if (!firebaseEnabled || !storage) {
            // ローカルストレージにBase64で保存
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        }
        
        try {
            const ref = storage.ref(path);
            await ref.put(file);
            return await ref.getDownloadURL();
        } catch (error) {
            console.error('Error uploading image:', error);
            // フォールバック: Base64として返す
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        }
    },
    
    // リアルタイム同期を開始
    startRealtimeSync(callback) {
        if (firebaseEnabled) {
            return db.collection('teams').onSnapshot((snapshot) => {
                const teams = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                // ローカルも更新
                localStorage.setItem('teams', JSON.stringify(teams));
                callback(teams);
            }, (error) => {
                console.error('Realtime sync error:', error);
            });
        }
        return null;
    }
};

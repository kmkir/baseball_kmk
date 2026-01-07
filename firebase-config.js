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
let firebaseEnabled = false;

try {
    if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        firebaseEnabled = true;
        
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
// 画像圧縮・リサイズユーティリティ
// ========================================

async function compressImage(file, maxWidth = 400, maxHeight = 225, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                let width = img.width;
                let height = img.height;
                
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
                if (height > maxHeight) {
                    width = (width * maxHeight) / height;
                    height = maxHeight;
                }
                
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                const base64 = canvas.toDataURL('image/jpeg', quality);
                resolve(base64);
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ========================================
// データベース操作クラス
// ========================================

const Database = {
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
    
    async saveTeam(team) {
        const teams = this.getTeamsLocal();
        const index = teams.findIndex(t => t.id === team.id);
        if (index >= 0) {
            teams[index] = team;
        } else {
            teams.push(team);
        }
        localStorage.setItem('teams', JSON.stringify(teams));
        
        if (firebaseEnabled) {
            try {
                await db.collection('teams').doc(team.id).set(team);
            } catch (error) {
                console.error('Error saving team to Firebase:', error);
            }
        }
    },
    
    async deleteTeam(teamId) {
        const teams = this.getTeamsLocal().filter(t => t.id !== teamId);
        localStorage.setItem('teams', JSON.stringify(teams));
        
        if (firebaseEnabled) {
            try {
                await db.collection('teams').doc(teamId).delete();
            } catch (error) {
                console.error('Error deleting team from Firebase:', error);
            }
        }
    },
    
    async uploadImage(file, path) {
        try {
            const base64 = await compressImage(file, 400, 225, 0.7);
            return base64;
        } catch (error) {
            console.error('Error compressing image:', error);
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        }
    },
    
    startRealtimeSync(callback) {
        if (firebaseEnabled) {
            return db.collection('teams').onSnapshot((snapshot) => {
                const teams = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                localStorage.setItem('teams', JSON.stringify(teams));
                callback(teams);
            }, (error) => {
                console.error('Realtime sync error:', error);
            });
        }
        return null;
    }
};

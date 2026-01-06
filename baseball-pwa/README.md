# 野球スコア管理 PWA - セットアップガイド

## 📱 PWAとは？

Progressive Web App（PWA）は、ウェブサイトをアプリのように使える技術です。

**メリット:**
- ✅ 無料で公開できる
- ✅ iOS/Android両方で動く
- ✅ App Storeの審査不要
- ✅ ホーム画面に追加できる
- ✅ オフラインでも動作

---

## 🚀 公開方法

### 方法1: GitHub Pages（無料・おすすめ）

1. **GitHubアカウント作成**
   - https://github.com にアクセス
   - Sign up でアカウント作成

2. **リポジトリ作成**
   - 「New repository」をクリック
   - Repository name: `baseball-score`（任意）
   - Public を選択
   - 「Create repository」

3. **ファイルをアップロード**
   - 「uploading an existing file」をクリック
   - 以下のファイルをドラッグ＆ドロップ:
     - `index.html`
     - `styles.css`
     - `app.js`
     - `manifest.json`
     - `sw.js`
     - `icon-192.png`（後で作成）
     - `icon-512.png`（後で作成）
   - 「Commit changes」

4. **GitHub Pages を有効化**
   - リポジトリの「Settings」タブ
   - 左メニュー「Pages」
   - Source: 「Deploy from a branch」
   - Branch: 「main」→「/ (root)」
   - 「Save」

5. **完了！**
   - 数分後、以下のURLでアクセス可能:
   - `https://あなたのユーザー名.github.io/baseball-score/`

---

### 方法2: Netlify（無料・簡単）

1. https://netlify.com にアクセス
2. Sign up（GitHubアカウントでログイン可）
3. 「Add new site」→「Deploy manually」
4. フォルダごとドラッグ＆ドロップ
5. 即座に公開される

---

### 方法3: Vercel（無料）

1. https://vercel.com にアクセス
2. GitHubでログイン
3. 「New Project」→「Import」
4. リポジトリを選択
5. 「Deploy」

---

## 📲 ホーム画面への追加方法

### iPhone (Safari)

1. Safariでサイトを開く
2. 下部の共有ボタン（□↑）をタップ
3. 「ホーム画面に追加」をタップ
4. 名前を確認して「追加」

### Android (Chrome)

1. Chromeでサイトを開く
2. 右上の「︙」メニュー
3. 「ホーム画面に追加」をタップ
4. 「追加」をタップ

---

## 🖼️ アイコンの作成

PWAにはアイコンが必要です。以下の方法で作成できます：

### 簡単な方法

1. https://www.canva.com にアクセス
2. 「カスタムサイズ」で 512x512 を指定
3. 野球ボールなどのアイコンをデザイン
4. ダウンロード（PNG形式）
5. 同じものを192x192でも保存

### ファイル名
- `icon-192.png` (192x192px)
- `icon-512.png` (512x512px)

---

## 🔧 ローカルでテストする方法

### 方法1: VS Code + Live Server

1. VS Codeをインストール
2. 拡張機能「Live Server」をインストール
3. `index.html`を右クリック→「Open with Live Server」

### 方法2: Python（Mac/Linuxに標準搭載）

```bash
cd baseball-pwa
python3 -m http.server 8000
```
ブラウザで `http://localhost:8000` を開く

### 方法3: Node.js

```bash
npx serve
```

---

## 📋 ファイル構成

```
baseball-pwa/
├── index.html      # メインHTML
├── styles.css      # スタイル
├── app.js          # アプリのロジック
├── manifest.json   # PWA設定
├── sw.js           # Service Worker（オフライン対応）
├── icon-192.png    # アイコン（192x192）
└── icon-512.png    # アイコン（512x512）
```

---

## 💾 データの保存について

- データはブラウザの **LocalStorage** に保存されます
- 同じブラウザ・同じデバイスなら永続的に保存
- ブラウザのデータを消去すると消えます
- 別のデバイスとは同期されません

---

## ❓ トラブルシューティング

### 「ホーム画面に追加」が表示されない
- HTTPSでアクセスしているか確認
- manifest.jsonが正しく読み込まれているか確認

### データが消えた
- ブラウザのキャッシュ/データを削除した可能性
- プライベートモードでは保存されません

### 動作がおかしい
- ブラウザのキャッシュをクリア
- Service Workerを再登録（開発者ツール→Application→Service Workers→Unregister）

---

## 🎉 完成！

質問があればお気軽にどうぞ！

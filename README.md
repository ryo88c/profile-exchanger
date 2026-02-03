# プロフィール交換アプリ（基礎）

このリポジトリは、名刺を撮影してOCRでメールアドレスを抽出し、プロフィールを送信するウェブアプリのベースとなるコードです。

## ディレクトリ構成

* `frontend/` – ブラウザで動作するクライアントコードを格納します。
* `backend/` – Node.js + Express によるサーバーコードを格納します。
* `README.md` – プロジェクト概要とセットアップ方法を説明します。

## セットアップ方法

1. `backend/.env.example` をコピーして `.env` を作成し、以下の値を設定してください。
   - `SMTP_HOST`: SMTP ホスト。
   - `SMTP_PORT`: SMTP ポート（例: 587）。
   - `SMTP_SECURE`: `true` または `false`（TLS を使う場合は `true`）。
   - `SMTP_USER`: SMTP ユーザー名。
   - `SMTP_PASS`: SMTP パスワード。
   - `SENDER_EMAIL`: 送信元メールアドレス。
   - `SENDER_NAME`: 送信者名（任意）。
   - `SELF_EMAIL`: 自分宛てメールアドレス（名刺画像付きメールを受信したいアドレス）。
   - `PORT`: サーバーポート（任意、デフォルトは 3000）。

2. サーバーの依存関係をインストールし、起動します。

   ```bash
   cd backend
   npm install
   npm start
   ```

3. フロントエンドをブラウザで開きます。バックエンド起動後、`http://localhost:3000/` にアクセスしてください。

   ブラウザを開くとカメラアクセスの許可が求められます。名刺を撮影し、メールアドレスが抽出されたら「プロフィール送信」ボタンで送信処理を行います。

## Railway デプロイ手順

1. Railway で新規プロジェクトを作成し、GitHub の `ryo88c/profile-exchanger` を接続します。
2. ルートに `railway.json` があるため、Build/Start コマンドは自動設定されます。
3. Railway の Variables に以下を設定します。
   - `SMTP_USER`
   - `SMTP_PASS`
   - `SENDER_EMAIL`
   - `SENDER_NAME`（任意）
   - `SELF_EMAIL`
   - `PORT`
4. Settings → Networking で `Generate Domain` を実行します。
5. 発行された HTTPS の URL にアクセスします。

## 今後の実装例

* スタイリングの追加や日本語 OCR の精度向上。
* 抽出したメールアドレスやプロフィール情報の編集・確認画面の拡充。
* 入力バリデーションやエラーハンドリングの強化。
* 送信履歴の保存やユーザー認証の導入。

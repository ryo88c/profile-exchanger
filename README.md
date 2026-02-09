# プロフィール交換アプリ（基礎）

このリポジトリは、名刺を撮影してOCRでメールアドレスを抽出し、プロフィールを送信するウェブアプリのベースとなるコードです。

## ディレクトリ構成

* `frontend/` – ブラウザで動作するクライアントコードを格納します。
* `backend/` – Node.js + Express によるサーバーコードを格納します。
* `README.md` – プロジェクト概要とセットアップ方法を説明します。

## セットアップ方法

1. `backend/.env.example` をコピーして `.env` を作成し、以下の値を設定してください。
   - `RESEND_API_KEY`: Resend の API キー。
   - `RESEND_FROM`: Resend で認証済みの送信元メールアドレス。
   - `SENDER_NAME`: 送信者名（任意）。
   - `SELF_EMAIL`: 自分宛てメールアドレス（名刺画像付きメールを受信したいアドレス）。
   - `PROFILE_MAIL_CONFIG`: プロフィールメール設定 JSON へのパス（任意、既定: `./user-mail/profile-mail.config.json`）。
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
   - `RESEND_API_KEY`
   - `RESEND_FROM`
   - `SENDER_NAME`（任意）
   - `SELF_EMAIL`
   - `PORT`
4. Settings → Networking で `Generate Domain` を実行します。
5. 発行された HTTPS の URL にアクセスします。

## プロフィールHTMLメールのカスタマイズ

- 既定ファイル:
  - 設定: `backend/user-mail/profile-mail.config.json`
  - HTML: `backend/user-mail/profile-email.html`
  - CID画像サンプル: `backend/user-mail/assets/profile-photo.png`
- `htmlMode`:
  - `raw`: `templatePath` の HTML を送信
  - `fallback`: 設定ファイル内 `fallback.html` を送信
- 固定プレースホルダー（これ以外はエラー）:
  - `{{name}}`, `{{title}}`, `{{company}}`, `{{email}}`, `{{phone}}`, `{{website}}`
  - `{{recipient_email}}`, `{{captured_at}}`, `{{location_text}}`, `{{latitude}}`, `{{longitude}}`, `{{sender_name}}`
- `{{name}}` などプロフィール値は `.env` の `PROFILE_*` が優先され、未設定時は `profile-mail.config.json` の `profile` を使用
- 危険タグはエラーで送信中断:
  - `<script>`, `<iframe>`, `<object>`, `<embed>`, `<form>`
- CID添付:
  - `inlineAttachments` に `cid` と `path` を指定
  - HTML 側では `src="cid:your-cid"` で参照

## テスト環境とテスト設計

- 実行:
  - ルート: `npm test`
  - バックエンドのみ: `npm test --prefix backend`
- テスト基盤:
  - Node.js標準の `node:test` を使用（追加ライブラリ不要）
  - 対象ファイル: `backend/test/profile-mail.test.js`
- 現在のテスト観点:
  - `.env` の `PROFILE_*` が設定JSONより優先されること
  - `PROFILE_*` 未設定時に空文字になり、エラーにならないこと
  - 未許可プレースホルダーでエラーになること
  - 危険タグ（`script` 等）でエラーになること
  - `htmlMode=fallback` 時に `fallback.html` を使うこと
  - CID添付が `inlineAttachments` から組み立てられること

## 今後の実装例

* スタイリングの追加や日本語 OCR の精度向上。
* 抽出したメールアドレスやプロフィール情報の編集・確認画面の拡充。
* 入力バリデーションやエラーハンドリングの強化。
* 送信履歴の保存やユーザー認証の導入。

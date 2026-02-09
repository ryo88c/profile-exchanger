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

## ローカル + ngrok でスマホ検証

1. `backend/.env` に以下を設定します。
   - `HOST=0.0.0.0`
   - `PORT=3000`（必要なら変更）
2. サーバーを起動します。
   - `npm start --prefix backend`
3. 別ターミナルで ngrok を起動します。
   - `ngrok http 3000`
4. ngrok が表示する `https://...` URL をスマホで開きます。

補足:
- スマホのカメラ/位置情報は HTTPS でのみ許可されるため、ngrok URL を使用してください。
- フロントとAPIは同一オリジンで配信されるため、追加のCORS設定は不要です。
- サーバーヘルスチェックは `GET /health` です。

## OCR PoC（差し替え可能な構成）

- フロントはまず `POST /ocr` を呼び、失敗時のみブラウザ内 Tesseract.js にフォールバックします。
- `.env` でOCRプロバイダを切り替えます。
  - `OCR_PROVIDER=disabled`: バックエンドOCRを無効化（従来どおりローカルOCR）
  - `OCR_PROVIDER=command`: 外部コマンド実行でOCR
- `OCR_COMMAND`:
  - 外部OCRコマンド。`{input}` は一時画像ファイルパスに置換されます。
  - 例: `python3 ./ocr/paddle_ocr_wrapper.py --lang en {input}`
- `OCR_COMMAND_CWD`:
  - OCRコマンドを実行する作業ディレクトリ（未指定時は `backend/`）
- `OCR_COMMAND_TIMEOUT_MS`: コマンド実行タイムアウト（ミリ秒）
- `OCR_ERROR_LOG_PATH`:
  - OCR失敗ログの出力先（JSON Lines）。未指定時は `backend/logs/ocr-errors.log`
- 逆ジオコーディング（Nominatim）:
  - `REVERSE_GEOCODE_ENDPOINT`: 既定 `https://nominatim.openstreetmap.org/reverse`
  - `REVERSE_GEOCODE_USER_AGENT`: 連絡先つき User-Agent を推奨
  - `REVERSE_GEOCODE_TIMEOUT_MS`: 既定 `5000`
  - `REVERSE_GEOCODE_CACHE_TTL_MS`: 既定 `86400000`（24時間）
  - `REVERSE_GEOCODE_CACHE_MAX_ENTRIES`: 既定 `500`
  - `REVERSE_GEOCODE_LANGUAGE`: 既定 `ja,en`

### PaddleOCR を使う場合

1. Python 仮想環境を作成し、依存関係を入れます。
   - `python3 -m venv .venv`
   - `source .venv/bin/activate`
   - `pip install -r backend/ocr/requirements-paddle.txt`
   - 環境に合う `paddlepaddle` を別途インストールしてください（CPU/GPUに応じて）
2. `backend/.env` を設定します。
   - `OCR_PROVIDER=command`
   - `OCR_COMMAND=python3 ./ocr/paddle_ocr_wrapper.py --lang en {input}`
   - 必要なら `OCR_COMMAND_TIMEOUT_MS=60000`
3. サーバーを再起動して動作確認します。

補足:
- `POST /ocr` の失敗時レスポンスには `code` と `isTimeout` が含まれます。
- コマンド失敗時は `stderr/stdout/exitCode/isTimeout` が `OCR_ERROR_LOG_PATH` に追記されます。
- `POST /send` では緯度経度から地名を逆引きし、メール本文の位置情報に追記します（失敗時は緯度経度のみ）。

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
  - `{{recipient_email}}`, `{{captured_at}}`, `{{location_name}}`, `{{location_text}}`, `{{latitude}}`, `{{longitude}}`, `{{sender_name}}`
- `{{name}}` などプロフィール値は `.env` の `PROFILE_*` が優先され、未設定時は `profile-mail.config.json` の `profile` を使用
- 危険タグはエラーで送信中断:
  - `<script>`, `<iframe>`, `<object>`, `<embed>`, `<form>`
- CID添付:
  - `inlineAttachments` に `cid` と `path` を指定
  - HTML 側では `src="cid:your-cid"` で参照
- Nominatim 公開APIを使う場合:
  - 低頻度利用を前提にしてください（本アプリ想定では問題になりにくい）
  - User-Agent は連絡先を含む値に設定してください

## テスト環境とテスト設計

- 実行:
  - ルート: `npm test`
  - バックエンドのみ: `npm test --prefix backend`
- テスト基盤:
  - Node.js標準の `node:test` を使用（追加ライブラリ不要）
- 対象ファイル:
  - `backend/test/profile-mail.test.js`
  - `backend/test/ocr.test.js`
- 現在のテスト観点:
  - `.env` の `PROFILE_*` が設定JSONより優先されること
  - `PROFILE_*` 未設定時に空文字になり、エラーにならないこと
  - 未許可プレースホルダーでエラーになること
  - 危険タグ（`script` 等）でエラーになること
  - `htmlMode=fallback` 時に `fallback.html` を使うこと
  - CID添付が `inlineAttachments` から組み立てられること
  - OCRメール抽出ロジックが期待通りであること
  - バックエンドOCRの `command` プロバイダが動作すること

## 今後の実装例

* スタイリングの追加や日本語 OCR の精度向上。
* 抽出したメールアドレスやプロフィール情報の編集・確認画面の拡充。
* 入力バリデーションやエラーハンドリングの強化。
* 送信履歴の保存やユーザー認証の導入。

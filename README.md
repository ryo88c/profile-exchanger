# Profile Exchange App

名刺を撮影し、OCRでメールアドレスを抽出してプロフィールを送信する Web アプリです。

## Features

- カメラで名刺を撮影
- OCR でメールアドレス抽出（バックエンド OCR + フォールバック）
- プロフィールメール送信（HTML テンプレート対応）
- 撮影記録メール送信（画像・日時・位置情報）
- 逆ジオコーディング（OSM Nominatim）

## Repository Structure

- `frontend/` ブラウザ UI（静的ファイル）
- `backend/` Node.js + Express API
- `backend/user-mail/` プロフィールメール設定と既定テンプレート
- `backend/ocr/` OCR ラッパー（PaddleOCR 連携用）

## Quick Start

- 環境変数を作成:

```bash
cp backend/.env.example backend/.env
```

- 依存関係をインストール:

```bash
npm install
```

- サーバー起動:

```bash
npm start
```

- ブラウザで開く:

- `http://localhost:3000/`

## Mobile Test with ngrok

スマホでカメラ/位置情報を使う場合は HTTPS が必要です。

1. `backend/.env` で `HOST=0.0.0.0` を確認
2. サーバー起動

```bash
npm start --prefix backend
```

1. 別ターミナルで ngrok 起動

```bash
ngrok http 3000
```

1. 表示された `https://...` URL をスマホで開く

## Environment Variables

主要な設定は `backend/.env.example` を参照してください。

### Mail

- `RESEND_API_KEY`
- `RESEND_FROM`
- `SENDER_NAME`
- `SELF_EMAIL`
- `PROFILE_MAIL_CONFIG`（既定: `./user-mail/profile-mail.config.json`）

### Profile Placeholders (`PROFILE_*`)

- `PROFILE_NAME`
- `PROFILE_TITLE`
- `PROFILE_COMPANY`
- `PROFILE_EMAIL`
- `PROFILE_PHONE`
- `PROFILE_WEBSITE`

### OCR

- `OCR_PROVIDER` (`disabled` or `command`)
- `OCR_COMMAND`
- `OCR_COMMAND_CWD`
- `OCR_COMMAND_TIMEOUT_MS`
- `OCR_ERROR_LOG_PATH`

### Reverse Geocoding (Nominatim)

- `REVERSE_GEOCODE_ENDPOINT`
- `REVERSE_GEOCODE_USER_AGENT`
- `REVERSE_GEOCODE_TIMEOUT_MS`
- `REVERSE_GEOCODE_CACHE_TTL_MS`
- `REVERSE_GEOCODE_CACHE_MAX_ENTRIES`
- `REVERSE_GEOCODE_LANGUAGE`

### Datetime Format

- `DATETIME_TIMEZONE`（既定: `Asia/Tokyo`）
- `DATETIME_LOCALE`（既定: `ja-JP`）
- `DATETIME_FORMAT`（既定: `YYYY/MM/DD HH:mm:ss`）

利用可能トークン:

- `YYYY`, `MM`, `DD`, `HH`, `mm`, `ss`, `TZ`, `OFFSET`

## Profile HTML Mail

既定ファイル:

- 設定: `backend/user-mail/profile-mail.config.json`
- HTML: `backend/user-mail/profile-email.html`

テンプレートモード:

- `htmlMode: "raw"` `templatePath` の HTML を送信
- `htmlMode: "fallback"` 設定 JSON の `fallback.html` を送信

固定プレースホルダー（これ以外はエラー）:

- `{{name}}`, `{{title}}`, `{{company}}`, `{{email}}`, `{{phone}}`
- `{{website}}`, `{{profile_image_url}}`, `{{recipient_email}}`
- `{{captured_at}}`, `{{location_name}}`, `{{location_text}}`
- `{{latitude}}`, `{{longitude}}`, `{{sender_name}}`

条件表示（HTMLのみ）:

- `{{#if name}} ... {{/if}}`
- `.env` に値がない `PROFILE_*` 項目を非表示にできます

安全制限:

- `<script>`, `<iframe>`, `<object>`, `<embed>`, `<form>` を含む HTML はエラー

## OCR Provider

フロントは `POST /ocr` を優先し、失敗時はブラウザ OCR（Tesseract.js）へフォールバックします。

### PaddleOCR

1. Python 環境作成

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/ocr/requirements-paddle.txt
```

1. `paddlepaddle` を環境に応じてインストール
1. `.env` 設定例:

- `OCR_PROVIDER=command`
- `OCR_COMMAND=python3 ./ocr/paddle_ocr_wrapper.py --lang en {input}`

## API

- `GET /health` ヘルスチェック
- `POST /ocr` OCR 実行
- `POST /send` 撮影記録とプロフィール送信

## Tests

```bash
npm test
```

バックエンドのみ:

```bash
npm test --prefix backend
```

## Deploy (Railway)

`railway.json` を利用できます。必要な環境変数を設定してデプロイしてください。

## License

[MIT](./LICENSE)

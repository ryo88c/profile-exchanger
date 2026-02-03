# AGENTS.md

## Project Overview
- This app captures a business card, extracts an email address via OCR, and can send your profile by email.
- It also emails you a record with the captured image, timestamp, and location.

## Repository Structure
- `frontend/`: Static client (HTML/JS) that uses the camera and Tesseract.js.
- `backend/`: Node.js + Express server that sends emails via SMTP (Nodemailer).

## Setup
1. Copy `backend/.env.example` to `backend/.env` and set:
   - `SMTP_HOST`
   - `SMTP_PORT`
   - `SMTP_SECURE`
   - `SMTP_USER`
   - `SMTP_PASS`
   - `SENDER_EMAIL`
   - `SENDER_NAME` (optional)
   - `SELF_EMAIL`
   - `PORT` (optional; defaults to 3000)
2. Install and run the backend:
   - `cd backend`
   - `npm install`
   - `npm start`
3. Open the frontend:
   - After starting the backend, open `http://localhost:3000/`.

## Notes
- The frontend requests camera and geolocation permissions in the browser.
- Tesseract.js is loaded via CDN.

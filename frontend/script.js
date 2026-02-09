// カメラ映像を開始する
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const photo = document.getElementById('photo');
const emailInput = document.getElementById('emailInput');
const sendProfileToggle = document.getElementById('sendProfileToggle');
const statusDiv = document.getElementById('status');
const sendBtn = document.getElementById('sendBtn');
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

function startCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    statusDiv.style.color = '#cc0000';
    statusDiv.textContent = 'このブラウザではカメラAPIが利用できません。iPhoneの場合はhttpsでアクセスしてください。';
    return;
  }
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
    .then((stream) => {
      video.srcObject = stream;
      video.play();
    })
    .catch((err) => {
      statusDiv.textContent = `カメラ起動エラー: ${err.message}`;
    });
}

startCamera();

function extractEmail(text) {
  const match = String(text || '').match(EMAIL_PATTERN);
  return match ? match[0] : '';
}

async function runBackendOcr(dataURL) {
  const response = await fetch('/ocr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: dataURL }),
  });
  const payload = await response.json();
  if (!response.ok || payload.error) {
    throw new Error(payload.error || 'バックエンドOCRに失敗しました');
  }
  return payload;
}

async function runBrowserOcr(dataURL) {
  const result = await Tesseract.recognize(
    dataURL,
    'eng+jpn',
    { logger: (m) => console.log(m) }
  );
  return {
    text: result.data?.text || '',
    email: extractEmail(result.data?.text || ''),
  };
}

// 撮影ボタンの処理
document.getElementById('captureBtn').addEventListener('click', async () => {
  if (!video.videoWidth) {
    statusDiv.textContent = 'カメラ映像の準備ができていません';
    return;
  }
  const width = video.videoWidth;
  const height = video.videoHeight;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, width, height);
  const dataURL = canvas.toDataURL('image/png');
  photo.src = dataURL;
  statusDiv.style.color = '#000';
  statusDiv.textContent = 'OCR解析中...';

  try {
    const backendResult = await runBackendOcr(dataURL);
    if (backendResult.email) {
      emailInput.value = backendResult.email;
      statusDiv.textContent = 'メールアドレスを抽出しました。（バックエンドOCR）';
      return;
    }
    statusDiv.textContent = 'バックエンドOCRでメール抽出できませんでした。ローカルOCRで再試行します...';
  } catch (err) {
    statusDiv.textContent = `バックエンドOCR失敗: ${err.message} ローカルOCRで再試行します...`;
  }

  try {
    const browserResult = await runBrowserOcr(dataURL);
    if (browserResult.email) {
      emailInput.value = browserResult.email;
      statusDiv.textContent = 'メールアドレスを抽出しました。（ローカルOCR）';
    } else {
      statusDiv.textContent = 'メールアドレスが見つかりませんでした。手動で入力してください。';
    }
  } catch (err) {
    statusDiv.textContent = `OCRエラー: ${err.message}`;
  }
});

function updateSendButtonLabel() {
  sendBtn.textContent = sendProfileToggle.checked ? 'プロフィール送信' : '記録送信';
}

sendProfileToggle.addEventListener('change', updateSendButtonLabel);
updateSendButtonLabel();

// 送信ボタンの処理
sendBtn.addEventListener('click', () => {
  const email = emailInput.value.trim();
  const shouldSendProfile = sendProfileToggle.checked;
  if (shouldSendProfile && !email) {
    statusDiv.style.color = '#cc0000';
    statusDiv.textContent = 'プロフィール送信を行うにはメールアドレスを入力してください';
    return;
  }
  if (!photo.src) {
    statusDiv.style.color = '#cc0000';
    statusDiv.textContent = '先に名刺を撮影してください';
    return;
  }
  statusDiv.style.color = '#000';
  statusDiv.textContent = '送信中...';
  // 位置情報の取得
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const payload = {
        image: photo.src,
        email: email,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        timestamp: Date.now(),
        sendProfile: shouldSendProfile,
      };
      fetch('/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.error) {
            statusDiv.style.color = '#cc0000';
            statusDiv.textContent = data.error;
          } else {
            statusDiv.style.color = '#0000cc';
            statusDiv.textContent = data.message || '送信が完了しました';
          }
        })
        .catch((err) => {
          statusDiv.style.color = '#cc0000';
          statusDiv.textContent = `送信エラー: ${err.message}`;
        });
    },
    (error) => {
      statusDiv.style.color = '#cc0000';
      statusDiv.textContent = `位置情報取得エラー: ${error.message}`;
    }
  );
});

/**
 * Mainichi Mileage - Cloud Run バックエンドサーバー
 * 静的ファイルのホスティング ＆ Firestore を用いた端末間データ同期API
 */

const express = require('express');
const path = require('path');
const { Firestore } = require('@google-cloud/firestore');

const app = express();
const PORT = process.env.PORT || 8080;

// 合言葉（パスフレーズ）設定
const SYNC_PASSPHRASE = process.env.SYNC_PASSPHRASE ? process.env.SYNC_PASSPHRASE.trim() : '';

// Firestore クライアントの初期化（Cloud Runではデフォルト認証情報が自動適用されます）
let firestore = null;
let memoryFallbackState = null; // Firestoreが利用できない環境用のフォールバック保持用

try {
  firestore = new Firestore();
  console.log('✅ Google Cloud Firestore クライアントが初期化されました。');
} catch (err) {
  console.warn('⚠️ Firestoreの自動初期化に失敗しました。ローカルフォールバックモードで動作します:', err.message);
}

const COLLECTION_NAME = 'mileage_data';
const DOCUMENT_NAME = 'current_state';

// JSONボディパーサー
app.use(express.json({ limit: '10mb' }));

// APIキャッシュ無効化ミドルウェア
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// --- 合言葉検証ミドルウェア ---
function requireAuth(req, res, next) {
  // 環境変数で合言葉が設定されていない場合はスルー（または警告）
  if (!SYNC_PASSPHRASE) {
    return next();
  }

  const clientPassphrase = req.headers['x-sync-passphrase'] || req.query.passphrase;
  if (!clientPassphrase || clientPassphrase !== SYNC_PASSPHRASE) {
    return res.status(401).json({
      success: false,
      error: '合言葉（パスフレーズ）が正しくありません。'
    });
  }

  next();
}

// --- API ルーティング ---

// サーバー状態 & 合言葉が必要かどうかの確認
app.get('/api/config', (req, res) => {
  res.json({
    requiresPassphrase: !!SYNC_PASSPHRASE
  });
});

// 合言葉の正当性検証エンドポイント
app.post('/api/auth/verify', (req, res) => {
  if (!SYNC_PASSPHRASE) {
    return res.json({ success: true, message: '合言葉は未設定です（認証不要）。' });
  }

  const { passphrase } = req.body || {};
  if (passphrase === SYNC_PASSPHRASE) {
    return res.json({ success: true, message: '認証に成功しました。' });
  } else {
    return res.status(401).json({ success: false, error: '合言葉が一致しません。' });
  }
});

// 最新 state の取得
app.get('/api/state', requireAuth, async (req, res) => {
  try {
    if (firestore) {
      const docRef = firestore.collection(COLLECTION_NAME).doc(DOCUMENT_NAME);
      const doc = await docRef.get();

      if (!doc.exists) {
        return res.json({ exists: false, state: null });
      }

      const data = doc.data();
      return res.json({
        exists: true,
        state: data.state,
        updatedAt: data.updatedAt || null
      });
    } else {
      // フォールバック
      if (!memoryFallbackState) {
        return res.json({ exists: false, state: null });
      }
      return res.json({
        exists: true,
        state: memoryFallbackState.state,
        updatedAt: memoryFallbackState.updatedAt
      });
    }
  } catch (err) {
    console.error('State取得エラー:', err);
    res.status(500).json({ success: false, error: 'データの取得に失敗しました: ' + err.message });
  }
});

// 最新 state の保存
app.post('/api/state', requireAuth, async (req, res) => {
  try {
    const { state } = req.body || {};
    if (!state || typeof state !== 'object') {
      return res.status(400).json({ success: false, error: '有効な state データがありません。' });
    }

    const payload = {
      state: state,
      updatedAt: new Date().toISOString()
    };

    if (firestore) {
      const docRef = firestore.collection(COLLECTION_NAME).doc(DOCUMENT_NAME);
      await docRef.set(payload, { merge: true });
    } else {
      memoryFallbackState = payload;
    }

    return res.json({
      success: true,
      updatedAt: payload.updatedAt
    });
  } catch (err) {
    console.error('State保存エラー:', err);
    res.status(500).json({ success: false, error: 'データの保存に失敗しました: ' + err.message });
  }
});

// 静的ファイルの配信
app.use(express.static(path.join(__dirname)));

// SPAフォールバック（どのパスでもindex.htmlを返す）
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`🚀 Mainichi Mileage サーバーが起動しました: http://localhost:${PORT}`);
  if (SYNC_PASSPHRASE) {
    console.log('🔒 合言葉認証: 有効');
  } else {
    console.log('⚠️ 合言葉認証: 未設定（環境変数 SYNC_PASSPHRASE を設定すると有効になります）');
  }
});

FROM node:20-alpine

WORKDIR /app

# 依存関係定義を先にコピーしてレイヤーキャッシュを活用
COPY package*.json ./

# 本番用依存関係のみインストール
RUN npm install --production

# ソースコードをコピー
COPY . .

# Cloud Runのデフォルトポート
ENV PORT=8080
EXPOSE 8080

# サーバー起動
CMD ["node", "server.js"]

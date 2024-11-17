FROM node:18

# Install ffmpeg
RUN apt-get update && \
    apt-get install -y ffmpeg

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .

EXPOSE 5002
CMD ["node", "index.js"]

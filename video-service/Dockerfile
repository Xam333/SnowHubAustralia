FROM node:18

RUN apt-get update 

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .

EXPOSE 5001
CMD ["node", "index.js"]

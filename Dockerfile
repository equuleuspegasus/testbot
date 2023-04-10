FROM node:18 as base

WORKDIR /usr/src/app

RUN apt-get update && apt-get install ffmpeg autoconf automake g++ libtool -y

FROM base as deps

COPY package*.json ./
RUN npm install

FROM deps

COPY . .

CMD ["npm", "run", "start"];

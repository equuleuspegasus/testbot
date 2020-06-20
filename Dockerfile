FROM node:14

WORKDIR /usr/src/app

COPY . .

RUN apt-get update && apt-get install ffmpeg -y

RUN npm install


CMD ["npm", "run", "start"];

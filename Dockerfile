FROM node:8
WORKDIR /usr/local/web

ADD .                           /usr/local/web

RUN npm install

EXPOSE 80

CMD ["npm", "start"]


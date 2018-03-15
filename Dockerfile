FROM node:8
WORKDIR /usr/local/web

ADD .                      /usr/local/web

EXPOSE 3000

CMD ["npm", "start"]


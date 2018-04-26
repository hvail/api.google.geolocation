FROM node:8
WORKDIR /usr/local/web

# ADD .                           /usr/local/web
ADD app.js                      /usr/local/web/app.js
ADD package.json                /usr/local/web/package.json
ADD bin                         /usr/local/web/bin
ADD node_modules                /usr/local/web/node_modules
ADD public                      /usr/local/web/public
ADD routes                      /usr/local/web/routes
ADD views                       /usr/local/web/views

EXPOSE 80

CMD ["npm", "start"]


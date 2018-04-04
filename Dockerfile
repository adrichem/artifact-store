
FROM node:9
RUN mkdir /code
WORKDIR /code
RUN npm install -g nodemon 
COPY . /code
RUN npm install 
RUN npm test
CMD ["node", "start"]

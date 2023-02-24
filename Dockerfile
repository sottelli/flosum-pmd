FROM timbru31/java-node
WORKDIR /app

COPY . .

RUN npm install

EXPOSE 5000

CMD node index.js
FROM timbru31/java-node
WORKDIR /app

COPY . .

RUN npm ci --production

EXPOSE 5000

CMD node index.js
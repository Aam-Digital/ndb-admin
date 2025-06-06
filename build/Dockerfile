# This docker image can be used to run the service.
# To use it only Docker needs to be installed locally
# Run the following commands from the root folder to build, run and kill the application
# >> docker build -f build/Dockerfile -t ndb-admin:latest .
# >> docker run -p=80:80 ndb-admin:latest
FROM node:20-alpine as builder
WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --no-progress

COPY . .

RUN npm run build

FROM node:20-alpine
WORKDIR /app
# Some packages enable optimization when this is set
ENV NODE_ENV="production"

COPY package.json package-lock.json ./

RUN npm ci --no-progress --only=production

COPY --from=builder /app/dist ./dist

ENV KEYCLOAK_ADMIN_PASSWORD="password"
ENV KEYCLOAK_URL="https://keycloak.aam-digital.com"
ENV DOMAIN="aam-digital.com"

CMD ["node", "dist/main"]


# This docker image can be used to run the service.
# To use it only Docker needs to be installed locally
# Run the following commands from the root folder to build, run and kill the application
# >> docker build -f build/Dockerfile -t ndb-admin:latest .
# >> docker run -p=80:80 ndb-admin:latest
FROM node:16.13.0-alpine3.13 as builder
WORKDIR /app

COPY package*.json ./
RUN npm ci --no-progress

COPY . .

RUN npm run build

# If set to true, tests are exectued
ARG RUN_TESTS=false

# Lint code and run tests
RUN if [ "$RUN_TESTS" = true ] ; then \
    npm run lint &&\
    npm run test:cov ; fi

FROM node:16.13.0-alpine3.13
WORKDIR /app
# Some packages enable optimization when this is set
ENV NODE_ENV="production"

COPY package*.json ./
RUN npm ci --no-progress --only=production

COPY --from=builder /app/dist ./dist

ENV KEYCLOAK_ADMIN_PASSWORD="password"
ENV KEYCLOAK_URL="https://keycloak.aam-digital.com"
ENV DOMAIN="aam-digital.com"

CMD ["node", "dist/main"]


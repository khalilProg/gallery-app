# Gallery App

Gallery App is a self-hosted photo gallery built with Next.js. MongoDB stores image metadata and Garage stores the original files. The app streams images from Garage to the browser. Docker Compose also provides Prometheus and Grafana dashboards.

## Prerequisites

- Docker with the Compose plugin
- Node.js 24 and npm for development on the host

Run the commands below from the project directory. Prefix Docker commands with `sudo` if your Docker installation requires it.

## Configure storage

Create a local environment file.

```bash
cp .env.example .env
```

For a fresh MongoDB volume, set `MONGO_USER` and `MONGO_PASSWORD` in `.env`. Generate a URI-safe password with `openssl rand -hex 24` and use the same credentials in `MONGO_URI`. If you're reusing a MongoDB volume, use its existing credentials.

The sample connection URLs use the Compose service names `mongo` and `garage`. Leave the Garage keys blank until you generate them.

```bash
docker compose up -d mongo garage
docker compose exec garage /garage status
```

On a fresh Garage volume, if the node shows `NO ROLE ASSIGNED`, replace `NODE_ID` with the ID shown by `status`.

```bash
docker compose exec garage /garage layout assign -z dc1 -c 1G NODE_ID
docker compose exec garage /garage layout apply --version 1
```

Create the bucket and issue a key. If you're reusing a Garage volume, use the existing bucket name and skip bucket creation.

```bash
docker compose exec garage /garage bucket create gallery
docker compose exec garage /garage key create gallery-app
docker compose exec garage /garage bucket allow --read --write gallery --key gallery-app
```

Set `GARAGE_BUCKET` to the bucket name, `GARAGE_ACCESS_KEY` to the **Key ID**, and `GARAGE_SECRET_KEY` to the **Secret key** returned by Garage. Keep `.env` local. See the [Garage quick start](https://garagehq.deuxfleurs.fr/documentation/quick-start/) for details.

## Run the full stack in Compose

```bash
docker compose up -d --build
```

Open [the gallery](http://localhost:3000), [Grafana](http://localhost:3001), or [Prometheus](http://localhost:9090). Try uploading and deleting an image to confirm both storage services work. Use `docker compose down` to stop the stack while keeping its data volumes.

## Develop on the host

Keep MongoDB and Garage running in Compose. If the containerized gallery is running, stop it to free port 3000. Copy the local env file so Next.js can override the Compose hostnames.

```bash
docker compose stop gallery
cp .env .env.local
npm ci
```

In `.env.local`, change the MongoDB hostname from `mongo` to `localhost` and set `GARAGE_ENDPOINT=http://localhost:3900`. Then run:

```bash
npm run dev
```

The gallery is available at [http://localhost:3000](http://localhost:3000).

## Build and verify

CI installs from the npm lockfile, runs lint and type checks, and builds the production image. The image uses the Next.js standalone server. Compose supplies database and Garage credentials at runtime.

```bash
npm ci
npm run lint
npm run type-check
docker build -t gallery:test .
docker build -f Dockerfile.dev -t gallery:dev .
```

The publish workflow builds and pushes the production image to GHCR on pushes to `main`.

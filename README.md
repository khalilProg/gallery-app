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

Open [the gallery](http://localhost:3001), [Grafana](http://localhost:3002), or [Prometheus](http://localhost:9090). Try uploading and deleting an image to confirm both storage services work. Use `docker compose down` to stop the stack while keeping its data volumes.

Gallery and OpsPilot run as separate Compose projects. Gallery uses the following ports.

| Service | Host address | Container port |
| --- | --- | --- |
| Gallery | localhost:3001 | 3000 |
| MongoDB | localhost:27018 | 27017 |
| Grafana | localhost:3002 | 3000 |

Gallery containers connect to MongoDB at `mongo:27017` on their own Compose network. Compose scopes the container, network, and volume names to this project. Run commands from this directory using the same Compose project name as your existing Gallery deployment to keep using its data volumes.

## Develop on the host

Keep MongoDB and Garage running in Compose. If the containerized gallery is running, stop it to free port 3001. Copy the local env file so Next.js can override the Compose hostnames.

```bash
docker compose stop gallery
cp .env .env.local
npm ci
```

If Sharp tries to compile against a system-installed libvips and the install fails, run `SHARP_IGNORE_GLOBAL_LIBVIPS=1 npm ci` to use its bundled binaries.

In `.env.local`, change `mongo:27017` in `MONGO_URI` to `localhost:27018` and set `GARAGE_ENDPOINT=http://localhost:3900`. Then run:

```bash
npm run dev
```

The gallery is available at [http://localhost:3001](http://localhost:3001).

## Gallery pagination

The gallery and search load 12 images at a time. New uploads get a WebP thumbnail, and older images use their original file until a thumbnail is available.

`GET /api/images` returns `{ images, nextCursor }`. For the next page, pass the URL-encoded `nextCursor` as the `cursor` query parameter. A `null` cursor means the last page has been reached.

`GET /api/search?q=...` returns the same page structure. Pass both the same query and the returned cursor to load additional matches. Search cursors order results by relevance, creation time, and ID. They are valid for that query. If photos are retagged between requests, their ranking can change. An optional `warning` reports when only tag matches could be returned because visual inference was unavailable.

## Image search indexing

Compose runs a separate `indexer` service. Uploaded photos appear in the gallery as soon as they are stored. The card shows **Indexing…** until its embedding and tags are ready. The worker retries transient errors up to four attempts. An interrupted job becomes available when its lease expires.

To queue older photos that lack current embeddings, or retry failed images after fixing the cause, run:

```bash
docker compose exec indexer npm run indexing:backfill
docker compose logs -f indexer
```

Broad searches such as `food`, `clothes`, and `nature` include related tags and can also match visually similar photos. Use **Edit details** on a photo card to add a searchable description, manage manual tags, or remove incorrect AI tags. Descriptions, manual tags, and AI tag removals survive retagging. Retagging reuses compatible CLIP embeddings. To refresh older photos, run `docker compose exec indexer npm run indexing:backfill -- --retag`.

For host development, run `npm run indexing:worker` in a second terminal with the same `.env.local` as the app. Use `npm run indexing:backfill` to queue older photos. The first host run can download the CLIP model. The production image downloads the model during its build.

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

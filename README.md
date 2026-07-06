# Gallery App 🖼️

A modern, full-stack gallery application built with Next.js, leveraging a robust DevOps-oriented architecture for scalable storage and data management.

## 🚀 App Overview

This application serves as a media gallery where users can upload, view, and manage images. It separates metadata storage from binary object storage to ensure high performance, scalability, and ease of backup.

## 🛠️ Tech Stack & DevOps Architecture

This project is designed with a strong focus on containerization, scalable storage, and developer experience.

### Frontend & API (Next.js)
- **Framework:** Next.js 16 (App Router)
- **UI:** React 19, Tailwind CSS v4
- **Language:** TypeScript
- **AWS SDK:** `@aws-sdk/client-s3` for communicating with the Garage object storage.

### Infrastructure & Storage (Docker Compose)
The application relies on a multi-container Docker setup defined in `docker-compose.yaml`:

- **[MongoDB](https://www.mongodb.com/) (`mongo:8`)**: Serves as the primary database for storing image metadata, user data, and application state. Data is persisted via the `mongo_data` Docker volume.
- **[Garage](https://garagehq.deuxfleurs.fr/) (`dxflrs/garage:v2.3.0`)**: A lightweight, S3-compatible distributed object storage server. It handles the actual binary image files, ensuring scalable and resilient media storage. Data is persisted via the `garage_data` volume and configured via `./garage/config/garage.toml`.

### Environments
The project supports distinct environments to streamline development and production deployments:
- `Dockerfile.dev`: Optimized for local development with hot-reloading.
- `Dockerfile`: Multi-stage build optimized for production, ensuring a minimal attack surface and small image size.

## 🐳 Getting Started (Local Development)

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- Node.js (for local Next.js development)
- `pnpm` (Package manager)

### 1. Start the Backend Infrastructure
Launch the MongoDB and Garage instances using Docker Compose:

```bash
docker-compose up -d
```

### 2. Configure Environment Variables
Copy the provided `.env.example` file to `.env` (or `.env.local`) to configure your environment:

```bash
cp .env.example .env
```

Ensure the variables match your `docker-compose.yaml` setup and your Garage credentials. The `.env.example` file provides sensible defaults for local development.

### 3. Run the Next.js Development Server
Install dependencies and start the app:

```bash
pnpm install
pnpm dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

## 📦 Production Deployment

To build and run the application for production using Docker:

```bash
# Build the production image
docker build -t gallery-app -f Dockerfile .

# Run the container (ensure env vars are provided)
docker run -p 3000:3000 --env-file .env gallery-app
```

## 📂 Project Structure

- `/app`: Next.js App Router (Pages, API routes, Components).
- `/garage/config`: Configuration files for the Garage S3-compatible storage.
- `/docker-compose.yaml`: Infrastructure orchestration.
- `Dockerfile` / `Dockerfile.dev`: Container definitions.

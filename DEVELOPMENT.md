# Development Commands

This project includes a `Makefile` and Docker setup for common local tasks.

## Makefile

Run commands from the repository root.

```bash
make help
```

Install dependencies:

```bash
make install
```

Start the app locally:

```bash
make dev
```

Run the JSON to SQLite migration:

```bash
make migrate
```

Run smoke tests:

```bash
make smoke
```

Send a simulated payment webhook:

```bash
make webhook
```

Start ngrok for local webhook testing:

```bash
make ngrok
```

You can override the port:

```bash
make dev PORT=3000
make smoke TEST_URL=http://localhost:3000
```

## Docker

Build the image:

```bash
make docker-build
```

Run the container:

```bash
make docker-run
```

Or use Docker directly:

```bash
docker build -t sabicredit .
docker run --rm -p 4000:4000 --env PORT=4000 sabicredit
```

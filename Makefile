APP_DIR := skeleton
PORT ?= 4000
TEST_URL ?= http://localhost:$(PORT)

.PHONY: help install dev migrate smoke webhook ngrok docker-build docker-run

help:
	@printf "SabiCredit development commands\n\n"
	@printf "  make install       Install Node dependencies\n"
	@printf "  make dev           Start the app on PORT=$(PORT)\n"
	@printf "  make migrate       Migrate JSON data to SQLite\n"
	@printf "  make smoke         Run smoke tests against TEST_URL=$(TEST_URL)\n"
	@printf "  make webhook       Send a simulated payment webhook\n"
	@printf "  make ngrok         Expose PORT=$(PORT) with ngrok\n"
	@printf "  make docker-build  Build the local Docker image\n"
	@printf "  make docker-run    Run the local Docker image\n"

install:
	cd $(APP_DIR) && npm install

dev:
	cd $(APP_DIR) && PORT=$(PORT) npm run dev

migrate:
	cd $(APP_DIR) && node scripts/migrate-to-sqlite.js

smoke:
	cd $(APP_DIR) && TEST_URL=$(TEST_URL) node tests/smoke.js

webhook:
	cd $(APP_DIR) && scripts/sim-webhook.sh http://localhost:$(PORT)/api/webhook/payment

ngrok:
	cd $(APP_DIR) && scripts/start-ngrok.sh $(PORT)

docker-build:
	docker build -t sabicredit .

docker-run:
	docker run --rm -p $(PORT):4000 --env PORT=4000 sabicredit

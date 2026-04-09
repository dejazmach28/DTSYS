GO ?= go
UV ?= server/.venv/bin/uv

.PHONY: dev-server dev-frontend dev-agent build-agents build-frontend docker-up docker-down migrate test-server test-client lint-server fmt-client clean

dev-server:
	cd server && .venv/bin/uvicorn app.main:app --reload --port 8000

dev-frontend:
	cd frontend && npm run dev

dev-agent:
	cd client && $(GO) run ./cmd/agent/ --config /tmp/dtsys-test.toml

build-agents:
	cd client && GOOS=linux GOARCH=amd64 $(GO) build -ldflags="-s -w -X main.AgentVersion=0.1.0" -o ../dist/agents/dtsys-agent-linux-amd64 ./cmd/agent/
	cd client && GOOS=linux GOARCH=arm64 $(GO) build -ldflags="-s -w -X main.AgentVersion=0.1.0" -o ../dist/agents/dtsys-agent-linux-arm64 ./cmd/agent/
	cd client && GOOS=windows GOARCH=amd64 $(GO) build -ldflags="-s -w -X main.AgentVersion=0.1.0" -o ../dist/agents/dtsys-agent-windows.exe ./cmd/agent/
	cd client && GOOS=darwin GOARCH=amd64 $(GO) build -ldflags="-s -w -X main.AgentVersion=0.1.0" -o ../dist/agents/dtsys-agent-darwin-amd64 ./cmd/agent/
	cd client && GOOS=darwin GOARCH=arm64 $(GO) build -ldflags="-s -w -X main.AgentVersion=0.1.0" -o ../dist/agents/dtsys-agent-darwin-arm64 ./cmd/agent/

build-frontend:
	cd frontend && npm run build

docker-up:
	docker compose up -d

docker-down:
	docker compose down

migrate:
	cd server && .venv/bin/alembic upgrade head

test-server:
	cd server && .venv/bin/pytest tests/ -v

test-client:
	cd client && $(GO) test ./...

lint-server:
	cd server && .venv/bin/ruff check app/

fmt-client:
	cd client && $(GO)fmt -w .

clean:
	rm -rf dist/agents/* frontend/dist client/bin

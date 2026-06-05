# Build stage - force builder to run natively on host CPU (no QEMU)
FROM --platform=$BUILDPLATFORM golang:1.25-alpine AS builder

WORKDIR /app

# Install dependencies first for better caching
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

RUN go mod tidy

# Generate ent ORM client code
RUN go generate ./ent/...

# Capture target platform from Docker for native cross-compilation
ARG TARGETOS
ARG TARGETARCH

# Build all three binaries
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -o /auth-service ./cmd/auth-service/main.go
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -o /channel-service ./cmd/channel-service/main.go
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -o /worker ./cmd/worker-service/main.go

# Final stage
FROM alpine:latest
WORKDIR /app

# Copy binaries from builder
COPY --from=builder /auth-service /app/auth-service
COPY --from=builder /channel-service /app/channel-service
COPY --from=builder /worker /app/worker

# Default command (can be overridden in docker-compose.yml)
CMD ["/app/auth-service"]

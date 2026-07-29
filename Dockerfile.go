# ============================================================================
# SOVEREIGN FX TRADING BOT (PRODA/NEXUS): GO BACKEND DOCKERFILE
# Stage 1: Build the high-performance Go compiler artifact
# ============================================================================

FROM golang:1.21-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git gcc musl-dev

# Copy go.mod and sum
COPY go.mod ./
COPY go.sum* ./
RUN go mod download

# Copy application files
COPY . .

# Build static binary
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o sovereign-backend main.go

# ============================================================================
# Stage 2: Final deployment container
# ============================================================================

FROM alpine:3.18

WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata

# Copy built binary from Stage 1
COPY --from=builder /app/sovereign-backend .
COPY --from=builder /app/migrations ./migrations

EXPOSE 8080

ENV PORT=8080
ENV NODE_ENV=production

CMD ["./sovereign-backend"]

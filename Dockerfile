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
# If go.sum exists, copy it, else run go mod tidy
RUN go mod download

# Copy the rest of the application
COPY . .

# Build the optimized production static binary
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o sovereign-backend main.go

# ============================================================================
# Stage 2: Final lightweight safe deployment environment
# ============================================================================

FROM alpine:3.18

WORKDIR /app

# Install security certificates and tzdata for scheduling / timing
RUN apk add --no-cache ca-certificates tzdata

# Copy built binary from Stage 1
COPY --from=builder /app/sovereign-backend .

# Copy any required configuration directories (e.g. migrations)
COPY --from=builder /app/migrations ./migrations

# Expose the API port
EXPOSE 3000

# Set environment defaults
ENV PORT=3000
ENV NODE_ENV=production

# Run the backend
CMD ["./sovereign-backend"]

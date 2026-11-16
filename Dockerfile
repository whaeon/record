FROM golang:1.25-bookworm AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/api .

FROM debian:bookworm-slim
RUN apt-get update \
	&& apt-get install -y --no-install-recommends ca-certificates curl postgresql-client \
	&& rm -rf /var/lib/apt/lists/*
COPY --from=build /out/api /api
EXPOSE 8080
HEALTHCHECK --interval=5s --timeout=3s --retries=10 CMD curl -fsS http://127.0.0.1:8080/api/strategies || exit 1
CMD ["/api"]

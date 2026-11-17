FROM golang:1.25-bookworm AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/api .

FROM debian:bookworm-slim
RUN apt-get update \
	&& apt-get install -y --no-install-recommends ca-certificates curl gnupg \
	&& curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /etc/apt/trusted.gpg.d/pgdg.gpg \
	&& echo "deb [signed-by=/etc/apt/trusted.gpg.d/pgdg.gpg] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
	&& apt-get update \
	&& apt-get install -y --no-install-recommends postgresql-client-16 \
	&& rm -rf /var/lib/apt/lists/*
COPY --from=build /out/api /api
EXPOSE 8080
HEALTHCHECK --interval=5s --timeout=3s --retries=10 CMD ["sh", "-c", "curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:8080/api/me | grep -q 401"]
CMD ["/api"]

package config

import (
	"log"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	DatabaseURL          string
	MasterEncryptionKey  string
	APIMutateKey         string
	Port                 string
	Environment          string
}

func LoadConfig() *Config {
	// Try loading .env, ignore if it fails (using real env in containers)
	if err := godotenv.Load(); err != nil {
		log.Println("[CONFIG] .env file not found, relying on system environment variables")
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		// Construct from separate variables if DATABASE_URL is missing
		host := os.Getenv("PGHOST")
		if host == "" {
			host = "localhost"
		}
		port := os.Getenv("PGPORT")
		if port == "" {
			port = "5432"
		}
		user := os.Getenv("PGUSER")
		if user == "" {
			user = "postgres"
		}
		pass := os.Getenv("PGPASSWORD")
		if pass == "" {
			pass = "postgres"
		}
		dbname := os.Getenv("PGDATABASE")
		if dbname == "" {
			dbname = "sovereign_db"
		}
		dbURL = "postgresql://" + user + ":" + pass + "@" + host + ":" + port + "/" + dbname
	}

	masterKey := os.Getenv("MASTER_ENCRYPTION_KEY")

	apiMutateKey := os.Getenv("API_MUTATE_KEY")

	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}

	env := os.Getenv("NODE_ENV")
	if env == "" {
		env = "development"
	}

	return &Config{
		DatabaseURL:         dbURL,
		MasterEncryptionKey: masterKey,
		APIMutateKey:        apiMutateKey,
		Port:                port,
		Environment:         env,
	}
}

func GetEnvAsInt(name string, defaultVal int) int {
	valueStr := os.Getenv(name)
	if value := valueStr; value != "" {
		if i, err := strconv.Atoi(value); err == nil {
			return i
		}
	}
	return defaultVal
}

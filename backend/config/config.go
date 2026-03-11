package config

import "os"

type Config struct {
	RedisAddr    string
	ServerPort   string
	GitHubSecret string
}

func Load() *Config {
	redisAddr := os.Getenv("REDIS_ADDR")
	if redisAddr == "" {
		redisAddr = "localhost:6379"
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	return &Config{
		RedisAddr:    redisAddr,
		ServerPort:   port,
		GitHubSecret: os.Getenv("GITHUB_WEBHOOK_SECRET"),
	}
}

func (c *Config) GetRedisAddr() string {
	return c.RedisAddr
}

func (c *Config) GetServerPort() string {
	return c.ServerPort
}

func (c *Config) GetGitHubSecret() string {
	return c.GitHubSecret
}

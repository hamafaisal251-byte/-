package telemetry

import (
	"log"
	"os"
	"strings"

	"github.com/getsentry/sentry-go"
	"github.com/gin-gonic/gin"
)

// InitSentry initializes the Sentry SDK for Go with credential scrubbing
func InitSentry(environment string) error {
	dsn := os.Getenv("SENTRY_DSN")
	if dsn == "" {
		log.Println("[SENTRY] SENTRY_DSN not configured. Sentry tracking inactive.")
		return nil
	}

	err := sentry.Init(sentry.ClientOptions{
		Dsn:              dsn,
		Environment:      environment,
		Release:          "sovereign-nexus@1.0.0",
		AttachStacktrace: true,
		BeforeSend: func(event *sentry.Event, hint *sentry.EventHint) *sentry.Event {
			// Scrub sensitive headers
			if event.Request != nil && event.Request.Headers != nil {
				for k := range event.Request.Headers {
					lk := strings.ToLower(k)
					if strings.Contains(lk, "auth") || strings.Contains(lk, "token") || strings.Contains(lk, "key") || strings.Contains(lk, "secret") || strings.Contains(lk, "password") {
						event.Request.Headers[k] = "[REDACTED]"
					}
				}
				if event.Request.QueryString != "" {
					event.Request.QueryString = sanitizeQuery(event.Request.QueryString)
				}
			}

			// Scrub sensitive extra data
			if event.Extra != nil {
				for k, v := range event.Extra {
					lk := strings.ToLower(k)
					if strings.Contains(lk, "token") || strings.Contains(lk, "secret") || strings.Contains(lk, "password") || strings.Contains(lk, "key") {
						event.Extra[k] = "[REDACTED]"
					} else if strVal, ok := v.(string); ok {
						event.Extra[k] = sanitizeString(strVal)
					}
				}
			}
			return event
		},
	})

	if err != nil {
		log.Printf("[SENTRY ERROR] Initialization failed: %v", err)
		return err
	}

	log.Println("[SENTRY] Sentry error tracking initialized successfully with data scrubbing enabled.")
	return nil
}

func SentryMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if err := recover(); err != nil {
				sentry.CurrentHub().Recover(err)
				c.AbortWithStatusJSON(500, gin.H{
					"success": false,
					"error":   "Internal Server Panic captured by Sentry Telemetry",
				})
			}
		}()
		c.Next()
	}
}

func sanitizeQuery(query string) string {
	parts := strings.Split(query, "&")
	for i, p := range parts {
		kv := strings.SplitN(p, "=", 2)
		if len(kv) == 2 {
			lk := strings.ToLower(kv[0])
			if strings.Contains(lk, "token") || strings.Contains(lk, "key") || strings.Contains(lk, "secret") || strings.Contains(lk, "password") {
				parts[i] = kv[0] + "=[REDACTED]"
			}
		}
	}
	return strings.Join(parts, "&")
}

func sanitizeString(val string) string {
	if strings.HasPrefix(val, "SIMULATED-") || strings.HasPrefix(val, "eyJ") || len(val) > 40 {
		return "[REDACTED]"
	}
	return val
}

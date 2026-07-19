package api

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/sha512"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/proda-nexus/sovereign-trading/internal/crypto"
)

type CustomConnector struct {
	ID         string                 `json:"id"`
	Name       string                 `json:"name"`
	Type       string                 `json:"type"`
	BaseURL    string                 `json:"base_url"`
	AuthScheme string                 `json:"auth_scheme"`
	AuthConfig map[string]interface{} `json:"auth_config"`
	Endpoints  map[string]interface{} `json:"endpoints"`
	Status     string                 `json:"status"`
	CreatedAt  time.Time              `json:"created_at"`
}

// GetCustomConnectors handles GET /api/custom-connectors
func (h *Handler) GetCustomConnectors(c *gin.Context) {
	ctx := c.Request.Context()
	rows, err := h.DB.Pool.Query(ctx, "SELECT id, name, type, base_url, auth_scheme, auth_config, endpoints, status, created_at FROM custom_connectors ORDER BY created_at DESC")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	defer rows.Close()

	var connectors []CustomConnector
	for rows.Next() {
		var conn CustomConnector
		var authConfigBytes, endpointsBytes []byte
		err := rows.Scan(&conn.ID, &conn.Name, &conn.Type, &conn.BaseURL, &conn.AuthScheme, &authConfigBytes, &endpointsBytes, &conn.Status, &conn.CreatedAt)
		if err == nil {
			_ = json.Unmarshal(authConfigBytes, &conn.AuthConfig)
			_ = json.Unmarshal(endpointsBytes, &conn.Endpoints)

			// Mask secrets
			if conn.AuthConfig != nil {
				if apiKeyEnc, ok := conn.AuthConfig["apiKeyEnc"].(string); ok && apiKeyEnc != "" {
					conn.AuthConfig["apiKey"] = "••••••••"
				} else {
					conn.AuthConfig["apiKey"] = ""
				}
				if secretKeyEnc, ok := conn.AuthConfig["secretKeyEnc"].(string); ok && secretKeyEnc != "" {
					conn.AuthConfig["secretKey"] = "••••••••"
				} else {
					conn.AuthConfig["secretKey"] = ""
				}
				if passwordEnc, ok := conn.AuthConfig["passwordEnc"].(string); ok && passwordEnc != "" {
					conn.AuthConfig["password"] = "••••••••"
				} else {
					conn.AuthConfig["password"] = ""
				}
			}
			connectors = append(connectors, conn)
		}
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "connectors": connectors})
}

// CreateCustomConnector handles POST /api/custom-connectors
func (h *Handler) CreateCustomConnector(c *gin.Context) {
	ctx := c.Request.Context()
	var input struct {
		ID         string                 `json:"id"`
		Name       string                 `json:"name" binding:"required"`
		Type       string                 `json:"type" binding:"required"`
		BaseURL    string                 `json:"base_url" binding:"required"`
		AuthScheme string                 `json:"auth_scheme" binding:"required"`
		AuthConfig map[string]interface{} `json:"auth_config"`
		Endpoints  map[string]interface{} `json:"endpoints"`
		Status     string                 `json:"status"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	if input.AuthConfig == nil {
		input.AuthConfig = make(map[string]interface{})
	}
	if input.Endpoints == nil {
		input.Endpoints = make(map[string]interface{})
	}
	if input.Status == "" {
		input.Status = "DISCONNECTED"
	}

	// Encrypt raw fields if provided
	if apiKey, ok := input.AuthConfig["apiKey"].(string); ok && apiKey != "" {
		if _, exists := input.AuthConfig["apiKeyEnc"]; !exists {
			enc, _ := crypto.Encrypt(apiKey)
			input.AuthConfig["apiKeyEnc"] = enc
			delete(input.AuthConfig, "apiKey")
		}
	}
	if secretKey, ok := input.AuthConfig["secretKey"].(string); ok && secretKey != "" {
		if _, exists := input.AuthConfig["secretKeyEnc"]; !exists {
			enc, _ := crypto.Encrypt(secretKey)
			input.AuthConfig["secretKeyEnc"] = enc
			delete(input.AuthConfig, "secretKey")
		}
	}
	if password, ok := input.AuthConfig["password"].(string); ok && password != "" {
		if _, exists := input.AuthConfig["passwordEnc"]; !exists {
			enc, _ := crypto.Encrypt(password)
			input.AuthConfig["passwordEnc"] = enc
			delete(input.AuthConfig, "password")
		}
	}

	finalID := input.ID
	if finalID == "" {
		finalID = fmt.Sprintf("conn-custom-%d", time.Now().UnixNano()/1e6)
	}

	authConfigJSON, _ := json.Marshal(input.AuthConfig)
	endpointsJSON, _ := json.Marshal(input.Endpoints)

	_, err := h.DB.Pool.Exec(ctx, `
		INSERT INTO custom_connectors (id, name, type, base_url, auth_scheme, auth_config, endpoints, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (id) DO UPDATE SET
			name = EXCLUDED.name,
			type = EXCLUDED.type,
			base_url = EXCLUDED.base_url,
			auth_scheme = EXCLUDED.auth_scheme,
			auth_config = EXCLUDED.auth_config,
			endpoints = EXCLUDED.endpoints,
			status = EXCLUDED.status`,
		finalID, input.Name, input.Type, input.BaseURL, input.AuthScheme, authConfigJSON, endpointsJSON, input.Status,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "id": finalID})
}

// DeleteCustomConnector handles DELETE /api/custom-connectors/:id
func (h *Handler) DeleteCustomConnector(c *gin.Context) {
	ctx := c.Request.Context()
	id := c.Param("id")
	_, err := h.DB.Pool.Exec(ctx, "DELETE FROM custom_connectors WHERE id = $1", id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// TestCustomConnector handles POST /api/custom-connectors/test
func (h *Handler) TestCustomConnector(c *gin.Context) {
	var input struct {
		BaseURL      string                 `json:"base_url" binding:"required"`
		AuthScheme   string                 `json:"auth_scheme" binding:"required"`
		AuthConfig   map[string]interface{} `json:"auth_config"`
		Endpoints    map[string]interface{} `json:"endpoints"`
		EndpointName string                 `json:"endpointName" binding:"required"`
		Variables    map[string]interface{} `json:"variables"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	if strings.HasPrefix(input.BaseURL, "ws://") || strings.HasPrefix(input.BaseURL, "wss://") || strings.Contains(input.BaseURL, "fix://") {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "This API pattern isn't supported by the generic connector — WebSockets and FIX protocols require dedicated code.",
			"unsupported": true,
		})
		return
	}

	// Decrypt any credentials in authConfig
	if input.AuthConfig == nil {
		input.AuthConfig = make(map[string]interface{})
	}
	apiKey := ""
	if key, ok := input.AuthConfig["apiKey"].(string); ok {
		apiKey = key
	}
	if enc, ok := input.AuthConfig["apiKeyEnc"].(string); ok && enc != "" {
		dec, _ := crypto.Decrypt(enc)
		apiKey = dec
	}

	secretKey := ""
	if key, ok := input.AuthConfig["secretKey"].(string); ok {
		secretKey = key
	}
	if enc, ok := input.AuthConfig["secretKeyEnc"].(string); ok && enc != "" {
		dec, _ := crypto.Decrypt(enc)
		secretKey = dec
	}

	password := ""
	if pw, ok := input.AuthConfig["password"].(string); ok {
		password = pw
	}
	if enc, ok := input.AuthConfig["passwordEnc"].(string); ok && enc != "" {
		dec, _ := crypto.Decrypt(enc)
		password = dec
	}

	username := ""
	if user, ok := input.AuthConfig["username"].(string); ok {
		username = user
	}
	if enc, ok := input.AuthConfig["usernameEnc"].(string); ok && enc != "" {
		dec, _ := crypto.Decrypt(enc)
		username = dec
	}

	testConnector := CustomConnector{
		BaseURL:    input.BaseURL,
		AuthScheme: input.AuthScheme,
		AuthConfig: map[string]interface{}{
			"apiKey":    apiKey,
			"secretKey": secretKey,
			"password":  password,
			"username":  username,
			"algorithm": input.AuthConfig["algorithm"],
			"encoding":  input.AuthConfig["encoding"],
			"placement": input.AuthConfig["placement"],
			"signatureName": input.AuthConfig["signatureName"],
			"timestampName": input.AuthConfig["timestampName"],
			"messagePattern": input.AuthConfig["messagePattern"],
			"headerName": input.AuthConfig["headerName"],
			"paramName":  input.AuthConfig["paramName"],
		},
		Endpoints: input.Endpoints,
	}

	result, err := ExecuteCustomConnectorEndpoint(testConnector, input.EndpointName, input.Variables, nil)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success":     false,
			"error":       err.Error(),
			"explanation": "This API pattern isn't supported by the generic connector — dedicated code or a different auth schema/endpoint mapping would be needed.",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "result": result})
}

// ExecuteCustomConnectorEndpoint is the core REST mapping engine
func ExecuteCustomConnectorEndpoint(
	conn CustomConnector,
	endpointName string,
	variables map[string]interface{},
	rawRequestPayload interface{},
) (map[string]interface{}, error) {
	if variables == nil {
		variables = make(map[string]interface{})
	}

	endpointRaw, exists := conn.Endpoints[endpointName]
	if !exists {
		return nil, fmt.Errorf("endpoint '%s' is not defined in this custom connector configuration", endpointName)
	}

	endpoint, ok := endpointRaw.(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid endpoint configuration format for '%s'", endpointName)
	}

	method := "GET"
	if m, ok := endpoint["method"].(string); ok {
		method = strings.ToUpper(m)
	}

	pathTemplate := ""
	if p, ok := endpoint["path"].(string); ok {
		pathTemplate = p
	}

	resolvedPath := pathTemplate
	for k, v := range variables {
		placeholder := fmt.Sprintf("{%s}", k)
		resolvedPath = strings.ReplaceAll(resolvedPath, placeholder, fmt.Sprintf("%v", v))
	}

	baseURL := strings.TrimSuffix(conn.BaseURL, "/")
	fullURL := baseURL
	if !strings.HasPrefix(resolvedPath, "/") {
		fullURL += "/"
	}
	fullURL += resolvedPath

	authConfig := conn.AuthConfig
	if authConfig == nil {
		authConfig = make(map[string]interface{})
	}

	decryptedApiKey, _ := authConfig["apiKey"].(string)
	decryptedSecretKey, _ := authConfig["secretKey"].(string)
	decryptedUsername, _ := authConfig["username"].(string)
	decryptedPassword, _ := authConfig["password"].(string)

	headers := map[string]string{
		"Content-Type": "application/json",
		"Accept":       "application/json",
	}
	queryParams := make(map[string]string)

	bodyStr := ""
	if method == "POST" || method == "PUT" || method == "PATCH" {
		if rawRequestPayload != nil {
			bytesPayload, _ := json.Marshal(rawRequestPayload)
			bodyStr = string(bytesPayload)
		} else if bodyTemplate, ok := endpoint["bodyTemplate"].(string); ok && bodyTemplate != "" {
			temp := bodyTemplate
			for k, v := range variables {
				placeholder := fmt.Sprintf("{%s}", k)
				temp = strings.ReplaceAll(temp, placeholder, fmt.Sprintf("%v", v))
			}
			bodyStr = temp
		}
	}

	switch conn.AuthScheme {
	case "api_key_header":
		headerName := "X-API-KEY"
		if hn, ok := authConfig["headerName"].(string); ok && hn != "" {
			headerName = hn
		}
		headers[headerName] = decryptedApiKey

	case "api_key_query_param":
		paramName := "api_key"
		if pn, ok := authConfig["paramName"].(string); ok && pn != "" {
			paramName = pn
		}
		queryParams[paramName] = decryptedApiKey

	case "bearer_token":
		headers["Authorization"] = "Bearer " + decryptedApiKey

	case "basic_auth":
		pw := decryptedPassword
		if pw == "" {
			pw = decryptedApiKey
		}
		creds := decryptedUsername + ":" + pw
		headers["Authorization"] = "Basic " + base64.StdEncoding.EncodeToString([]byte(creds))

	case "hmac_signed":
		algo := "sha256"
		if a, ok := authConfig["algorithm"].(string); ok && a != "" {
			algo = a
		}
		hmacEncoding := "hex"
		if enc, ok := authConfig["encoding"].(string); ok && enc != "" {
			hmacEncoding = enc
		}
		signaturePlacement := "header"
		if p, ok := authConfig["placement"].(string); ok && p != "" {
			signaturePlacement = p
		}
		signatureName := "X-Signature"
		if sn, ok := authConfig["signatureName"].(string); ok && sn != "" {
			signatureName = sn
		}
		timestampName := "X-Timestamp"
		if tn, ok := authConfig["timestampName"].(string); ok && tn != "" {
			timestampName = tn
		}
		timestampVal := strconv.FormatInt(time.Now().UnixNano()/1e6, 10)

		messagePattern := "{timestamp}{method}{path}{body}"
		if pattern, ok := authConfig["messagePattern"].(string); ok && pattern != "" {
			messagePattern = pattern
		}

		msg := messagePattern
		msg = strings.ReplaceAll(msg, "{timestamp}", timestampVal)
		msg = strings.ReplaceAll(msg, "{method}", method)
		msg = strings.ReplaceAll(msg, "{path}", resolvedPath)
		msg = strings.ReplaceAll(msg, "{body}", bodyStr)

		var mac []byte
		if algo == "sha512" {
			h := hmac.New(sha512.New, []byte(decryptedSecretKey))
			h.Write([]byte(msg))
			mac = h.Sum(nil)
		} else {
			h := hmac.New(sha256.New, []byte(decryptedSecretKey))
			h.Write([]byte(msg))
			mac = h.Sum(nil)
		}

		signature := ""
		if hmacEncoding == "base64" {
			signature = base64.StdEncoding.EncodeToString(mac)
		} else {
			signature = hex.EncodeToString(mac)
		}

		if timestampName != "" {
			headers[timestampName] = timestampVal
		}

		if signaturePlacement == "header" {
			headers[signatureName] = signature
			if decryptedApiKey != "" {
				apiKeyHeader := "X-API-KEY"
				if hn, ok := authConfig["apiKeyHeaderName"].(string); ok && hn != "" {
					apiKeyHeader = hn
				}
				headers[apiKeyHeader] = decryptedApiKey
			}
		} else {
			queryParams[signatureName] = signature
			queryParams["timestamp"] = timestampVal
			if decryptedApiKey != "" {
				apiKeyQuery := "signature_key"
				if qn, ok := authConfig["apiKeyQueryName"].(string); ok && qn != "" {
					apiKeyQuery = qn
				}
				queryParams[apiKeyQuery] = decryptedApiKey
			}
		}
	}

	// Append query params to URL
	u, err := url.Parse(fullURL)
	if err != nil {
		return nil, err
	}
	q := u.Query()
	for k, v := range queryParams {
		q.Set(k, v)
	}
	u.RawQuery = q.Encode()
	fullURL = u.String()

	client := &http.Client{Timeout: 10 * time.Second}
	var reqBody io.Reader
	if bodyStr != "" {
		reqBody = bytes.NewBufferString(bodyStr)
	}

	req, err := http.NewRequest(method, fullURL, reqBody)
	if err != nil {
		return nil, err
	}

	for k, v := range headers {
		req.Header.Set(k, v)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("HTTP Error %d: %s", resp.StatusCode, string(respBytes))
	}

	var parsedJSON interface{}
	if err := json.Unmarshal(respBytes, &parsedJSON); err != nil {
		return nil, fmt.Errorf("response is not valid JSON. Raw output: %s", string(respBytes[:minInt(len(respBytes), 500)]))
	}

	mapping, _ := endpoint["mapping"].(map[string]interface{})
	result := map[string]interface{}{
		"_raw": parsedJSON,
	}

	for internalKey, externalPathRaw := range mapping {
		if externalPath, ok := externalPathRaw.(string); ok {
			result[internalKey] = GetNestedValue(parsedJSON, externalPath)
		}
	}

	return result, nil
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func GetNestedValue(obj interface{}, path string) interface{} {
	if path == "" || path == "$" {
		return obj
	}

	cleanPath := strings.TrimPrefix(path, "$")
	cleanPath = strings.TrimPrefix(cleanPath, ".")
	if cleanPath == "" {
		return obj
	}

	parts := strings.Split(cleanPath, ".")
	var current interface{} = obj

	reArray := regexp.MustCompile(`^([^\[]+)\[(\d+)\]$`)

	for _, part := range parts {
		if current == nil {
			return nil
		}

		matches := reArray.FindStringSubmatch(part)
		if len(matches) == 3 {
			base := matches[1]
			index, _ := strconv.Atoi(matches[2])

			m, ok := current.(map[string]interface{})
			if !ok {
				return nil
			}

			arr, exists := m[base]
			if !exists {
				return nil
			}

			slice, isSlice := arr.([]interface{})
			if !isSlice {
				return nil
			}

			if index >= 0 && index < len(slice) {
				current = slice[index]
			} else {
				return nil
			}
		} else {
			m, ok := current.(map[string]interface{})
			if !ok {
				return nil
			}

			val, exists := m[part]
			if !exists {
				return nil
			}
			current = val
		}
	}

	return current
}

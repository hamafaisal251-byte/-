import crypto from "crypto";
import { decrypt } from "../utils/crypto";

function getNestedValue(obj: any, pathStr: string): any {
  if (!pathStr) return obj;
  const parts = pathStr.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    const match = part.match(/^(\w+)(?:\[(\d+)\])?$/);
    if (match) {
      const key = match[1];
      const index = match[2];
      current = current[key];
      if (index !== undefined && Array.isArray(current)) {
        current = current[parseInt(index, 10)];
      }
    } else {
      current = current[part];
    }
  }
  return current;
}


export async function executeCustomConnectorEndpoint(
  connector: any,
  endpointName: string,
  variables: Record<string, any> = {},
  rawRequestPayload: any = null
) {
  const endpoints = connector.endpoints || {};
  const endpoint = endpoints[endpointName];
  if (!endpoint) {
    throw new Error(`Endpoint '${endpointName}' is not defined in this custom connector configuration.`);
  }

  const method = (endpoint.method || "GET").toUpperCase();
  let pathTemplate = endpoint.path || "";
  
  let resolvedPath = pathTemplate;
  for (const [key, val] of Object.entries(variables)) {
    resolvedPath = resolvedPath.replace(new RegExp(`{${key}}`, "g"), String(val));
  }

  const baseUrl = connector.base_url.replace(/\/$/, "");
  let fullUrl = `${baseUrl}${resolvedPath.startsWith("/") ? "" : "/"}${resolvedPath}`;

  const authScheme = connector.auth_scheme;
  const authConfig = connector.auth_config || {};
  
  const decryptedApiKey = authConfig.apiKeyEnc ? decrypt(authConfig.apiKeyEnc) : (authConfig.apiKey || "");
  const decryptedSecretKey = authConfig.secretKeyEnc ? decrypt(authConfig.secretKeyEnc) : (authConfig.secretKey || "");
  const decryptedUsername = authConfig.usernameEnc ? decrypt(authConfig.usernameEnc) : (authConfig.username || "");
  const decryptedPassword = authConfig.passwordEnc ? decrypt(authConfig.passwordEnc) : (authConfig.password || "");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json"
  };

  const queryParams: Record<string, string> = {};

  let bodyStr = "";
  if (["POST", "PUT", "PATCH"].includes(method)) {
    let finalPayload = rawRequestPayload;
    if (!finalPayload && endpoint.bodyTemplate) {
      let temp = endpoint.bodyTemplate;
      for (const [key, val] of Object.entries(variables)) {
        temp = temp.replace(new RegExp(`{${key}}`, "g"), String(val));
      }
      try {
        finalPayload = JSON.parse(temp);
      } catch (e) {
        bodyStr = temp;
      }
    }
    if (finalPayload) {
      bodyStr = JSON.stringify(finalPayload);
    }
  }

  if (authScheme === "api_key_header") {
    const headerName = authConfig.headerName || "X-API-KEY";
    headers[headerName] = decryptedApiKey;
  } else if (authScheme === "api_key_query_param") {
    const paramName = authConfig.paramName || "api_key";
    queryParams[paramName] = decryptedApiKey;
  } else if (authScheme === "bearer_token") {
    headers["Authorization"] = `Bearer ${decryptedApiKey}`;
  } else if (authScheme === "basic_auth") {
    const creds = `${decryptedUsername}:${decryptedPassword || decryptedApiKey}`;
    headers["Authorization"] = `Basic ${Buffer.from(creds).toString("base64")}`;
  } else if (authScheme === "hmac_signed") {
    const algo = authConfig.algorithm || "sha256";
    const hmacEncoding = authConfig.encoding || "hex";
    const signaturePlacement = authConfig.placement || "header";
    const signatureName = authConfig.signatureName || "X-Signature";
    const timestampName = authConfig.timestampName || "X-Timestamp";
    const timestampVal = String(Date.now());

    let messagePattern = authConfig.messagePattern || "{timestamp}{method}{path}{body}";
    let msg = messagePattern
      .replace("{timestamp}", timestampVal)
      .replace("{method}", method)
      .replace("{path}", resolvedPath)
      .replace("{body}", bodyStr);

    const signature = crypto
      .createHmac(algo, decryptedSecretKey)
      .update(msg)
      .digest(hmacEncoding as any);

    if (timestampName) {
      headers[timestampName] = timestampVal;
    }

    if (signaturePlacement === "header") {
      headers[signatureName] = signature;
      if (decryptedApiKey) {
        headers[authConfig.apiKeyHeaderName || "X-API-KEY"] = decryptedApiKey;
      }
    } else {
      queryParams[signatureName] = signature;
      queryParams["timestamp"] = timestampVal;
      if (decryptedApiKey) {
        queryParams[authConfig.apiKeyQueryName || "signature_key"] = decryptedApiKey;
      }
    }
  }

  const urlObj = new URL(fullUrl);
  for (const [k, v] of Object.entries(queryParams)) {
    urlObj.searchParams.append(k, v);
  }
  fullUrl = urlObj.toString();

  const fetchOptions: any = {
    method,
    headers
  };
  if (bodyStr) {
    fetchOptions.body = bodyStr;
  }

  const response = await fetch(fullUrl, fetchOptions);
  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP Error ${response.status}: ${responseText}`);
  }

  let parsedJson: any;
  try {
    parsedJson = JSON.parse(responseText);
  } catch (e) {
    throw new Error(`Response is not valid JSON. Raw output: ${responseText.substring(0, 500)}`);
  }

  const mapping = endpoint.mapping || {};
  const result: Record<string, any> = {
    _raw: parsedJson
  };

  for (const [internalKey, externalPath] of Object.entries(mapping)) {
    if (typeof externalPath === "string") {
      const extracted = getNestedValue(parsedJson, externalPath);
      result[internalKey] = extracted;
    }
  }

  return result;
}


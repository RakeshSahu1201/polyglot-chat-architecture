package media

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"strings"
)

type Asset struct {
	ID           string `json:"id"`
	CID          string `json:"cid"`
	MediaURL     string `json:"media_url"`
	GatewayURL   string `json:"gateway_url"`
	MimeType     string `json:"mime_type"`
	OriginalName string `json:"original_name"`
	SizeBytes    int64  `json:"size_bytes"`
	Kind         string `json:"kind"`
	UploadedBy   string `json:"uploaded_by"`
}

type UploadParams struct {
	AuthHeader string
	FileName   string
	Reader     io.Reader
	Fields     map[string]string
}

func serviceURL() string {
	if url := os.Getenv("MEDIA_SERVICE_URL"); url != "" {
		return strings.TrimRight(url, "/")
	}
	return "http://127.0.0.1:5000"
}

func Upload(ctx context.Context, params UploadParams) (*Asset, error) {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)

	part, err := writer.CreateFormFile("media", params.FileName)
	if err != nil {
		return nil, fmt.Errorf("media Upload create form file: %w", err)
	}

	if _, err := io.Copy(part, params.Reader); err != nil {
		return nil, fmt.Errorf("media Upload copy file: %w", err)
	}

	for key, value := range params.Fields {
		if err := writer.WriteField(key, value); err != nil {
			return nil, fmt.Errorf("media Upload write field %s: %w", key, err)
		}
	}

	if err := writer.Close(); err != nil {
		return nil, fmt.Errorf("media Upload close writer: %w", err)
	}

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		serviceURL()+"/media/upload",
		&body,
	)
	if err != nil {
		return nil, fmt.Errorf("media Upload build request: %w", err)
	}

	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("X-Source-Service", "go")
	if params.AuthHeader != "" {
		req.Header.Set("Authorization", params.AuthHeader)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("media Upload request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= http.StatusBadRequest {
		payload, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("media Upload failed: %s", strings.TrimSpace(string(payload)))
	}

	var asset Asset
	if err := json.NewDecoder(resp.Body).Decode(&asset); err != nil {
		return nil, fmt.Errorf("media Upload decode response: %w", err)
	}

	return &asset, nil
}

func Unpin(ctx context.Context, cid string) error {
	if cid == "" {
		return nil
	}

	if jwt := os.Getenv("PINATA_JWT"); jwt != "" {
		req, err := http.NewRequestWithContext(
			ctx,
			http.MethodDelete,
			"https://api.pinata.cloud/pinning/unpin/"+cid,
			nil,
		)
		if err != nil {
			return fmt.Errorf("media Unpin build Pinata request: %w", err)
		}
		req.Header.Set("Authorization", "Bearer "+jwt)

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			return fmt.Errorf("media Unpin Pinata request failed: %w", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode >= http.StatusBadRequest {
			payload, _ := io.ReadAll(resp.Body)
			return fmt.Errorf("media Unpin Pinata failed: %s", strings.TrimSpace(string(payload)))
		}
		return nil
	}

	ipfsURL := os.Getenv("IPFS_API_URL")
	if ipfsURL == "" {
		return fmt.Errorf("media Unpin: neither PINATA_JWT nor IPFS_API_URL is configured")
	}

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		strings.TrimRight(ipfsURL, "/")+"/api/v0/pin/rm?arg="+cid,
		nil,
	)
	if err != nil {
		return fmt.Errorf("media Unpin build IPFS request: %w", err)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("media Unpin IPFS request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= http.StatusBadRequest {
		payload, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("media Unpin IPFS failed: %s", strings.TrimSpace(string(payload)))
	}

	return nil
}

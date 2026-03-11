package channels

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
)

// GenerateInviteCode produces a URL-safe random 8-byte hex string.
func GenerateInviteCode() (string, error) {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("GenerateInviteCode: %w", err)
	}
	return hex.EncodeToString(b), nil
}

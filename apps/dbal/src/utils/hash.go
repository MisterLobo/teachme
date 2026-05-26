package utils

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/sha512"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/gofiber/fiber/v3/log"
	"github.com/google/uuid"
	"github.com/hashicorp/vault-client-go"
	"github.com/hashicorp/vault-client-go/schema"
	"github.com/redis/go-redis/v9"
	"golang.org/x/crypto/argon2"
)

type PasswordParams struct {
	Memory      uint32
	Iterations  uint32
	Parallelism uint8
	SaltLength  uint32
	KeyLength   uint32
}

func CreateHashedPassword(password string, p *PasswordParams) (string, error) {
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	hash := argon2.IDKey(
		[]byte(password),
		salt,
		p.Iterations,
		p.Memory,
		p.Parallelism,
		p.KeyLength,
	)
	salt64 := base64.RawStdEncoding.EncodeToString(salt)
	hash64 := base64.RawStdEncoding.EncodeToString(hash)
	enc := fmt.Sprintf("$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s", argon2.Version, p.Memory, p.Iterations, p.Parallelism, salt64, hash64)
	return enc, nil
}

func decodeHash(encoded string) (p *PasswordParams, salt, hash []byte, err error) {
	vals := strings.Split(encoded, "$")
	if len(vals) != 6 {
		return nil, nil, nil, errors.New("invalid hash")
	}

	var version int
	_, err = fmt.Sscanf(vals[2], "v=%d", &version)
	if err != nil {
		return nil, nil, nil, err
	}
	if version != argon2.Version {
		return nil, nil, nil, errors.New("incompatible version")
	}

	p = &PasswordParams{}
	_, err = fmt.Sscanf(vals[3], "m=%d,t=%d,p=%d", &p.Memory, &p.Iterations, &p.Parallelism)
	if err != nil {
		return nil, nil, nil, err
	}

	salt, err = base64.RawStdEncoding.Strict().DecodeString(vals[4])
	if err != nil {
		return nil, nil, nil, err
	}
	p.SaltLength = uint32(len(salt))

	hash, err = base64.RawStdEncoding.Strict().DecodeString(vals[5])
	if err != nil {
		return nil, nil, nil, err
	}
	p.KeyLength = uint32(len(hash))

	return p, salt, hash, nil
}

func VerifyPassword(password string, encoded string) (bool, error) {
	p, salt, hash, err := decodeHash(encoded)
	if err != nil {
		return false, err
	}
	otherHash := argon2.IDKey(
		[]byte(password),
		salt,
		p.Iterations,
		p.Memory,
		p.Parallelism,
		p.KeyLength,
	)
	return subtle.ConstantTimeCompare(hash, otherHash) == 1, nil
}

func HashSumFromString(s string) string {
	h := sha256.New()
	h.Write([]byte(s))
	hs := h.Sum(nil)
	shas := base64.RawStdEncoding.EncodeToString(hs)
	return shas
}

func HashSumFromMap(m map[string]any) string {
	marsh, _ := json.Marshal(m)
	h := sha256.New()
	h.Write([]byte(marsh))
	hs := h.Sum(nil)
	shas := base64.RawStdEncoding.EncodeToString(hs)
	return shas
}

func Hash(b []byte) string {
	h := sha512.New()
	h.Write(b)
	hs := h.Sum(nil)
	shas := base64.RawStdEncoding.EncodeToString(hs)
	return shas
}

type IdempotencyKeyOpts struct {
	SecretsManager *vault.Client
	Storage        *redis.Client
	Metadata       *map[string]any
}

func NewIdempotencyKey(ctx context.Context, domain string, id uuid.UUID, data []byte, opts *IdempotencyKeyOpts) (*map[string]any, error) {
	if opts.SecretsManager == nil {
		return nil, errors.New("SecretsManager must be provided")
	}
	/* if opts.Storage == nil {
		return nil, errors.New("Storage must be provided")
	} */
	if domain == "" || len(strings.Trim(domain, " ")) == 0 {
		return nil, errors.New("domain must not be empty")
	}
	v := opts.SecretsManager
	sig, err := v.Secrets.TransitSignWithAlgorithm(ctx, "idempotency_key", "sha3-512", schema.TransitSignWithAlgorithmRequest{
		HashAlgorithm: "sha3-512",
	})
	if err != nil {
		log.Errorf("Failed to generate idempotency key: %v", err)
		return nil, err
	}
	log.Infof("SIGNED: %v", sig)

	return &sig.Data, nil
}

func VerifyIdempotencyKey(ctx context.Context) {}

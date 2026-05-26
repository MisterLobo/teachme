package lib

import (
	"context"
	"log"
	"net/http"
	"os"

	"github.com/hashicorp/vault-client-go"
	"github.com/hashicorp/vault-client-go/schema"
)

var vaultClient *vault.Client

func GetVault(ctx context.Context) (*vault.Client, error) {
	if vaultClient != nil {
		return vaultClient, nil
	}
	config := vault.DefaultConfiguration()

	opt := vault.WithConfiguration(config)
	addr := vault.WithAddress(os.Getenv("VAULT_API_HOST"))
	tlsconf := vault.TLSConfiguration{
		ServerCertificate: vault.ServerCertificateEntry{
			FromFile: os.Getenv("CA_PEM_FILE"),
		},
		ClientCertificate: vault.ClientCertificateEntry{
			FromFile: os.Getenv("CERT_PEM_FILE"),
		},
		ClientCertificateKey: vault.ClientCertificateKeyEntry{
			FromFile: os.Getenv("CERT_KEY_FILE"),
		},
	}
	tls := vault.WithTLS(tlsconf)
	client, err := vault.New(opt, addr, tls)
	if err != nil {
		log.Fatalf("[vault] server unreachable: %v", err)
		return nil, err
	}
	log.Println("[vault]: connection established!")
	vaultClient = client
	vaultTest()
	createKeys(ctx)
	return client, nil
}

func createKeys(ctx context.Context) error {
	if _, err := vaultClient.Secrets.TransitCreateKey(ctx, "idempotency_key", schema.TransitCreateKeyRequest{
		Type: "ed25519",
	}); err != nil {
		log.Printf("KEY: error creating key: %v", err)
	}
	if _, err := vaultClient.Secrets.TransitCreateKey(ctx, "jwt_key", schema.TransitCreateKeyRequest{
		Type: "ed25519",
	}); err != nil {
		log.Printf("KEY: error creating key: %v", err)

	}
	if _, err := vaultClient.Secrets.TransitCreateKey(ctx, "webhook_key", schema.TransitCreateKeyRequest{
		Type: "ed25519",
	}); err != nil {
		log.Printf("KEY: error creating key: %v", err)
	}
	if _, err := vaultClient.Secrets.TransitCreateKey(ctx, "snapshot_key", schema.TransitCreateKeyRequest{
		Type: "ed25519",
	}); err != nil {
		log.Printf("KEY: error creating key: %v", err)
	}
	if _, err := vaultClient.Secrets.TransitCreateKey(ctx, "kek", schema.TransitCreateKeyRequest{
		Type: "aes256-gcm96",
	}); err != nil {
		log.Printf("KEY: error creating key: %v", err)
	}
	if _, err := vaultClient.Secrets.TransitCreateKey(ctx, "passkey_token", schema.TransitCreateKeyRequest{
		Type:    "aes256-gcm96",
		Derived: true,
	}); err != nil {
		log.Printf("KEY: error creating key: %v", err)
	}
	return nil
}

func CreateKey(ctx context.Context, name string, alg string) error {
	if _, err := vaultClient.Secrets.TransitCreateKey(ctx, name, schema.TransitCreateKeyRequest{
		Type: alg,
	}); err != nil {
		log.Printf("KEY: error creating key: %v", err)
	}
	return nil
}

func vaultTest() {
	vc := vaultClient
	vc.SetToken("root_token")
	_, err := vc.Write(context.Background(), "/cubbyhole/abc123", map[string]any{"password": "abc123"}, vault.WithResponseCallbacks(func(r1 *http.Request, r2 *http.Response) {}))
	if err != nil {
		log.Fatalf("unable to write secret: %v", err)
	}
	log.Println("secret written succesfully!")

	secret, err := vc.Read(context.Background(), "/cubbyhole/abc123")
	if err != nil {
		log.Fatalf("unable to read secret: %v", err)
	}
	value, ok := secret.Data["password"].(string)
	if !ok {
		log.Fatalf("value type assertion failed: %T %#v", secret.Data["password"], secret.Data["password"])
	}
	log.Println("value is ", value)
}

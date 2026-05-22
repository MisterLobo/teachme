package utils

import (
	"crypto/tls"
	"crypto/x509"
	"log"
	"os"
)

func GetTLSConfig() (*tls.Config, error) {
	clientCert, err := tls.LoadX509KeyPair(os.Getenv("CERT_PEM_FILE"), os.Getenv("CERT_KEY_FILE"))
	if err != nil {
		log.Printf("failed to create credentials: %v\n", err)
		return nil, err
	}
	caCert, err := os.ReadFile(os.Getenv("CA_PEM_FILE"))
	if err != nil {
		log.Printf("error while reading CA cert file: %v\n", err)
		return nil, err
	}
	caPool := x509.NewCertPool()
	caPool.AppendCertsFromPEM(caCert)
	tlsConfig := &tls.Config{
		ClientAuth:   tls.RequireAndVerifyClientCert,
		ClientCAs:    caPool,
		Certificates: []tls.Certificate{clientCert},
		RootCAs:      caPool,
	}
	return tlsConfig, nil
}

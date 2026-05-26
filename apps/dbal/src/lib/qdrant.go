package lib

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"os"

	"github.com/gofiber/fiber/v3/log"
	tutorpb "github.com/misterlobo/teachme/generated/v1/tutor"
	"github.com/qdrant/go-client/qdrant"
)

var client *qdrant.Client

func GetQdrantClient(ctx context.Context) (*qdrant.Client, error) {
	if client != nil {
		return client, nil
	}
	// clientCert, err := tls.LoadX509KeyPair("certificates/localhost.pem", "certificates/localhost-key.pem")
	clientCert, err := tls.LoadX509KeyPair("certs/new/localhost.san.pem", "certs/new/san-key.pem")
	if err != nil {
		log.Fatalf("failed to create credentials: %v", err)
	}
	// caCert, _ := os.ReadFile("certificates/rootCA.pem")
	caCert, _ := os.ReadFile("certs/new/ca.pem")
	caPool := x509.NewCertPool()
	caPool.AppendCertsFromPEM(caCert)
	tlsConfig := &tls.Config{
		ClientAuth:   tls.RequireAndVerifyClientCert,
		ClientCAs:    caPool,
		Certificates: []tls.Certificate{clientCert},
	}
	_c, err := qdrant.NewClient(&qdrant.Config{
		Host:      "localhost",
		Port:      6334,
		APIKey:    os.Getenv("QDRANT_API_KEY"),
		UseTLS:    true,
		TLSConfig: tlsConfig,
	})
	if err != nil {
		log.Errorf("[qdrant] connection error: %v", err)
		return nil, err
	}
	log.Info("[qdrant] connection established!")
	coll, err := _c.ListCollections(ctx)
	if err != nil {
		log.Fatalf("[qdrant] reading collections: %v", err)
	}
	if len(coll) == 0 {
		if err := _c.CreateCollection(ctx, &qdrant.CreateCollection{
			CollectionName: "tutors",
			VectorsConfig: qdrant.NewVectorsConfigMap(map[string]*qdrant.VectorParams{
				"data": {
					Size:     384,
					Distance: qdrant.Distance_Cosine,
				},
			}),
		}); err != nil {
			log.Fatalf("[QDRANT] error executing command: %v", err)
		}
	}
	client = _c
	return _c, nil
}

func vectorTest(ctx context.Context, qc *qdrant.Client) {

}

func VectorQueryTutors(ctx context.Context, in *tutorpb.TutorSearchResponse) ([]*qdrant.ScoredPoint, error) {
	return client.Query(ctx, &qdrant.QueryPoints{
		CollectionName: "tutors",
		Query:          qdrant.NewQuery(in.Embedding...),
		Filter: &qdrant.Filter{
			Should: []*qdrant.Condition{
				qdrant.NewMatchTextAny("categories", in.GetCategory()),
				qdrant.NewMatchTextAny("subjects", in.GetSubject()),
				qdrant.NewMatchTextAny("currency", in.GetCurrency()),
				qdrant.NewMatchTextAny("bio", ""),
				qdrant.NewMatchTextAny("timezone", in.GetTimezone()),
				// qdrant.NewMatchTextAny("country", in.GetCo),
			},
		},
		WithPayload: qdrant.NewWithPayload(true),
	})
}

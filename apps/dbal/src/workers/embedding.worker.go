package workers

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"time"

	"github.com/gofiber/fiber/v3/log"
	"github.com/google/uuid"
	"github.com/hibiken/asynq"
	embeddingpb "github.com/misterlobo/teachme/generated/v1/embedding"
	"github.com/misterlobo/teachme/src/db"
	"github.com/misterlobo/teachme/src/lib"
	"github.com/misterlobo/teachme/src/models"
	"github.com/misterlobo/teachme/src/utils"
	"github.com/neo4j/neo4j-go-driver/v6/neo4j"
	"github.com/pgvector/pgvector-go"
	"github.com/qdrant/go-client/qdrant"
	"github.com/uptrace/bun"
	"golang.org/x/sync/errgroup"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/metadata"
	"google.golang.org/protobuf/encoding/protojson"
)

const (
	TutorEmbeddingsCreate = "tutor.embedding.create"
	StudentEmbeddingCrate = "student.embedding.create"
)

type TutorEmbeddingCreateWorkerArgs struct {
	User           models.UserCreated
	StateCacheKey  string
	workerCacheKey string
}
type TutorEmbeddingCreateWorker struct {
	Name string
}

func (s *TutorEmbeddingCreateWorker) HandleWork(ctx context.Context, t *asynq.Task) error {
	var p *TutorEmbeddingCreateWorkerArgs

	if err := json.Unmarshal(t.Payload(), &p); err != nil {
		return fmt.Errorf("json.Unmarshal failed: %v", err)
	}
	pid := p.User.PID.String()
	log.Infof("[%s] Received message from %s", s.Name, pid)

	rc := lib.GetRedisClient(ctx)
	cacheKey := fmt.Sprintf("worker:{%s}", pid)
	stateCacheKey := p.StateCacheKey
	workerState := rc.Get(ctx, stateCacheKey).Val()
	log.Info("---------------------------------------------------")
	log.Infof("[%s] WORKER STATE: %s", s.Name, workerState)
	log.Info("---------------------------------------------------")
	/* if workerState == "" {
		rc.Set(ctx, stateCacheKey, "CREATED", 0)
	} */
	jid := rc.JSONGet(ctx, cacheKey, "$.jobID").Val()
	jobID, _ := uuid.Parse(jid)
	j := rc.JSONGet(ctx, cacheKey, "$.data").Val()
	var data []*models.UserCreated
	err := json.Unmarshal([]byte(j), &data)
	if err != nil {
		slog.Error("[worker] failed to deserialize json: ", "error", err.Error(), "worker", s.Name, "job_id", jobID)
		return err
	}
	uc := data[0]
	log.Infof("[%s] user from redis: %v", s.Name, uc)

	var categories string
	if uc.Tutor.Categories != nil {
		categories = *uc.Tutor.Categories
	}
	var subjects string
	if uc.Tutor.Subjects != nil {
		subjects = *uc.Tutor.Subjects
	}
	var bio string
	if uc.Tutor.Bio != nil {
		bio = *uc.Tutor.Bio
	}
	var language string
	if uc.Tutor.PrimaryLanguage != nil {
		language = *uc.Tutor.PrimaryLanguage
	}

	// p.StateCacheKey = stateCacheKey
	if workerState == "DONE" {
		log.Infof("WORKER IS DONE. NOTHING TO DO")
		return nil
	}
	log.Infof("[%s] CHANGE STATE TO: ----------------> PENDING <-----------------", s.Name)
	workerState = "PENDING"
	rc.Set(ctx, stateCacheKey, "PENDING", 0)
	// var reply *embeddingpb.EmbeddingCreateResponse
	tlsConf, err := utils.GetTLSConfig()
	creds := credentials.NewTLS(tlsConf)
	if err != nil {
		log.Fatalf("failed to create credentials: %v", err)
	}
	retryPolicy := `{
		"methodConfig": [{
		  "name": [{"service": "grpc.teachme.echo.Echo"}],
		  "retryPolicy": {
			  "MaxAttempts": 4,
			  "InitialBackoff": ".01s",
			  "MaxBackoff": ".01s",
			  "BackoffMultiplier": 1.0,
			  "RetryableStatusCodes": [ "UNAVAILABLE" ]
		  }
		}]}`
	conn, err := grpc.NewClient(
		os.Getenv("AI_SERVICE_HOST"),
		grpc.WithTransportCredentials(creds),
		grpc.WithDefaultServiceConfig(retryPolicy),
	)
	if err != nil {
		log.Errorf("did not connect: %v", err)
	}
	defer func() {
		if e := conn.Close(); e != nil {
			log.Errorf("failed to close connection: %s", e)
		}
	}()
	cli := embeddingpb.NewEmbeddingServiceClient(conn)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	log.Infof("input: %v", p)
	documents := fmt.Sprintf(`
		categories: %s,
		subjects: %s,
		country: %s,
		currency: %s,
		bio: %s,
		session_price: %d,
		language: %s,
		session_duration: %d
		`,
		categories,
		subjects,
		uc.Tutor.Country,
		uc.Tutor.Currency,
		bio,
		uc.Tutor.SessionPrice,
		language,
		uc.Tutor.SessionDuration,
	)
	token := rc.Get(ctx, fmt.Sprintf("%s:auth:token", uc.PID)).Val()
	md := metadata.Pairs(
		"authorization", fmt.Sprintf("Bearer %s", token),
	)
	ctx = metadata.NewOutgoingContext(ctx, md)

	reply, err := cli.Create(ctx, &embeddingpb.EmbeddingCreate{Documents: documents})
	proto, _ := protojson.Marshal(reply)
	rc.JSONSet(ctx, cacheKey, "$.embed", proto)
	rc.Expire(ctx, cacheKey, 30*time.Minute)
	if err != nil {
		log.Errorf("service.Create returned error: %v", err)
	}
	log.Infof("[%s] CHANGE STATE TO: ----------------> EMBEDDING_DONE <-----------------", s.Name)
	workerState = "EMBEDDING_DONE"
	rc.Set(ctx, stateCacheKey, "EMBEDDING_DONE", 0)

	db := db.GetDb()
	uid := uc.PID
	db = db.WithNamedArg("PID", uid)
	if err := db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		if _, err := tx.ExecContext(ctx, `
		SELECT set_rls_context(?);
	`, uid); err != nil {
			return err
		}
		log.Infof("INSERTING NEW EMBEDDING FOR TUTOR %s", uc.Tutor.ID)
		embedding := &models.TutorEmbedding{
			ID: uc.Tutor.ID,
			Embedding: []pgvector.Vector{
				pgvector.NewVector(reply.GetEmbedding()),
			},
		}
		if _, err := tx.NewInsert().Model(embedding).Exec(ctx); err != nil {
			return err
		}

		return nil
	}); err != nil {
		return err
	}
	log.Infof("[%s] CHANGE STATE TO: ----------------> DB_DONE <-----------------", s.Name)
	workerState = "DB_DONE"
	rc.Set(ctx, stateCacheKey, "DB_DONE", 0)

	payload := map[string]any{
		"id":              uc.Tutor.ID.String(),
		"name":            fmt.Sprintf("%s %s", uc.Tutor.FirstName, uc.Tutor.LastName),
		"categories":      categories,
		"subjects":        subjects,
		"country":         uc.Tutor.Country,
		"currency":        uc.Tutor.Currency,
		"bio":             bio,
		"sessionPrice":    uc.Tutor.SessionPrice,
		"language":        language,
		"sessionDuration": uc.Tutor.SessionDuration,
		"timezone":        uc.Tutor.Timezone,
	}
	timeout, cancel := context.WithTimeout(ctx, 5*time.Minute)
	g, ctx := errgroup.WithContext(timeout)
	defer cancel()

	g.Go(func() error {
		return s.pushToGraphDb(ctx, p, payload)
	})
	g.Go(func() error {
		return s.pushToVectorDb(ctx, p, reply, payload)
	})

	if err := g.Wait(); err != nil {
		log.Errorf("[%s] an error was caught: %v", s.Name, err)
		return err
	}

	log.Infof("[%s] CHANGE STATE TO: ----------------> DONE <-----------------", s.Name)
	workerState = "DONE"
	rc.Set(ctx, stateCacheKey, "DONE", 5*time.Minute)

	return nil
}

func (s *TutorEmbeddingCreateWorker) pushToVectorDb(ctx context.Context, args *TutorEmbeddingCreateWorkerArgs, emb *embeddingpb.EmbeddingCreateResponse, payload map[string]any) error {
	rc := lib.GetRedisClient(ctx)
	/* workerState := rc.Get(ctx, args.StateCacheKey).Val()
	if workerState == "DONE" {
		log.Infof("[%s] worker has finished", s.Name)
		return nil
	}
	if workerState != "GRAPH_DONE" {
		return fmt.Errorf("[%s] state mismatched: expected %s got %s", s.Name, "GRAPH_DONE", workerState)
	} */
	if len(emb.GetEmbedding()) == 0 {
		log.Errorf("[%s] embedding is empty", s.Name)
	}
	log.Infof("[%s] embedding len: %d", s.Name, len(emb.GetEmbedding()))
	uc := args.User
	qd, _ := lib.GetQdrantClient(ctx)
	marsh, err := json.Marshal(uc.Tutor)
	if err != nil {
		log.Errorf("[%s] could not serialize Tutor data: %v", s.Name, err)
		return err
	}
	m := make(map[string]any)
	if err := json.Unmarshal(marsh, &m); err != nil {
		log.Errorf("[%s] could not marshal to map from struct: %v", s.Name, err)
		return err
	}
	first := emb.GetEmbedding()[0]
	log.Infof("FIRST ELEMENT OF VECTOR: %.2f", first)
	embedding := make([]float32, 0)
	embedding = append(embedding, emb.GetEmbedding()...)
	if _, err := qd.Upsert(ctx, &qdrant.UpsertPoints{
		CollectionName: "tutors",
		Points: []*qdrant.PointStruct{
			{
				Id: qdrant.NewIDUUID(uc.Tutor.ID.String()),
				Vectors: qdrant.NewVectorsMap(map[string]*qdrant.Vector{
					"data": qdrant.NewVector(embedding...),
				}),
				Payload: qdrant.NewValueMap(payload),
			},
		},
		Wait: utils.BoolPtr(true),
	}); err != nil {
		log.Errorf("[%s] failed to save vector points: %v", s.Name, err)
		return err
	}
	log.Infof("[%s] CHANGE STATE TO: ----------------> VEC_DONE <-----------------", s.Name)
	rc.Set(ctx, args.StateCacheKey, "VEC_DONE", 0)

	return nil
}

func (s *TutorEmbeddingCreateWorker) pushToGraphDb(ctx context.Context, args *TutorEmbeddingCreateWorkerArgs, payload map[string]any) error {
	rc := lib.GetRedisClient(ctx)
	/* workerState := rc.Get(ctx, args.StateCacheKey).Val()
	if workerState == "DONE" {
		log.Infof("[%s] worker has finished", s.Name)
		return nil
	}
	if workerState != "DB_DONE" {
		return fmt.Errorf("[%s] state mismatched: expected %s got %s", s.Name, "DB_DONE", workerState)
	} */
	graph, _ := lib.GetGraphDb(ctx)
	log.Infof("GRAPH CONNECTION IS ENCRYPTED: %v", (*graph).IsEncrypted())
	sess := (*graph).NewSession(ctx, neo4j.SessionConfig{
		AccessMode: neo4j.AccessModeWrite,
	})
	defer sess.Close(ctx)

	if _, err := sess.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		rows := make([]map[string]any, 1)
		rows[0] = payload

		_, err := tx.Run(ctx, `
			UNWIND $rows AS row
			MERGE (t:Tutor {id:row.id})
			SET t.name = row.name,
					t.country = row.country,
					t.currency = row.currency,
					t.session_price = row.session_price,
					t.session_duration = row.session_duration,
					t.primary_language = row.primary_language,
					t.categories = row.categories,
					t.subjects = row.subjects,
					t.bio = row.bio,
					t.rating = row.rating
		`, map[string]any{
			"rows": rows,
		})

		return nil, err
	}); err != nil {
		return err
	}
	log.Infof("[%s] CHANGE STATE TO: ----------------> GRAPH_DONE <-----------------", s.Name)
	rc.Set(ctx, args.StateCacheKey, "GRAPH_DONE", 5*time.Minute)

	/* result, err := neo4j.ExecuteQuery(
		ctx,
		*graph,
		`
		CREATE (a:Tutor {name: $name, country: $country, currency: $currency, sessionPrice: $session_price, sessionDuration: $session_duration, primaryLanguage: $primary_language, categories, $categories, subjects: $subjects, bio: $bio, rating: $rating})
		`,
		map[string]any{
			"name":             fmt.Sprintf("%s %s", uc.Tutor.FirstName, uc.Tutor.LastName),
			"country":          "uc.Tutor.Country",
			"currency":         "uc.Tutor.Currency",
			"session_price":    "uc.Tutor.SessionPrice",
			"session_duration": "uc.Tutor.SessionDuration",
			"primary_language": "uc.Tutor.PrimaryLanguage",
			"categories":       "uc.Tutor.Categories",
			"subjects":         "uc.Tutor.Subjects",
			"bio":              "uc.Tutor.Bio",
			"rating":           "uc.Tutor.AverageRating",
		},
		neo4j.EagerResultTransformer,
	)
	if err != nil {
		log.Fatalf("Failed to execute query: %s\n", err.Error())
	}
	summary := result.Summary
	log.Infof("Created %v nodes in %+v.\n", summary.Counters().NodesCreated(), summary.ResultAvailableAfter()) */

	return nil
}

type StudentEmbeddingCreateWorkerArgs struct {
	User models.UserCreated
}
type StudentEmbeddingCreateWorker struct {
	Name string
}

func (s *StudentEmbeddingCreateWorker) HandleWork(ctx context.Context, t *asynq.Task) error {
	var p *StudentEmbeddingCreateWorkerArgs

	if err := json.Unmarshal(t.Payload(), &p); err != nil {
		return fmt.Errorf("json.Unmarshal failed: %v", err)
	}
	pid := p.User.PID.String()
	log.Infof("[%s] Received message from %s", s.Name, pid)

	cacheKey := fmt.Sprintf("worker:{%s}", pid)
	rc := lib.GetRedisClient(ctx)
	jid := rc.JSONGet(ctx, cacheKey, "$.jobID").Val()
	jobID, _ := uuid.Parse(jid)
	j := rc.JSONGet(ctx, cacheKey, "$.data").Val()
	var data []*models.UserCreated
	err := json.Unmarshal([]byte(j), &data)
	if err != nil {
		slog.Error("[worker] failed to deserialize json: ", "error", err.Error(), "worker", s.Name, "job_id", jobID)
		return err
	}
	uc := data[0]
	log.Infof("[%s] user from redis: %v", s.Name, uc)

	db := db.GetDb()
	uid := uc.PID
	db = db.WithNamedArg("PID", uid)

	if err := db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		return nil
	}); err != nil {
		return err
	}

	graph, _ := lib.GetGraphDb(ctx)
	result, err := neo4j.ExecuteQuery(
		ctx,
		*graph,
		`
		CREATE (a:Student {name: $name, country: $country, currency: $currency, sessionPrice: $session_price, sessionDuration: $session_duration, primaryLanguage: $primary_language, categories, $categories, subjects: $subjects, bio: $bio, rating: $rating})
		`,
		map[string]any{
			"name":             fmt.Sprintf("%s %s", uc.Student.FirstName, uc.Student.LastName),
			"country":          uc.Student.Country,
			"currency":         uc.Student.Currency,
			"primary_language": uc.Student.Language,
			"local":            uc.Student.Country,
			"timezone":         uc.Student.Timezone,
			"budget":           uc.Student.Preferences.Budget,
			"interests":        uc.Student.Preferences.Interests,
			"time_preferences": uc.Student.Preferences.TimePreferences,
		},
		neo4j.EagerResultTransformer,
	)
	if err != nil {
		log.Errorf("Failed to execute query: %s\n", err.Error())
		return err
	}
	summary := result.Summary
	log.Infof("Created %v nodes in %+v.\n", summary.Counters().NodesCreated(), summary.ResultAvailableAfter())

	return nil
}

package services

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/gofiber/fiber/v3/log"
	"github.com/google/uuid"
	"github.com/hibiken/asynq"
	"github.com/qdrant/go-client/qdrant"
	"github.com/redis/go-redis/v9"
	"github.com/sony/gobreaker/v2"
	"github.com/uptrace/bun"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/status"

	tutorpb "github.com/misterlobo/teachme/generated/v1/tutor"
	"github.com/misterlobo/teachme/src/db"
	"github.com/misterlobo/teachme/src/lib"
	"github.com/misterlobo/teachme/src/models"
	"github.com/misterlobo/teachme/src/utils"
	"google.golang.org/grpc/metadata"
)

type TutorServer struct {
	tutorpb.UnimplementedTutorServiceServer
}

func (s *TutorServer) GetById(ctx context.Context, in *tutorpb.TutorGetById) (*tutorpb.TutorResponse, error) {
	return &tutorpb.TutorResponse{}, nil
}

func (s *TutorServer) GetPublicKey(ctx context.Context, in *tutorpb.TutorGetPublicKeyRequest) (*tutorpb.TutorGetPublicKeyResponse, error) {
	pid := ctx.Value("pid")

	var tutor models.Tutor
	devices := make([]models.Device, 0)
	userKeys := make([]models.UserKey, 0)
	db := db.GetDb()
	if err := db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		if _, err := tx.ExecContext(ctx, `
			SELECT set_rls_context(?);
		`, pid); err != nil {
			return err
		}
		sid, err := models.GetTxSession(ctx, &tx)
		if err != nil {
			return err
		}
		log.Infof("TxSessionID: %#v", sid)
		tx.ExecContext(ctx, `
			SET LOCAL app.user_id = ?;
			SET LOCAL ROLE service_role;
		`, sid.UserID)

		tutors := make([]models.Tutor, 0)
		if err := tx.NewSelect().
			Model(&tutors).
			Relation("Tenant").
			Relation("Tenant.Owner").
			Relation("Tenant.Owner.Devices").
			Where("tutor.id = ?", in.Id).
			Scan(ctx, &tutor); err != nil {
			return err
		}
		if err := tx.NewSelect().
			Model(&models.Device{}).
			Where("user_id = ?", tutor.Tenant.OwnerID).
			Scan(ctx, &devices); err != nil {
			return err
		}
		if err := tx.NewSelect().Model(&models.UserKey{}).Where("user_id = ?", tutor.Tenant.OwnerID).Scan(ctx, &userKeys); err != nil {
			return err
		}
		return nil
	}); err != nil {
		log.Errorf("[TUTOR] error: %v", err)
		return nil, status.Error(codes.NotFound, "not found")
	}
	log.Infof("[TUTOR] id=%s tenantID=%s userID=%s", tutor.ID, tutor.TenantID, tutor.Tenant.OwnerID)
	// devices := tutor.Tenant.Owner.Devices
	log.Infof("[TUTOR] %d public keys", len(devices))
	pk := tutor.Tenant.Owner.SecurityManifest.PublicKey
	log.Infof("[TUTOR] public key: %s %d", pk, len(pk))
	pubKeyRSA, err := json.Marshal(pk)
	if err != nil {
		log.Errorf("[TUTOR] error: %v", err)
		return nil, status.Error(codes.NotFound, "not found")
	}
	pubKeys := make([]*tutorpb.TutorGetPublicKeyResponse_TutorPublicKey, 0, len(devices))
	pubKeys = append(pubKeys, &tutorpb.TutorGetPublicKeyResponse_TutorPublicKey{
		Type: "public-key-rsa",
		Key:  pubKeyRSA,
	})

	for _, dev := range devices {
		dec, _ := base64.RawURLEncoding.DecodeString(dev.PublicKey)
		pubKeys = append(pubKeys, &tutorpb.TutorGetPublicKeyResponse_TutorPublicKey{
			Type:         dev.CredentialType,
			Key:          dec,
			CredentialId: &dev.CredentialId,
		})
	}

	for _, uk := range userKeys {
		// dec, _ := base64.RawURLEncoding.DecodeString(uk.PublicKey)
		enc := base64.RawURLEncoding.EncodeToString(uk.PublicKey)
		log.Infof("[TUTOR] pubkey: %s=%d bytes", enc, len(uk.PublicKey))
		pubKeys = append(pubKeys, &tutorpb.TutorGetPublicKeyResponse_TutorPublicKey{
			Type:         uk.KeyType,
			Key:          uk.PublicKey,
			CredentialId: uk.CredentialId,
		})
	}

	return &tutorpb.TutorGetPublicKeyResponse{
		Status:     "OK",
		StatusCode: 200,
		PublicKeys: pubKeys,
	}, nil
}

func (s *TutorServer) List(ctx context.Context, in *tutorpb.TutorList) (*tutorpb.TutorResponse, error) {
	return &tutorpb.TutorResponse{}, nil
}

func (s *TutorServer) SmartSearch(ctx context.Context, in *tutorpb.TutorSmartSearch) (*tutorpb.TutorResponse, error) {
	db := db.GetDb()
	pid := ctx.Value("pid")
	if err := db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		if _, err := tx.ExecContext(ctx, `
			SELECT set_rls_context(?);
		`, pid); err != nil {
			return err
		}
		return nil
	}); err != nil {
		log.Errorf("error from RLS context: %v", err)
		return nil, status.Error(codes.PermissionDenied, "forbidden")
	}
	bin, _ := json.Marshal(in)
	h := sha256.New()
	h.Write(bin)
	hs := h.Sum(nil)
	shas := base64.RawStdEncoding.EncodeToString(hs)
	log.Infof("query SHA: %s", shas)
	cacheKey := fmt.Sprintf("search:%s:%s", pid, shas)
	log.Infof("query cache key: %s", cacheKey)
	rc := lib.GetRedisClient(ctx)
	res, err := rc.JSONGet(ctx, cacheKey, "$.outer").Result()
	if err != nil {
		// cache error
		if err != redis.Nil {
			log.Errorf("cache read returned error: %v", err)
			return nil, status.Error(codes.Internal, "internal error")
		}
	} else {
		// cache HIT
		log.Infof("cache read returned: %s", res)
		queryResults := make([][]*tutorpb.TutorDateTimeSlots, 0)
		err = json.Unmarshal([]byte(res), &queryResults)
		if err != nil {
			log.Errorf("failed to deserialize json: %v", err)
			return nil, status.Error(codes.Internal, "internal error")
		}
		queryResult := queryResults[0]
		return &tutorpb.TutorResponse{
			Status: "OK",
			Data: &tutorpb.TutorResponse_Outer{
				Outer: &tutorpb.TutorAvailableSlotsResponse{
					Slots: queryResult,
				},
			},
		}, nil
	}

	return &tutorpb.TutorResponse{
		Status: "OK",
		Data: &tutorpb.TutorResponse_Outer{
			Outer: &tutorpb.TutorAvailableSlotsResponse{
				Slots: []*tutorpb.TutorDateTimeSlots{},
			},
		},
	}, nil
}

func (s *TutorServer) Search(ctx context.Context, in *tutorpb.TutorSearch) (*tutorpb.TutorResponse, error) {
	db := db.GetDb()
	pid := ctx.Value("pid")
	if err := db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		if _, err := tx.ExecContext(ctx, `
			SELECT set_rls_context(?);
		`, pid); err != nil {
			return err
		}
		return nil
	}); err != nil {
		log.Errorf("error from RLS context: %v", err)
		return nil, status.Error(codes.PermissionDenied, "forbidden")
	}
	vv, _ := lib.GetVault(ctx)
	uid, _ := pid.(uuid.UUID)
	idemp, err := utils.NewIdempotencyKey(ctx, "tutors", uid, []byte("secret"), &utils.IdempotencyKeyOpts{
		SecretsManager: vv,
	})
	if err != nil {
		log.Errorf("error creating key: %v", err)
		return nil, status.Error(codes.Internal, "error creating key")
	}
	log.Infof("NEW KEY: %v", idemp)

	h := sha256.New()
	h.Write([]byte(in.Query))
	hs := h.Sum(nil)
	shas := base64.RawStdEncoding.EncodeToString(hs)
	log.Infof("query SHA: %s", shas)
	cacheKey := fmt.Sprintf("search:%s:%s", pid, shas)
	log.Infof("query cache key: %s", cacheKey)
	rc := lib.GetRedisClient(ctx)
	res, err := rc.JSONGet(ctx, cacheKey, "$.outer").Result()
	if err != nil {
		// cache error
		if err != redis.Nil {
			log.Errorf("cache read returned error: %v", err)
			return nil, status.Error(codes.Internal, "internal error")
		}
	} else {
		// cache HIT
		log.Infof("cache read returned: %s", res)
		queryResults := make([][]*tutorpb.TutorDateTimeSlots, 0)
		err = json.Unmarshal([]byte(res), &queryResults)
		if err != nil {
			log.Errorf("failed to deserialize json: %v", err)
			return nil, status.Error(codes.Internal, "internal error")
		}
		queryResult := queryResults[0]
		return &tutorpb.TutorResponse{
			Status: "OK",
			Data: &tutorpb.TutorResponse_Outer{
				Outer: &tutorpb.TutorAvailableSlotsResponse{
					Slots: queryResult,
				},
			},
		}, nil
	}
	// cache MISS
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

	cb := gobreaker.NewCircuitBreaker[*tutorpb.TutorResponse](gobreaker.Settings{
		Name:        "TutorService",
		MaxRequests: 3,
		Interval:    10 * time.Second,
		Timeout:     30 * time.Second,
		ReadyToTrip: func(counts gobreaker.Counts) bool {
			failRatio := float64(counts.TotalFailures) / float64(counts.Requests)
			return counts.Requests >= 5 && failRatio >= 0.5
		},
	})

	cli := tutorpb.NewTutorServiceClient(conn)

	log.Infof("input: %v", in)
	token := ctx.Value("token")
	rc.JSONSet(ctx, fmt.Sprintf("agents:%s:token", pid), "$", map[string]any{
		"token": token,
	})
	reply, err := cb.Execute(func() (*tutorpb.TutorResponse, error) {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
		defer cancel()

		log.Infof("AUTH TOKEN: %s", token)
		md := metadata.Pairs(
			"authorization", fmt.Sprintf("Bearer %s", token),
		)
		ctx = metadata.NewOutgoingContext(ctx, md)

		reply, err := cli.Search(ctx, &tutorpb.TutorSearch{Query: in.Query, Tz: in.Tz, Pid: new(uid.String())})
		if err != nil {
			log.Errorf("Search returned error: %v", err)
			st, _ := status.FromError(err)
			if st.Code() == codes.InvalidArgument {
				return nil, err
			}
			return nil, err
		}

		return reply, nil
	})
	if err != nil {
		log.Errorf("Search returned error: %v", err)
		return nil, err
	}

	// reply, err := cli.Search(ctx, &tutorpb.TutorSearch{Query: in.Query, Tz: in.Tz})
	// protoJson, _ := protojson.Marshal(reply)
	// innerCacheKey := fmt.Sprintf("%s:inner", cacheKey)
	// rc.JSONSet(ctx, cacheKey, "$.inner", protoJson)
	// rc.Expire(ctx, cacheKey, 5*time.Minute)

	qd, _ := lib.GetQdrantClient(ctx)
	var qp *qdrant.QueryPoints
	var inner *tutorpb.TutorSearchResponse
	switch t := reply.Data.(type) {
	case *tutorpb.TutorResponse_Inner:
		inner = t.Inner
		qp = &qdrant.QueryPoints{
			CollectionName: "tutors",
			Query:          qdrant.NewQuery(inner.GetEmbedding()...),
			Using:          utils.StringPtr("data"),
			Limit:          utils.Uint64Ptr(10),
			WithPayload:    qdrant.NewWithPayload(true),
			Filter: &qdrant.Filter{
				Should: []*qdrant.Condition{
					qdrant.NewMatchTextAny("categories", inner.GetCategory()),
					qdrant.NewMatchTextAny("subjects", inner.GetSubject()),
					qdrant.NewMatch("currency", inner.GetCurrency()),
					qdrant.NewMatch("timezone", inner.GetTimezone()),
					qdrant.NewRange("session_price", &qdrant.Range{
						Gte: utils.F64Ptr(float64(inner.GetSessionPrice())),
						Lte: utils.F64Ptr(float64(inner.GetSessionPrice() + 10)),
					}),
					qdrant.NewRange("session_duration", &qdrant.Range{
						Gte: utils.F64Ptr(float64(inner.GetSessionDuration())),
						Lte: utils.F64Ptr(float64(inner.GetSessionDuration() + 30)),
					}),
				},
			},
		}
	case *tutorpb.TutorResponse_Outer:
		break
	}
	scoredPoints, err := qd.Query(ctx, qp)
	if err != nil {
		log.Errorf("[TutorService]: response from Qdrant returned error: %v", err)
	}
	log.Infof("[SEARCH RESULTS] len of scoredPoints: %d", len(scoredPoints))

	tutorIds := make([]string, 0, len(scoredPoints))
	for _, scoredPoint := range scoredPoints {
		tutorIds = append(tutorIds, scoredPoint.GetId().GetUuid())
	}
	log.Infof("[SEARCH RESULTS] tutor IDs: %d %v", len(tutorIds), tutorIds)

	var tutors []*models.Tutor
	if err := db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		if _, err := tx.ExecContext(ctx, `
			SELECT set_rls_context(?);
		`, pid); err != nil {
			return err
		}
		sid, err := models.GetTxSession(ctx, &tx)
		if err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `
			SET LOCAL app.student_id = ?;
		`, sid.StudentID); err != nil {
			return err
		}
		log.Infof("SessionID: %#v", sid)
		if err := tx.NewSelect().
			Model(&models.Tutor{}).
			// Column("id").
			// Column("timezone").
			// Column("cal_metadata").
			Where("id IN (?)", bun.List(tutorIds)).
			Scan(ctx, &tutors); err != nil {
			return err
		}
		return nil
	}); err != nil {
		log.Errorf("error from RLS context: %v", err)
		return nil, asynq.SkipRetry
	}
	if len(tutors) == 0 {
		log.Error("tutor search returned empty results. aborting")
		/* return &tutorpb.TutorResponse{
			Status: "OK",
			Data: &tutorpb.TutorResponse_Outer{
				Outer: &tutorpb.TutorAvailableSlotsResponse{
					Slots: []*tutorpb.TutorDateTimeSlots{},
				},
			},
		}, nil */
	}
	log.Infof("[SEARCH] returned %d results", len(tutors))

	teamAndEventTypeSlugs := make(map[string][]string)
	tutorsMap := make(map[string]*models.Tutor)
	for _, t := range tutors {
		calMetadata := *t.CalMetadata
		teamSlug := calMetadata.Team.Slug
		eventTypeSlug := calMetadata.EventType.Slug
		teamAndEventTypeSlugs[t.ID.String()] = []string{teamSlug, eventTypeSlug}
		tutorsMap[t.ID.String()] = t
	}

	log.Infof("[SEARCH] inner=%#v", inner)
	cal := lib.NewCalClient()
	start, err := time.Parse(time.RFC3339, inner.GetStartTime())
	end, err := time.Parse(time.RFC3339, inner.GetStartTime())
	end = end.Add(3 * 24 * time.Hour)
	log.Infof("startTime: %s, endTime: %s", start.UTC(), end.UTC())
	slots, err := cal.BatchGetAvailableSlots(ctx, inner.GetTimezone(), start.UTC().Format(time.RFC3339), end.UTC().Format(time.RFC3339), teamAndEventTypeSlugs)
	if err != nil {
		log.Errorf("[SEARCH] error while requesting for available slots: %v", err)
		return nil, errors.New("error checking available slots")
	}
	log.Infof("[CAL] available slots: %v", slots)

	outerSlots := make([]*tutorpb.TutorDateTimeSlots, 0, len(slots))
	for k, v := range slots {
		tut := tutorsMap[k]
		outerSlot := &tutorpb.TutorDateTimeSlots{
			Id: k,
			Profile: &tutorpb.TutorProfileData{
				Id:              k,
				Name:            fmt.Sprintf("%s %s", tut.FirstName, tut.LastName),
				FirstName:       &tut.FirstName,
				LastName:        &tut.LastName,
				Country:         &tut.Country,
				Currency:        &tut.Currency,
				Title:           tut.Title,
				Bio:             tut.Bio,
				SessionDuration: utils.Int32Ptr(int32(utils.Coalesce(&tut.SessionDuration, 30))),
				SessionPrice:    utils.F32Ptr(float32(tut.SessionPrice)),
				Language:        tut.PrimaryLanguage,
				Categories:      tut.Categories,
				Subjects:        tut.Subjects,
				Rating:          utils.F32Ptr(float32(utils.Coalesce(tut.AverageRating, 0))),
				Timezone:        &tut.Timezone,
			},
			Slots: []*tutorpb.TutorGetAvailableSlotsResponseSlots{},
		}
		outerSlotSlots := make([]*tutorpb.TutorGetAvailableSlotsResponseSlots, 0, len(*v.Slots))
		for d, s := range *v.Slots {
			ds := &tutorpb.TutorGetAvailableSlotsResponseSlots{
				DateSlot:  d,
				TimeSlots: []*tutorpb.TutorGetAvailableSlotsResponseTimeSlot{},
			}
			aa := make([]*tutorpb.TutorGetAvailableSlotsResponseTimeSlot, 0, len(s))
			for _, ss := range s {
				aa = append(aa, &tutorpb.TutorGetAvailableSlotsResponseTimeSlot{
					Start: ss.Start,
				})
			}
			ds.TimeSlots = append(ds.TimeSlots, aa...)
			outerSlotSlots = append(outerSlotSlots, ds)
		}
		outerSlot.Slots = append(outerSlot.Slots, outerSlotSlots...)
		outerSlots = append(outerSlots, outerSlot)
	}
	rc.JSONSet(ctx, cacheKey, "$", map[string]any{
		"in":     in,
		"points": scoredPoints,
		"inner":  inner,
		"outer":  outerSlots,
	})
	rc.Expire(ctx, cacheKey, 30*time.Minute)
	return &tutorpb.TutorResponse{
		Status: "OK",
		Data: &tutorpb.TutorResponse_Outer{
			Outer: &tutorpb.TutorAvailableSlotsResponse{
				Slots: outerSlots,
			},
		},
	}, nil
}

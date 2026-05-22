package services

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/gofiber/fiber/v3/log"
	"github.com/google/uuid"
	"github.com/hibiken/asynq"
	toolpb "github.com/misterlobo/teachme/generated/v1/tool"
	"github.com/misterlobo/teachme/src/db"
	"github.com/misterlobo/teachme/src/lib"
	"github.com/misterlobo/teachme/src/models"
	"github.com/misterlobo/teachme/src/utils"
	"github.com/neo4j/neo4j-go-driver/v6/neo4j"
	"github.com/qdrant/go-client/qdrant"
	"github.com/uptrace/bun"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type ToolServer struct {
	toolpb.UnimplementedToolServiceServer
	ProfileServer     *ProfileServer
	TutorServer       *TutorServer
	CredentialServer  *CredentialServer
	PaymentServer     *PaymentServer
	AppointmentServer *AppointmentServer
	BookingServer     *BookingServer
}

func (s *ToolServer) GetUserProfile(ctx context.Context, in *toolpb.ToolGetUserProfile) (*toolpb.ToolSearchResultsResponse, error) {
	pid := ctx.Value("pid")
	uid, _ := pid.(uuid.UUID)
	log.Infof("[TOOL] uid: %v", uid)

	var stud models.Student

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
		`, sid.UserID)

		if err := tx.NewSelect().Model(&models.Student{}).Where("id = ?", sid.StudentID).Scan(ctx, &stud); err != nil {
			log.Errorf("[TOOL] error querying user profile: %v", err)
			return err
		}

		return nil
	}); err != nil {
		log.Errorf("[TOOL] error retrieving user info: %v", err)
		return nil, status.Error(codes.NotFound, "not found")
	}

	resData := &toolpb.ToolSearchResultsResponse_UserProfile{
		UserProfile: &toolpb.ToolUserProfile{
			FirstName: &stud.FirstName,
			LastName:  &stud.LastName,
			Country:   &stud.Country,
			Language:  &stud.Language,
			Currency:  &stud.Currency,
			Budget:    []float64{10, 50},
			Interests: stud.Preferences.Interests,
		},
	}

	return &toolpb.ToolSearchResultsResponse{
		Status:     "OK",
		StatusCode: 200,
		Data:       resData,
	}, nil
}

func (s *ToolServer) VectorSearch(ctx context.Context, in *toolpb.ToolVectorSearch) (*toolpb.ToolSearchResultsResponse, error) {
	pid := ctx.Value("pid")
	uid, _ := pid.(uuid.UUID)
	log.Infof("[TOOL] uid: %v", uid)

	qd, _ := lib.GetQdrantClient(ctx)
	var qp *qdrant.QueryPoints
	intent := in.GetIntent()
	qp = &qdrant.QueryPoints{
		CollectionName: "tutors",
		Query:          qdrant.NewQuery(in.GetEmbeddings()...),
		Using:          utils.StringPtr("data"),
		Limit:          utils.Uint64Ptr(10),
		WithPayload:    qdrant.NewWithPayload(true),
		Filter: &qdrant.Filter{
			Should: []*qdrant.Condition{
				qdrant.NewMatchTextAny("categories", intent.GetCategory()),
				qdrant.NewMatchTextAny("subjects", intent.GetSubject()),
				qdrant.NewMatch("currency", intent.GetCurrency()),
				qdrant.NewMatch("timezone", intent.GetTimezone()),
				qdrant.NewRange("session_price", &qdrant.Range{
					Gte: new(float64(intent.GetSessionPrice())),
					Lte: new(float64(intent.GetSessionPrice() + 10)),
				}),
				qdrant.NewRange("session_duration", &qdrant.Range{
					Gte: new(float64(intent.GetSessionDuration())),
					Lte: new(float64(intent.GetSessionDuration() + 30)),
				}),
			},
		},
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
	points := make([]*toolpb.ToolVectorSearchResults_ToolVectorSearchResultsPoints, 0, len(tutorIds))
	for _, tutorId := range tutorIds {
		points = append(points, &toolpb.ToolVectorSearchResults_ToolVectorSearchResultsPoints{
			Id:      tutorId,
			Payload: &toolpb.ToolVectorSearchResults_ToolVectorSearchResultsPayload{},
		})
	}
	return &toolpb.ToolSearchResultsResponse{
		Data: &toolpb.ToolSearchResultsResponse_VectorResults{
			VectorResults: &toolpb.ToolVectorSearchResults{
				Points: points,
			},
		},
	}, nil
}

func (s *ToolServer) GraphSearch(ctx context.Context, in *toolpb.ToolGraphSearch) (*toolpb.ToolSearchResultsResponse, error) {
	pid := ctx.Value("pid")
	uid, _ := pid.(uuid.UUID)
	log.Infof("[TOOL] uid: %v", uid)

	graph, err := lib.GetGraphDb(ctx)
	if err != nil {
		return nil, err
	}
	g := *graph
	session := g.NewSession(ctx, neo4j.SessionConfig{
		Auth: nil,
	})
	result, err := session.Run(ctx, `
	MATCH (t:Tutor)
	WHERE t.id IN $candidate_ids

	// subject relevance
	OPTIONAL MATCH (t)-[:TEACHES]->(s:Subject)
	WITH t, collect(s.name) AS subjects

	// similarity boost (collaborative filtering style)
	OPTIONAL MATCH (t)-[sim:SIMILAR_TO]->(other:Tutor)
	WHERE other.id IN $candidate_ids
	WITH t, subjects, sum(sim.score) AS similarity_score

	// popularity / trust signal
	OPTIONAL MATCH (t)-[:TAUGHT]->(st:Student)
	WITH t, subjects, similarity_score, count(st) AS student_count

	RETURN
		t.id AS tutor_id,
		t.rating AS rating,
		t.sessions_completed AS sessions,
		subjects,
		similarity_score,
		student_count
	`, map[string]any{
		"candidate_ids": in.GetIds(),
	}, neo4j.WithTxTimeout(20*time.Second))
	if err != nil {
		return nil, err
	}
	records := make([]map[string]any, 0)
	results := make([]*toolpb.ToolGraphSearchResultsResult, 0)
	for result.Next(ctx) {
		recMap := result.Record().AsMap()
		log.Infof("[GraphSearch] record map: %v", recMap)
		results = append(results, &toolpb.ToolGraphSearchResultsResult{})
	}
	log.Infof("[GraphSearch] result: %v", len(records))

	return &toolpb.ToolSearchResultsResponse{
		Data: &toolpb.ToolSearchResultsResponse_GraphResults{
			GraphResults: &toolpb.ToolGraphSearchResults{
				Result: results,
			},
		},
	}, nil
}

func (s *ToolServer) ScheduleSearch(ctx context.Context, in *toolpb.ToolScheduleSearch) (*toolpb.ToolSearchResultsResponse, error) {
	var tutors []*models.Tutor
	db := db.GetDb()
	pid := ctx.Value("pid")
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
			Where("id IN (?)", bun.List(in.GetIds())).
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
		return &toolpb.ToolSearchResultsResponse{
			Status:     "OK",
			StatusCode: 200,
			Data: &toolpb.ToolSearchResultsResponse_ScheduleResults{
				ScheduleResults: &toolpb.ToolScheduleSearchResults{
					Results: []*toolpb.ToolScheduleSearchResults_Result{},
				},
			},
		}, nil
	}
	uid, _ := pid.(uuid.UUID)
	log.Infof("[SCHEDULE SEARCH] uid: %v", uid)
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

	cal := lib.NewCalClient()
	start, err := time.Parse(time.RFC3339, in.GetStartTime())
	end, err := time.Parse(time.RFC3339, in.GetStartTime())
	end = end.Add(3 * 24 * time.Hour)
	log.Infof("startTime: %s, endTime: %s", start.UTC(), end.UTC())
	slots, err := cal.BatchGetAvailableSlots(ctx, in.GetTimezone(), start.UTC().Format(time.RFC3339), end.UTC().Format(time.RFC3339), teamAndEventTypeSlugs)
	if err != nil {
		log.Errorf("[SEARCH] error while requesting for available slots: %v", err)
		return nil, errors.New("error checking available slots")
	}
	log.Infof("[CAL] available slots: %v", slots)

	outerSlots := make([]*toolpb.ToolScheduleSearchResults_Result, 0, len(slots))
	for k, v := range slots {
		tut := tutorsMap[k]
		outerSlot := &toolpb.ToolScheduleSearchResults_Result{
			Id: k,
			Profile: &toolpb.ToolScheduleSearchResults_TutorProfileData{
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
			Slots: []*toolpb.ToolScheduleSearchResults_ToolScheduleSearchResultsSlots{},
		}
		outerSlotSlots := make([]*toolpb.ToolScheduleSearchResults_ToolScheduleSearchResultsSlots, 0, len(*v.Slots))
		for d, s := range *v.Slots {
			ds := &toolpb.ToolScheduleSearchResults_ToolScheduleSearchResultsSlots{
				DateSlot:  d,
				TimeSlots: []*toolpb.ToolScheduleSearchResults_ToolScheduleSearchResultsSlots_ToolScheduleSearchResultsSlotsTimeSlot{},
			}
			aa := make([]*toolpb.ToolScheduleSearchResults_ToolScheduleSearchResultsSlots_ToolScheduleSearchResultsSlotsTimeSlot, 0, len(s))
			for _, ss := range s {
				aa = append(aa, &toolpb.ToolScheduleSearchResults_ToolScheduleSearchResultsSlots_ToolScheduleSearchResultsSlotsTimeSlot{
					Start: ss.Start,
				})
			}
			ds.TimeSlots = append(ds.TimeSlots, aa...)
			outerSlotSlots = append(outerSlotSlots, ds)
		}
		outerSlot.Slots = append(outerSlot.Slots, outerSlotSlots...)
		outerSlots = append(outerSlots, outerSlot)
	}

	return &toolpb.ToolSearchResultsResponse{
		Data: &toolpb.ToolSearchResultsResponse_ScheduleResults{
			ScheduleResults: &toolpb.ToolScheduleSearchResults{
				Results: outerSlots,
			},
		},
	}, nil
}

func (s *ToolServer) SaveSuggestions(ctx context.Context, in *toolpb.ToolQuerySuggestions) (*toolpb.ToolSearchResultsResponse, error) {
	if in == nil {
		return nil, status.Error(codes.InvalidArgument, "invalid args")
	}
	rc := lib.GetRedisClient(ctx)
	cacheKey := fmt.Sprintf("%s:discovery:suggestions", in.GetPid())
	rc.JSONSet(ctx, cacheKey, "$", in.GetSuggestions())
	rc.Expire(ctx, cacheKey, 30*time.Minute)
	return &toolpb.ToolSearchResultsResponse{
		Status:     "OK",
		StatusCode: 200,
	}, nil
}

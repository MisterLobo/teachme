package services

import (
	"context"
	"database/sql/driver"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/gofiber/fiber/v3/log"
	profilepb "github.com/misterlobo/teachme/generated/v1/profile"
	"github.com/misterlobo/teachme/src/db"
	"github.com/misterlobo/teachme/src/lib"
	"github.com/misterlobo/teachme/src/models"
	"github.com/misterlobo/teachme/src/utils"
	"github.com/redis/go-redis/v9"
	"github.com/uptrace/bun"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/encoding/protojson"
)

type ProfileServer struct {
	profilepb.UnimplementedProfileServiceServer
}
type sessionID struct {
	Role           string            `json:"role"`
	RoleID         string            `json:"role_id"`
	UserID         string            `json:"user_id"`
	CustomerID     string            `jons:"customer_id"`
	TenantID       string            `json:"tenant_id"`
	TutorID        string            `json:"tutor_id"`
	OrganizationID string            `json:"organization_id"`
	StudentID      string            `json:"student_id"`
	ParentID       string            `json:"parent_id"`
	Ctx            map[string]string `json:"ctx"`
	CustomerType   string            `json:"customer_type"`
}

type cachedProfileData struct {
	Id        string  `json:"id"`
	Name      string  `json:"name"`
	FirstName *string `json:"first_name"`
	LastName  *string `json:"last_name"`
	Country   *string `json:"country"`
	Currency  *string `json:"currency"`
	Language  *string `json:"language"`
}

func (ct *sessionID) Scan(value any) error {
	st := string(value.([]byte))
	return json.Unmarshal([]byte(st), ct)
}

func (ct sessionID) Value() (driver.Value, error) {
	return json.Marshal(ct)
}

func (s *ProfileServer) Get(ctx context.Context, in *profilepb.ProfileGet) (*profilepb.ProfileResponse, error) {
	db := db.GetDb()
	pid := ctx.Value("pid")
	db = db.WithNamedArg("PID", pid)
	log.Infof("Get: PID=%v", pid)
	var pd profilepb.ProfileData
	var tut models.Tutor
	users := make([]models.User, 0)
	var user models.User
	rc := lib.GetRedisClient(ctx)

	v, err := rc.JSONGet(ctx, fmt.Sprintf("%s:profile", pid)).Result()
	log.Infof("PROFILE CACHE: %v", v)
	if err != nil {
		if !errors.Is(err, redis.Nil) {
			return nil, status.Error(codes.Internal, err.Error())
		}
	} else {
		log.Infof("FROM CACHE: %T %v", v, v)
		if err := protojson.Unmarshal([]byte(v), &pd); err != nil {
			log.Errorf("ERROR DESERIALIZING JSON: %v", err)
			return nil, status.Error(codes.Internal, err.Error())
		}
		return &profilepb.ProfileResponse{
			Status:     "OK",
			StatusCode: 200,
			Data:       &pd,
		}, nil
	}
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

		log.Infof("sessionID: role=%v role_id=%v", sid.Role, sid.StudentID)

		if sid.Role == "customer" {
			var stud models.Student
			if err := tx.NewSelect().Model(&models.Student{}).Where("id = ?", sid.StudentID).Scan(ctx, &stud); err != nil {
				return err
			}
			log.Infof("STUDENT: %v", stud)
			if err := tx.NewSelect().Model(&models.User{}).Where("id = ?", sid.UserID).Scan(ctx, &user); err != nil {
				return err
			}
			pd = profilepb.ProfileData{
				Id:        stud.ID.String(),
				Name:      fmt.Sprintf("%s %s", stud.FirstName, stud.LastName),
				FirstName: &stud.FirstName,
				LastName:  &stud.LastName,
				Country:   &stud.Country,
				Currency:  &stud.Currency,
				Language:  &stud.Language,
				Email:     &user.Email,
				Phone:     user.Phone,
			}
		}

		if sid.Role == "tenant" {
			if err := tx.NewSelect().Model(&models.Tutor{}).Where("id = ?", sid.TutorID).Scan(ctx, &tut); err != nil {
				return err
			}
			log.Infof("TUTOR: %v", tut)
			if err := tx.NewSelect().
				Model(&users).
				Relation("Devices").
				Where("id = ?", sid.UserID).
				Scan(ctx); err != nil {
				return err
			}
			user = users[0]

			pd = profilepb.ProfileData{
				Id:              tut.ID.String(),
				Name:            fmt.Sprintf("%s %s", tut.FirstName, tut.LastName),
				FirstName:       &tut.FirstName,
				LastName:        &tut.LastName,
				Country:         &tut.Country,
				Currency:        &tut.Currency,
				Language:        tut.PrimaryLanguage,
				SessionDuration: utils.Int32Ptr(int32(tut.SessionDuration)),
				SessionPrice:    utils.F32Ptr(float32(tut.SessionPrice)),
				Title:           tut.Title,
				Bio:             tut.Bio,
				Email:           &user.Email,
				Phone:           user.Phone,
				Categories:      tut.Categories,
				Subjects:        tut.Subjects,
			}
		}

		return nil
	}); err != nil {
		log.Errorf("error from RLS context: %v", err)
		return nil, status.Error(codes.PermissionDenied, "forbidden")
	}
	marsh, _ := json.Marshal(&pd)
	rc.JSONSet(ctx, fmt.Sprintf("%s:profile", pid), "$", marsh)
	res := &profilepb.ProfileResponse{
		Status:     "OK",
		StatusCode: 200,
		Data:       &pd,
	}
	return res, nil
}

func (s *ProfileServer) Update(ctx context.Context, in *profilepb.ProfileUpdate) (*profilepb.ProfileResponse, error) {
	db := db.GetDb()
	pid := ctx.Value("pid")
	if err := db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		if _, err := tx.ExecContext(ctx, `
			SELECT set_rls_context(?);
		`, pid); err != nil {
			return err
		}
		/* var sid sessionID
		if err := tx.QueryRowContext(ctx, `
			SELECT json_build_object(
				'role', current_setting('app.role', true),
				'role_id', current_setting('app.role_id', true),
				'user_id', current_setting('app.user_id', true),
				'customer_id', current_setting('app.customer_id', true),
				'tenant_id', current_setting('app.tenant_id', true),
				'tutor_id', current_setting('app.tutor_id', true),
				'organization_id', current_setting('app.organization_id', true),
				'student_id', current_setting('app.student_id', true),
				'parent_id', current_setting('app.parent_id', true),
				'customer_type', current_setting('app.customer_type', true)
			) as ctx;
		`).Scan(&sid); err != nil {
			return err
		} */
		sid, err := models.GetTxSession(ctx, &tx)
		if err != nil {
			return err
		}

		log.Infof("sessionID: role=%v role_id=%v", sid.Role, sid.StudentID)

		if sid.Role == "customer" {
			stud := &models.Student{
				FirstName: in.GetFirstName(),
				LastName:  in.GetLastName(),
				Country:   in.GetCountry(),
				Currency:  in.GetCurrency(),
				Language:  in.GetPrimaryLanguage(),
				Timezone:  in.Timezone,
			}
			if _, err := tx.NewUpdate().Model(&models.Student{}).
				Set("first_name = ?", in.GetFirstName()).
				Set("last_name = ?", in.GetLastName()).
				Set("country = ?", in.GetCountry()).
				Set("currency = ?", in.GetCurrency()).
				Set("language = ?", in.GetPrimaryLanguage()).
				Set("timezone = ?", in.GetTimezone()).
				Where("id = ?", sid.StudentID).
				Exec(ctx); err != nil {
				return err
			}
			log.Infof("STUDENT: %v", stud)
		}
		if sid.Role == "tenant" {
			tut := &models.Tutor{
				FirstName:  in.GetFirstName(),
				LastName:   in.GetLastName(),
				Title:      in.Title,
				Currency:   in.GetCurrency(),
				Country:    in.GetCountry(),
				Categories: in.Categories,
				Subjects:   in.Subjects,
				Bio:        utils.StringPtr(""),
				Timezone:   in.GetTimezone(),
			}
			if _, err := tx.NewUpdate().Model(&models.Tutor{}).
				Set("first_name = ?", in.GetFirstName()).
				Set("last_name = ?", in.GetLastName()).
				Set("title = ?", in.GetTitle()).
				Set("currency = ?", in.GetCurrency()).
				Set("country = ?", in.GetCountry()).
				Set("categories = ?", in.GetCategories()).
				Set("subjects = ?", in.GetSubjects()).
				Set("bio = ?", "").
				Set("timezone = ?", in.GetTimezone()).
				Set("session_price = ?", in.GetSessionPrice()).
				Set("session_duration = ?", in.GetSessionDuration()).
				Where("id = ?", sid.TutorID).
				Exec(ctx); err != nil {
				return err
			}
			log.Infof("TUTOR: %v", tut)
		}

		return nil
	}); err != nil {
		log.Errorf("error from RLS context: %v", err)
		return nil, status.Error(codes.PermissionDenied, "forbidden")
	}
	return &profilepb.ProfileResponse{}, nil
}

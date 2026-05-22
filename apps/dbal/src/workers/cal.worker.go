package workers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"log/slog"
	"os"

	"github.com/google/uuid"
	"github.com/hibiken/asynq"
	"github.com/misterlobo/teachme/src/db"
	"github.com/misterlobo/teachme/src/lib"
	"github.com/misterlobo/teachme/src/models"
	"github.com/uptrace/bun"
)

const (
	CalAccountsCreate = "cal.accounts.create"
)

type CalAccountsCreateWorkerArgs struct {
	User models.UserCreated
}
type CalAccountsCreateWorker struct {
	Name string
}

func (s *CalAccountsCreateWorker) HandleWork(ctx context.Context, t *asynq.Task) error {
	var p *CalAccountsCreateWorkerArgs
	if err := json.Unmarshal(t.Payload(), &p); err != nil {
		return fmt.Errorf("json.Unmarshal failed: %v", err)
	}
	pid := p.User.PID.String()
	log.Printf("[%s] Received message from %s", s.Name, pid)

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
	log.Printf("[%s] user from redis: %v", s.Name, uc)

	cc := lib.NewCalClient()
	sched, err := cc.GetDefaultSchedule(ctx)
	if err != nil {
		log.Printf("[%s] error requesting data: %v", s.Name, err)
		return err
	}

	tz := uc.Tutor.Timezone
	if tz == "" {
		tz = "Asia/Manila"
	}
	user, _ := cc.CreateUser(ctx, map[string]any{
		"email":                 uc.User.Email,
		"username":              uc.User.Name,
		"bio":                   "",
		"timeZone":              tz,
		"autoAccept":            true,
		"skipNotificationEmail": true,
		"defaultScheduleId":     sched.Id,
		"locale":                "en",
	})
	userId := user.Id

	team, err := cc.CreateTeam(ctx, user.Id, fmt.Sprintf("%s's Team", user.Username), fmt.Sprintf("%d-%s-team", user.Id, user.Username), &tz)
	if err != nil {
		log.Printf("[%s] error creating team for user %s: %v", s.Name, uc.PID.String(), err)
		return err
	}
	// time.Sleep(5 * time.Second)

	teamId := team.Id
	member, err := cc.AddTeamMember(ctx, teamId, user.Id, true, "OWNER")
	if err != nil {
		log.Printf("[%s] error adding team Member: %v", s.Name, err)
		return err
	}
	memberId := member.Id

	usched, err := cc.CreateScheduleForUser(ctx, user.Id, "Weekly Schedule", tz, true)
	if err != nil {
		log.Printf("[%s] error creating Schedule for user %s: %v", s.Name, uc.PID.String(), err)
		return err
	}

	eventType, err := cc.CreateEventTypeForUser(ctx, user.Id, teamId, "Tutor Session", fmt.Sprintf("%d-tutor-session", user.Id), usched.Id)
	if err != nil {
		log.Printf("[%s] error creating EventType for user %s: %v", s.Name, uc.PID.String(), err)
		return err
	}

	tsched, err := cc.GetTeamSchedules(ctx, teamId, eventType.Id)
	if err != nil {
		log.Printf("[%s] error retrieving team Schedule: %v", s.Name, err)
		return err
	}

	calMetadata := map[string]any{
		"org": os.Getenv("CAL_ORG_SLUG"),
		"user": map[string]any{
			"id":       userId,
			"username": user.Username,
		},
		"team": map[string]any{
			"teamId":   teamId,
			"slug":     team.Slug,
			"memberId": memberId,
		},
		"schedules": map[string]any{
			"team": tsched.Id,
			"user": usched.Id,
		},
		"eventType": map[string]any{
			"id":   eventType.Id,
			"slug": eventType.Slug,
		},
	}
	calmd := &models.TutorCalMetadata{
		Org: models.TutorCalMetadataOrgSlug(os.Getenv("CAL_ORG_SLUG")),
		User: models.TutorCalMetadataUser{
			Id:       userId,
			Username: user.Username,
		},
		Team: models.TutorCalMetadataTeam{
			TeamId:   teamId,
			Slug:     team.Slug,
			MemberId: memberId,
		},
		Schedules: models.TutorCalMetadataSchedules{
			Team: sched.Id,
			User: usched.Id,
		},
		EventType: models.TutorCalMetadataEventType{
			Id:   eventType.Id,
			Slug: eventType.Slug,
		},
	}
	log.Printf("[CAL] metadata: %v", calMetadata)

	userID := uc.ID
	log.Println("------------------------------------------------------------------")
	log.Printf("USER ID: %s", userID)
	log.Println("------------------------------------------------------------------")
	tutorID := uc.Tutor.ID
	log.Println("------------------------------------------------------------------")
	log.Printf("TUTOR ID: %s", tutorID)
	log.Println("------------------------------------------------------------------")
	db := db.GetDb()
	// ctx = context.WithValue(ctx, "pid", uc.PID)
	/* db, err = models.SetRLSContext(ctx, db)
	if err != nil {
		log.Printf("[%s] failed to set RLS context: %v", s.Name, err)
		return err
	} */
	uid := uc.PID
	db = db.WithNamedArg("PID", uid)
	if err := db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		if _, err := tx.ExecContext(ctx, `
			SELECT set_rls_context(?);
		`, uid); err != nil {
			return err
		}
		var pguser string
		tx.QueryRowContext(ctx, "SELECT current_user").Scan(&pguser)
		log.Printf("current_user: %s", pguser)
		_, err := tx.NewUpdate().
			Model(&models.User{CalUserId: &user.Id, CalUsername: &user.Username}).
			Column("cal_user_id").
			Column("cal_username").
			Where("id = ?", userID.String()).
			Exec(ctx)
		if err != nil {
			log.Printf("[%s] failed to update user metadata: %v", s.Name, err)
			return err
		}

		_, err = tx.NewUpdate().
			Model(&models.Tutor{
				CalMetadata: calmd,
			}).
			Column("cal_metadata").
			Where("id = ?", tutorID).
			Exec(ctx)
		if err != nil {
			log.Printf("[%s] failed to update metadata: %v", s.Name, err)
			return err
		}

		return nil
	}); err != nil {
		log.Printf("[%s] error updating metadata for user %s: %v", s.Name, uc.PID.String(), err)
		return err
	}

	return nil
}

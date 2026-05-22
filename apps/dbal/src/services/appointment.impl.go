package services

import (
	"context"
	"time"

	"github.com/gofiber/fiber/v3/log"
	"github.com/google/uuid"
	appointmentpb "github.com/misterlobo/teachme/generated/v1/appointment"
	"github.com/misterlobo/teachme/src/db"
	"github.com/misterlobo/teachme/src/models"
	"github.com/uptrace/bun"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type AppointmentServer struct {
	appointmentpb.UnimplementedAppointmentServiceServer
}

func (s *AppointmentServer) Retrieve(ctx context.Context, in *appointmentpb.AppointmentRetrieve) (*appointmentpb.AppointmentResponse, error) {
	log.Infof("received request for retrieval: %v", in)

	db := db.GetDb()
	pid := ctx.Value("pid")
	log.Infof("context pid: %v %T", pid, pid)

	var statusMessage string
	var statusCode codes.Code
	// appts := make([]*models.Appointment, 0)
	// appt := new(models.Appointment)
	appts := make([]*models.Appointment, 0)

	if err := db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		/* if _, err := tx.ExecContext(ctx, `
			SELECT set_rls_context(?);
		`, pid); err != nil {
			return err
		} */
		sid, err := models.GetTxSession(ctx, &tx)
		if err != nil {
			statusCode = codes.FailedPrecondition
			statusMessage = "failed to read session"
			return err
		}
		log.Infof("SesssionID: %#v", sid)
		log.Infof("Tutor TenantID: %s", sid.TenantID)
		/* tx.ExecContext(ctx, `
			SET LOCAL app.tutor_id = ?;
			SET LOCAL app.host_id = ?;
		`, sid.TutorID, sid.TutorID) */

		id, err := uuid.Parse(in.GetId())
		tx.ExecContext(ctx, `
				SET LOCAL app.appointment_id = ?;
			`, id)
		if err != nil {
			log.Errorf("Error parsing id: %v", err)
			statusCode = codes.InvalidArgument
			statusMessage = "invalid appointment id"
			return err
		}
		log.Infof("[APPOINTMENT] id: %s", id)
		if sid.Role == string(models.RoleTenant) {
			tx.ExecContext(ctx, `
				SET LOCAL app.host_id = ?;
			`, sid.TutorID)
		}
		if sid.Role == string(models.RoleCustomer) {
			log.Infof("[APPOINTMENT] setting id: %s", id)
			tx.ExecContext(ctx, `
				SET LOCAL app.attendee_id = ?;
			`, sid.UserID)
		}
		count, err := tx.NewSelect().
			Model(&models.Appointment{}).
			// WherePK().
			Where("id = ?", in.GetId()).
			ScanAndCount(ctx, &appts)
		if err != nil {
			log.Errorf("[APPOINTMENT] error finding appointment %s: %v", in.Id, err)
			statusCode = codes.NotFound
			statusMessage = "not_found"
			return err
		}
		if count == 0 {
			statusCode = codes.NotFound
			statusMessage = "not_found"
		} else if count > 1 {
			statusCode = codes.PermissionDenied
			statusMessage = "forbidden"
		}

		return nil
	}); err != nil {
		log.Errorf("[APPOINTMENT] error while querying details for %s: %v", in.Id, err)
		return nil, status.Error(statusCode, statusMessage)
	}
	log.Infof("[APPOINTMENT] %d matches", len(appts))
	appt := appts[0]
	for _, a := range appts {
		log.Infof("[APPOINTMENT] expected %s matched ID: %s", in.GetId(), a.ID)
	}

	return &appointmentpb.AppointmentResponse{
		Status:     "OK",
		StatusCode: 200,
		Data: &appointmentpb.AppointmentResponse_One{
			One: &appointmentpb.AppointmentRetrieveResponse{
				Id:         in.GetId(),
				HostId:     appt.HostID.String(),
				AttendeeId: appt.AttendeeID.String(),
			},
		},
	}, nil
}

func (s *AppointmentServer) List(ctx context.Context, in *appointmentpb.AppointmentList) (*appointmentpb.AppointmentResponse, error) {
	db := db.GetDb()
	pid := ctx.Value("pid")
	log.Infof("context pid: %v %T", pid, pid)

	var statusMessage string
	var statusCode codes.Code
	appts := make([]*models.Appointment, 0)

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
		log.Infof("SesssionID: %#v", sid)
		/* var col string
		var colValue *uuid.UUID
		if sid.Role == string(models.RoleTenant) {
			t, _ := uuid.Parse(sid.TutorID)
			colValue = &t
			col = "host_id"
		}
		if sid.Role == string(models.RoleCustomer) {
			s, _ := uuid.Parse(sid.StudentID)
			colValue = &s
			col = "attendee_id"
		} */
		nn := time.Now()
		// ll := nn.AddDate(0, 0, 5)
		if err := tx.NewSelect().
			Model(&models.Appointment{}).
			// Where(fmt.Sprintf("%s = ?", col), colValue).
			ColumnExpr("*, CASE WHEN start_at >= ? THEN 'upcoming' ELSE 'past' END as status_group", nn).
			Where("host_id = COALESCE(NULLIF(current_setting('app.tutor_id', true), ''), NULL)::uuid").
			WhereOr("attendee_id = COALESCE(NULLIF(current_setting('app.student_id', true), ''), NULL)::uuid").
			Where("end_at >= ?", nn).
			OrderExpr("start_at ASC").
			Scan(ctx, &appts); err != nil {
			log.Errorf("[APPOINTMENT] error finding appointments %s: %v", pid, err)
			statusCode = codes.NotFound
			statusMessage = "not found"
			return err
		}

		return nil
	}); err != nil {
		log.Errorf("[APPOINTMENT] error while querying details for participant %s: %v", pid, err)
		return nil, status.Error(statusCode, statusMessage)
	}
	log.Infof("[APPOINTMENT] returned %d results", len(appts))
	past := make([]*appointmentpb.AppointmentListEntry, 0, len(appts))
	upcoming := make([]*appointmentpb.AppointmentListEntry, 0, len(appts))
	for _, appt := range appts {
		// dt, _ := time.ParseInLocation(time.RFC3339, appt.StartAt.String(), time.UTC)
		// dt, _ := time.Parse(time.RFC3339, appt.StartAt.String())
		if appt.StatusGroup == "upcoming" {
			upcoming = append(upcoming, &appointmentpb.AppointmentListEntry{
				Id:         appt.ID.String(),
				HostId:     appt.HostID.String(),
				AttendeeId: appt.AttendeeID.String(),
				DateTime:   appt.StartAt.String(),
				Status:     string(appt.Status),
			})
		} else {
			past = append(past, &appointmentpb.AppointmentListEntry{
				Id:         appt.ID.String(),
				HostId:     appt.HostID.String(),
				AttendeeId: appt.AttendeeID.String(),
				DateTime:   appt.StartAt.String(),
				Status:     string(appt.Status),
			})
		}
	}
	/* for _, appt := range appts {
		dt, _ := time.ParseInLocation(time.RFC3339, appts[0].StartAt.String(), time.Local)
		upcoming = append(upcoming, &appointmentpb.AppointmentListEntry{
			Id:         appt.ID.String(),
			HostId:     appt.HostID.String(),
			AttendeeId: appt.AttendeeID.String(),
			DateTime:   dt.UTC().Format(time.RFC3339),
			Status:     string(appt.Status),
		})
	} */
	// dt, _ := time.ParseInLocation(time.RFC3339, appts[0].StartAt.String(), time.UTC)
	dt, _ := time.Parse(time.RFC3339, appts[0].StartAt.String())
	log.Infof("[APPOINTMENT] first: %v %v", appts[0], dt)

	return &appointmentpb.AppointmentResponse{
		Status:     "OK",
		StatusCode: 200,
		Data: &appointmentpb.AppointmentResponse_List{
			List: &appointmentpb.AppointmentListResponse{
				Past:     past,
				Upcoming: upcoming,
			},
		},
	}, nil
}

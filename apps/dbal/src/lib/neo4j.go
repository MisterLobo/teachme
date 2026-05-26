package lib

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/neo4j/neo4j-go-driver/v6/neo4j"
	"github.com/neo4j/neo4j-go-driver/v6/neo4j/config"
)

var driver *neo4j.Driver

func GetGraphDb(ctx context.Context) (*neo4j.Driver, error) {
	if driver != nil {
		return driver, nil
	}
	dbUri := os.Getenv("NEO4J_DBHOST")
	dbUser := os.Getenv("NEO4J_DBUSER")
	dbPassword := os.Getenv("NEO4J_DBPASS")
	drv, err := neo4j.NewDriver(dbUri, neo4j.BasicAuth(dbUser, dbPassword, ""), func(c *config.Config) {
		// TODO: mTLS
		/* clientCert, err := tls.LoadX509KeyPair("certs/localhost.pem", "certs/pk8_key.pem")
		if err != nil {
			log.Fatalf("failed to create credentials: %v", err)
		}
		caCert, err := os.ReadFile("certs/ca.pem")
		if err != nil {
			log.Fatalf("error reading CA certificate: %v", err)
		}
		caPool := x509.NewCertPool()
		caPool.AppendCertsFromPEM(caCert)
		c.TlsConfig = &tls.Config{
			ClientAuth:   tls.VerifyClientCertIfGiven,
			ClientCAs:    caPool,
			Certificates: []tls.Certificate{clientCert},
			RootCAs:      caPool,
		} */
	})
	if err != nil {
		log.Fatalf("[neo4j] could not connect to server: %v", err)
		return nil, err
	}
	// defer drv.Close(ctx)

	err = drv.VerifyConnectivity(ctx)
	if err != nil {
		log.Fatalf("[neo4j] failed to verify connectivity: %v", err)
		return nil, err
	}
	log.Println("[neo4j] connection established!")
	// graphTest(ctx, &drv)
	driver = &drv
	return &drv, nil
}

func CreateGraphSchema(ctx context.Context, driver neo4j.Driver) error {
	session := driver.NewSession(ctx, neo4j.SessionConfig{})
	if _, err := session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		graphs := []string{
			`CREATE CONSTRAINT student_id_unique IF NOT EXISTS FOR (s:Student) REQUIRE s.id IS UNIQUE;`,
			`CREATE CONSTRAINT tutor_id_unique IF NOT EXISTS FOR (t:Tutor) REQUIRE t.id IS UNIQUE;`,
			`CREATE CONSTRAINT appointment_id_unique IF NOT EXISTS FOR (a:Appointment) REQUIRE a.id IS UNIQUE;`,
			`CREATE CONSTRAINT review_id_unique IF NOT EXISTS FOR (r:Review) REQUIRE r.id IS UNIQUE;`,
			`CREATE INDEX appointment_data_index IF NOT EXISTS FOR (a:Appointment) ON (a.start_at);`,
		}
		for _, q := range graphs {
			if _, err := tx.Run(ctx, q, nil); err != nil {
				return nil, fmt.Errorf("query failed: %w", err)
			}
		}

		return nil, nil
	}); err != nil {
		return err
	}

	/* if _, err := neo4j.ExecuteQuery(ctx, driver, `
		CREATE (s:Student {id: $studentId, name: $studentName, subscription_level: $subscriptionLevel, signup_date: datetime()})
		CREATE (t:Tutor {id: $tutorId, name: $tutorName, specialties: $specialties, rating: $rating})
		CREATE (a:Appointment {id: $appointmentId, date: datetime(), status: $appointmentStatus})
		CREATE (r:Review {id: $reviewId, appointmentId: $appointmentId})

		CREATE (s)-[:BOOKED]->(a)
		CREATE (t)-[:HOSTS]->(a)
		CREATE (s)-[:REVIEWED]->(a)
		CREATE (a)-[:HAS_REVIEW]->(r)
	`, map[string]any{
		"studentId":         "uuid-student-1",
		"studentName":       "Alice",
		"tutorId":           "uuid-tutor-1",
		"tutorName":         "Tutor Bar",
		"specialties":       []string{},
		"rating":            4.9,
		"appointmentId":     "uuid-appointment-1",
		"reviewId":          "uuid-review-1",
		"subscriptionLevel": "trial",
		"appointmentStatus": "confirmed",
	}, neo4j.EagerResultTransformer); err != nil {
		log.Fatalf("[GRAPH] error executing query: %v", err)
		return err
	} */

	if _, err := neo4j.ExecuteQuery(ctx, driver, `
		CREATE (s)-[:BOOKED]->(a)
		CREATE (t)-[:HOSTS]->(a)
		CREATE (s)-[:REVIEWED]->(a)
		CREATE (a)-[:HAS_REVIEW]->(r)
		CREATE (t)-[:TAUGHT]->(s)
	`, map[string]any{
		"studentId":         "uuid-student-1",
		"studentName":       "Alice",
		"tutorId":           "uuid-tutor-1",
		"tutorName":         "Tutor Bar",
		"specialties":       []string{},
		"rating":            4.9,
		"appointmentId":     "uuid-appointment-1",
		"reviewId":          "uuid-review-1",
		"subscriptionLevel": "trial",
		"appointmentStatus": "confirmed",
	}, neo4j.EagerResultTransformer); err != nil {
		log.Fatalf("[GRAPH] error executing query: %v", err)
		return err
	}

	if _, err := session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		tutors := []map[string]any{}
		if _, err := tx.Run(ctx, `
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
			"rows": tutors,
		}); err != nil {
			log.Printf("[GRAPH] could not execute writes: %v", err)
			return nil, err
		}

		students := []map[string]any{}
		if _, err := tx.Run(ctx, `
			UNWIND $students AS student
			MERGE (s:Student {id:student.id})
			SET s.first_name = student.first_name,
					s.last_name = student.last_name,
					s.country = student.country,
					s.currency = student.currency,
					s.language = student.primary_language

			MERGE (s)-[:BOOKED]->(a)
			MERGE (s)-[:REVIEWED]->(a)
		`, map[string]any{
			"students": students,
		}); err != nil {
			log.Printf("[GRAPH] could not execute writes: %v", err)
			return nil, err
		}

		appointments := []map[string]any{}
		if _, err := tx.Run(ctx, `
			UNWIND $appointments AS appointment
			MERGE (a:Appointment {id:appointment.id})
			SET a.host_id = appointment.host_id,
					a.attendee_id = appointment.attendee_id,
					a.tenant_id = appointment.tenant_Id,
					a.start_at = appointment.start_at,
					a.end_at = appointment.end_at

			MERGE (a)-[:HAS_REVIEW]->(r)
		`, map[string]any{
			"appointments": appointments,
		}); err != nil {
			log.Printf("[GRAPH] could not execute writes: %v", err)
			return nil, err
		}

		reviews := []map[string]any{}
		if _, err := tx.Run(ctx, `
			UNWIND $reviews AS review
			MERGE (r:Review {id:review.id})
			SET r.reviewer = review.reviewer,
					r.reviewee = review.reviewee,
					r.comments = review.comments,
					r.rating = r.rating
		`, map[string]any{
			"reviews": reviews,
		}); err != nil {
			return nil, err
		}

		if _, err := tx.Run(ctx, `
			MERGE (s)-[:BOOKED]->(a)
			MERGE (t)-[:HOSTS]->(a)
			MERGE (s)-[:REVIEWED]->(a)
			MERGE (a)-[:HAS_REVIEW]->(r)
			MERGE (t)-[:TAUGHT]->(s)
		`, map[string]any{}); err != nil {
			return nil, err
		}

		/* if _, err := tx.Run(ctx, `
			UNWIND $rows AS row
			MERGE (a:Appointment {id:row.id})
			SET a.host_id = row.host_id,
					a.attendee_id = row.attendee_id,
					a.tenant_id = row.tenant_Id,
					a.start_at = row.start_at,
					a.end_at = row.end_at
		`, map[string]any{
			"rows": appointments,
		}); err != nil {
			log.Printf("[GRAPH] could not execute writes: %v", err)
			return nil, err
		} */

		return nil, nil
	}); err != nil {
		log.Fatalf("[GRAPH] could not execute writes: %v", err)
		return err
	}

	/* if _, err := session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		queries := []string{
			`CREATE (:Student {id: 'uuid-student-1', name: 'Alice', subscription_level: 'premium', signup_date: datetime()});`,
			`CREATE (:Student {id: 'uuid-student-2', name: 'Bob', subscription_level: 'basic', signup_date: datetime()});`,
			`CREATE (:Tutor {id: 'uuid-tutor-1', name: 'Dr. Smith', specialties: ['Math','Physics'], rating: 4.8});`,
			`CREATE (:Tutor {id: 'uuid-tutor-2', name: 'Ms. Johnson', specialties: ['English','History'], rating: 4.5});`,
			`CREATE (:Appointment {id: 'uuid-appointment-1', date: datetime('2026-05-01T10:00:00'), status: 'scheduled', topic: 'Calculus 101'});`,
			`CREATE (:Appointment {id: 'uuid-appointment-2', date: datetime('2026-04-28T14:00:00'), status: 'completed', topic: 'World History'});`,
			`CREATE (:Review {id: 'uuid-review-1', rating: 5, feedback: 'Great session!', created_at: datetime()});`,
			`CREATE (:Review {id: 'uuid-review-2', rating: 4, feedback: 'Helpful tutor', created_at: datetime()});`,

			`MATCH (s:Student {id: 'uuid-student-1'}), (a:Appointment {id: 'uuid-appointment-1'}) CREATE (s)-[:BOOKED]->(a);`,
			`MATCH (s:Student {id: 'uuid-student-2'}), (a:Appointment {id: 'uuid-appointment-2'}) CREATE (s)-[:BOOKED]->(a);`,
			`MATCH (t:Tutor {id: 'uuid-tutor-1'}), (a:Appointment {id: 'uuid-appointment-1'}) CREATE (t)-[:HOSTS]->(a);`,
			`MATCH (t:Tutor {id: 'uuid-tutor-2'}), (a:Appointment {id: 'uuid-appointment-2'}) CREATE (t)-[:HOSTS]->(a);`,
			`MATCH (s:Student {id:'uuid-student-1'}), (r:Review {id: 'uuid-review-1'}), (t:Tutor {id: 'uuid-tutor-1'}) CREATE (s)-[:REVIEWED]->(r)-[:ABOUT]->(t);`,
			`MATCH (a:Appointment {id: 'uuid-appointment-id'}), (r:Review {id: 'uuid-review-1'}) CREATE (a)-[:HAS_REVIEW]->(r);`,
		}
		for _, q := range queries {
			if _, err := tx.Run(ctx, q, nil); err != nil {
				return nil, fmt.Errorf("query failed: %w", err)
			}
		}

		return nil, nil
	}); err != nil {
		return err
	} */

	queries := []string{

		// ---------------------------
		// BASIC READ QUERIES
		// ---------------------------

		// 1. Get all students
		`MATCH (s:Student) RETURN s;`,

		// 2. Find a student by ID
		`MATCH (s:Student {id: 'uuid-student-1'}) RETURN s.name, s.subscription_level;`,

		// 3. Get all tutors with rating > 4.5
		`MATCH (t:Tutor) WHERE t.rating > 4.5 RETURN t.name, t.rating;`,

		// ---------------------------
		// RELATIONSHIP TRAVERSAL
		// ---------------------------

		// 4. Find all appointments booked by a student
		`MATCH (s:Student {id: 'uuid-student-1'})-[:BOOKED]->(a:Appointment)
	 	RETURN a.topic, a.date, a.status;`,

		// 5. Find tutor hosting a specific appointment
		`MATCH (t:Tutor)-[:HOSTS]->(a:Appointment {id: 'uuid-appointment-1'})
	 	RETURN t.name, t.specialties;`,

		// 6. Get reviews written by a student
		`MATCH (s:Student {id: 'uuid-student-1'})-[:REVIEWED]->(r:Review)
	 	RETURN r.rating, r.feedback;`,

		// ---------------------------
		// FILTERING + SORTING
		// ---------------------------

		// 7. Get completed appointments sorted by date
		`MATCH (a:Appointment)
		WHERE a.status = 'completed'
		RETURN a.topic, a.date
		ORDER BY a.date DESC;`,

		// 8. Top-rated tutors
		`MATCH (t:Tutor)
		RETURN t.name, t.rating
		ORDER BY t.rating DESC
		LIMIT 5;`,

		// ---------------------------
		// AGGREGATIONS
		// ---------------------------

		// 9. Average rating per tutor
		`MATCH (t:Tutor)<-[:ABOUT]-(r:Review)
	 	RETURN t.name, avg(r.rating) AS avg_rating;`,

		// 10. Count appointments per student
		`MATCH (s:Student)-[:BOOKED]->(a:Appointment)
	 	RETURN s.name, count(a) AS total_appointments;`,

		// ---------------------------
		// OPTIONAL MATCH (handling missing data)
		// ---------------------------

		// 11. Get tutors and their reviews (even if none exist)
		`MATCH (t:Tutor)
		OPTIONAL MATCH (t)<-[:ABOUT]-(r:Review)
		RETURN t.name, collect(r.rating) AS ratings;`,

		// ---------------------------
		// UPDATES
		// ---------------------------

		// 12. Update subscription level
		`MATCH (s:Student {id: 'uuid-student-2'})
		SET s.subscription_level = 'premium'
		RETURN s;`,

		// 13. Mark appointment as completed
		`MATCH (a:Appointment {id: 'uuid-appointment-1'})
		SET a.status = 'completed'
		RETURN a.status;`,

		// ---------------------------
		// DELETE
		// ---------------------------

		// 14. Delete a review (and its relationships)
		`MATCH (r:Review {id: 'uuid-review-2'})
	 	DETACH DELETE r;`,

		// ---------------------------
		// INTERMEDIATE GRAPH PATTERNS
		// ---------------------------

		// 15. Find students who reviewed tutors with rating >= 4
		`MATCH (s:Student)-[:REVIEWED]->(r:Review)-[:ABOUT]->(t:Tutor)
		WHERE r.rating >= 4
		RETURN s.name, t.name, r.rating;`,

		// 16. Find tutors who hosted completed appointments
		`MATCH (t:Tutor)-[:HOSTS]->(a:Appointment)
		WHERE a.status = 'completed'
		RETURN DISTINCT t.name;`,

		// ---------------------------
		// ADVANCED GRAPH QUERIES
		// ---------------------------

		// 17. Recommend tutors based on student reviews (collaborative filtering style)
		`MATCH (s:Student {id: 'uuid-student-1'})-[:REVIEWED]->(:Review)-[:ABOUT]->(t1:Tutor)
		MATCH (other:Student)-[:REVIEWED]->(:Review)-[:ABOUT]->(t1)
		MATCH (other)-[:REVIEWED]->(:Review)-[:ABOUT]->(t2:Tutor)
		WHERE t2 <> t1
		RETURN DISTINCT t2.name AS recommended_tutor;`,

		// 18. Find shortest path between a student and a tutor
		`MATCH (s:Student {id: 'uuid-student-1'}), (t:Tutor {id: 'uuid-tutor-2'}),
			p = shortestPath((s)-[*]-(t))
	 	RETURN p;`,

		// 19. Multi-hop traversal: Student → Appointment → Tutor → Reviews
		`MATCH (s:Student {id: 'uuid-student-1'})-[:BOOKED]->(a:Appointment)<-[:HOSTS]-(t:Tutor)
		OPTIONAL MATCH (t)<-[:ABOUT]-(r:Review)
		RETURN s.name, a.topic, t.name, avg(r.rating) AS tutor_rating;`,

		// ---------------------------
		// COMPLEX ANALYTICAL QUERY
		// ---------------------------

		// 20. Rank tutors by performance (avg rating + number of sessions)
		`MATCH (t:Tutor)-[:HOSTS]->(a:Appointment)
		OPTIONAL MATCH (t)<-[:ABOUT]-(r:Review)
		RETURN t.name,
		count(DISTINCT a) AS sessions,
		avg(r.rating) AS avg_rating
	 	ORDER BY avg_rating DESC, sessions DESC;`,
	}

	for _, q := range queries {
		results, err := neo4j.ExecuteQuery(ctx, driver, q, map[string]any{
			"id": "4:5e81ed3c-9b16-481d-bd21-d1fd56069c18",
		}, neo4j.EagerResultTransformer)
		if err != nil {
			log.Fatalf("Failed to execute query: %v", err)
		}
		summary := results.Summary
		log.Printf("Created %v nodes in %+v", summary.Counters().NodesCreated(), summary.ResultAvailableAfter())
	}

	return nil
}

func MergeStudentGraphs(ctx context.Context, driver neo4j.Driver, data ...map[string]any) error {
	if _, err := neo4j.ExecuteQuery(ctx, driver, `
		UNWIND $students AS student
		MERGE (s:Student {id:student.id})
		SET s.first_name = student.first_name,
				s.last_name = student.last_name,
				s.country = student.country,
				s.currency = student.currency,
				s.language = student.primary_language

		MERGE (s)-[:BOOKED]->(a)
		MERGE (s)-[:REVIEWED]->(a)
		`, map[string]any{
		"students": data,
	}, neo4j.EagerResultTransformer); err != nil {
		return err
	}
	return nil
}

func MergeTutorGraphs(ctx context.Context, driver neo4j.Driver, data ...map[string]any) error {
	if _, err := neo4j.ExecuteQuery(ctx, driver, `
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

		MERGE (s)-[:BOOKED]->(a)
		MERGE (s)-[:REVIEWED]->(a)
		`, map[string]any{
		"rows": data,
	}, neo4j.EagerResultTransformer); err != nil {
		return err
	}
	return nil
}

func MergeAppointmentGraphs(ctx context.Context, driver neo4j.Driver, data []*map[string]any) error {
	if _, err := neo4j.ExecuteQuery(ctx, driver, `
		UNWIND $rows AS row
		MERGE (a:Appointment {id:row.id})
		SET a.start_at = row.start_at,
				a.end_at = row.end_at,
				a.host_name = row.host_name,
				a.attendee_name = row.attendee_name,
				a.status = row.status
		`, map[string]any{
		"rows": data,
	}, neo4j.EagerResultTransformer); err != nil {
		return err
	}
	return nil
}

func MergeReviewGraphs(ctx context.Context, driver neo4j.Driver, data []*map[string]any) error {
	if _, err := neo4j.ExecuteQuery(ctx, driver, `
		UNWIND $rows AS row
		MERGE (r:Review {id:row.id})
		SET r.start_at = row.start_at,
				r.end_at = row.end_at,
				r.host_name = row.host_name,
				r.attendee_name = row.attendee_name,
				r.status = row.status
		`, map[string]any{
		"rows": data,
	}, neo4j.EagerResultTransformer); err != nil {
		return err
	}
	return nil
}

/* func graphsTest(ctx context.Context, driver *neo4j.Driver) error {
	result, err := neo4j.ExecuteQuery(ctx, *driver, `
	`, map[string]any{}, neo4j.EagerResultTransformer)
	if err != nil {
		return err
	}

	return nil
} */

func graphTest(ctx context.Context, driver *neo4j.Driver) {
	result, err := neo4j.ExecuteQuery(
		ctx,
		*driver,
		`
		CREATE (a:Person {name: $name})
		CREATE (b:Person {name: $friendName})
		CREATE (a)-[:KNOWS]->(b)
		`,
		map[string]any{
			"name":       "Alice",
			"friendName": "David",
		},
		neo4j.EagerResultTransformer,
	)
	if err != nil {
		log.Fatalf("Failed to execute query: %s\n", err.Error())
	}
	summary := result.Summary
	log.Printf("Created %v nodes in %+v.\n", summary.Counters().NodesCreated(), summary.ResultAvailableAfter())
}

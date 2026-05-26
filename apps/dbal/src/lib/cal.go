package lib

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v3/log"
	"github.com/hashicorp/go-retryablehttp"
)

type CalClient struct {
	c          *retryablehttp.Client
	Base       string
	AuthHeader string
	headers    map[string]any
}

type CalClientResponse struct {
	Status string `json:"status"`
	Error  any    `json:"error"`
	Data   any    `json:"data"`
}

type CalUser struct {
	Id       int    `json:"id"`
	Username string `json:"username"`
}

type CalTeam struct {
	Id     int    `json:"id"`
	Slug   string `json:"slug"`
	UserId int    `json:"user_id"`
}

type CalTeamMember struct {
	Id int `json:"id"`
}

type CalSchedule struct {
	Id           int              `json:"id"`
	Name         string           `json:"name"`
	WorkingHours []map[string]any `json:"workingHours"`
	Schedule     []map[string]any `json:"schedule"`
	Availability any              `json:"availability"`
}

type CalEventType struct {
	Id   int    `json:"id"`
	Slug string `json:"slug"`
}

type CalBookedSlot struct {
	Id                 int                  `json:"id"`
	Uid                string               `json:"uid"`
	Duration           int                  `json:"duration"`
	Title              string               `json:"title"`
	Description        string               `json:"description"`
	Status             string               `json:"status"`
	Metadata           *map[string]any      `json:"metadata"`
	MeetingUrl         string               `json:"meetingUrl"`
	CancellationReason string               `json:"cancellationReason"`
	CancelledByEmail   string               `json:"cancelledByEmail"`
	Hosts              []*CalBookedSlotHost `json:"hosts"`
}
type CalBookedSlotHost struct {
	Id           int    `json:"id"`
	Name         string `json:"name"`
	Email        string `json:"email"`
	DisplayEmail string `json:"DisplayEmail"`
	Username     string `json:"username"`
	TimeZone     string `json:"timeZone"`
}

type CalAvailableSlots map[string][]*CalAvailableTimeSlots
type CalAvailableTimeSlots struct {
	Start string `json:"start"`
}
type MappedTutorSlots struct {
	Id    string             `json:"id"`
	Slots *CalAvailableSlots `json:"slots"`
}

func NewCalClient() *CalClient {
	cc := &CalClient{
		c:       retryablehttp.NewClient(),
		Base:    os.Getenv("CAL_API_URL"),
		headers: map[string]any{},
	}
	return cc
}

func NewCalClientWithTLS(c *tls.Config) *CalClient {
	transport := &http.Transport{
		TLSClientConfig: c,
	}
	client := retryablehttp.NewClient()
	client.HTTPClient = &http.Client{
		Transport: transport,
		Timeout:   10 * time.Second,
	}
	client.RetryMax = 3
	cc := NewCalClient()
	cc.c = client
	return cc
}

func WithBaseCalClient(base string) *CalClient {
	cc := NewCalClient()
	cc.Base = base
	return cc
}

func (cc *CalClient) SetHeader(ctx context.Context, key string, value string) {
	cc.headers[key] = value
}

func (cc *CalClient) CreateUser(ctx context.Context, body map[string]any) (*CalUser, error) {
	log.Infof("[CreateUser] body: %v", body)
	jsonBody, _ := json.Marshal(body)
	orgId, _ := strconv.ParseInt(os.Getenv("CAL_ORG_ID"), 10, 32)
	url := fmt.Sprintf("%s/organizations/%d/users", cc.Base, orgId)
	log.Debugf("[cal] url: %s", url)
	req, err := retryablehttp.NewRequest("POST", url, bytes.NewBuffer(jsonBody))
	if err != nil {
		return nil, err
	}

	req = cc.setHeaders(req)
	res, err := cc.c.Do(req)
	log.Infof("[CreateUser] server returned response: %d %s", res.StatusCode, res.Status)
	if err != nil {
		return nil, err
	}
	resBytes := make([]byte, 0)
	resBytes, err = io.ReadAll(res.Body)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	resJson := new(CalClientResponse)
	if err := json.Unmarshal(resBytes, resJson); err != nil {
		return nil, err
	}
	user := new(CalUser)
	userResData, err := json.Marshal(resJson.Data)
	if err != nil {
		log.Error("could not marshal into userResData")
		return nil, errors.New("worker encountered an error")
	}
	if err := json.Unmarshal(userResData, user); err != nil {
		return nil, err
	}
	log.Infof("[user]: %d %v", user.Id, user)
	return user, nil
}

func (cc *CalClient) CreateTeam(ctx context.Context, userId int, name string, slug string, tz *string) (*CalTeam, error) {
	jsonBody := map[string]any{
		"name":     name,
		"slug":     slug,
		"timeZone": tz,
	}
	bytesBody, _ := json.Marshal(jsonBody)
	orgId, _ := strconv.ParseInt(os.Getenv("CAL_ORG_ID"), 10, 32)
	url := fmt.Sprintf("%s/organizations/%d/teams", cc.Base, orgId)
	log.Debugf("[cal] url: %s", url)
	req, err := retryablehttp.NewRequest("POST", url, bytes.NewBuffer(bytesBody))
	if err != nil {
		return nil, err
	}
	req = cc.setHeaders(req)
	res, err := cc.c.Do(req)
	log.Infof("[CreateTeam] server returned response: %d %s", res.StatusCode, res.Status)
	if err != nil {
		return nil, err
	}
	resBytes := make([]byte, 0)
	resBytes, err = io.ReadAll(res.Body)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	resJson := new(CalClientResponse)
	if err := json.Unmarshal(resBytes, resJson); err != nil {
		return nil, err
	}
	team := new(CalTeam)
	teamResData, err := json.Marshal(resJson.Data)
	if err != nil {
		return nil, errors.New("worker encountered an error")
	}
	if err := json.Unmarshal(teamResData, team); err != nil {
		return nil, err
	}
	log.Infof("[team]: %d %v", team.Id, team)
	return team, nil
}

func (cc *CalClient) AddTeamMember(ctx context.Context, teamId int, userId int, accepted bool, role string) (*CalTeamMember, error) {
	jsonBody := map[string]any{
		"userId":   userId,
		"accepted": accepted,
		"role":     role,
	}
	bytesBody, _ := json.Marshal(jsonBody)
	orgId, _ := strconv.ParseInt(os.Getenv("CAL_ORG_ID"), 10, 32)
	url := fmt.Sprintf("%s/organizations/%d/teams/%d/memberships", cc.Base, orgId, teamId)
	log.Debugf("[cal] url: %s", url)
	req, err := retryablehttp.NewRequest("POST", url, bytes.NewBuffer(bytesBody))
	if err != nil {
		return nil, err
	}
	req = cc.setHeaders(req)
	res, err := cc.c.Do(req)
	log.Infof("[AddTeamMember] server returned response: %d %s", res.StatusCode, res.Status)
	if err != nil {
		log.Infof("[AddTeamMember] server returned error: %d %s", res.StatusCode, res.Status)
		return nil, errors.New("worker encountered an error")
	}
	resBytes := make([]byte, 0)
	resBytes, err = io.ReadAll(res.Body)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	resJson := new(CalClientResponse)
	if err := json.Unmarshal(resBytes, resJson); err != nil {
		return nil, err
	}
	member := new(CalTeamMember)
	memberResData, err := json.Marshal(resJson.Data)
	if err != nil {
		return nil, errors.New("worker encountered an error")
	}
	if err := json.Unmarshal(memberResData, member); err != nil {
		return nil, err
	}
	log.Infof("[member]: %d %v", member.Id, member)
	return member, nil
}

func (cc *CalClient) GetTeamSchedules(ctx context.Context, teamId int, eventTypeId int) (*CalSchedule, error) {
	orgId, _ := strconv.ParseInt(os.Getenv("CAL_ORG_ID"), 10, 32)
	url := fmt.Sprintf("%s/organizations/%d/teams/%d/schedules?eventTypeId=%d", cc.Base, orgId, teamId, eventTypeId)
	log.Debugf("[cal] url: %s", url)
	req, err := retryablehttp.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	req = cc.setHeaders(req)
	res, err := cc.c.Do(req)
	log.Infof("[GetTeamSchedules] server returned response: %d %s", res.StatusCode, res.Status)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	resBody, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, err
	}
	log.Infof("[GetTeamSchedules] response: %s", string(resBody))
	resJson := new(CalClientResponse)
	if err := json.Unmarshal(resBody, resJson); err != nil {
		return nil, err
	}
	log.Infof("[GetTeamSchedules] res json: %v", resJson)
	scheds := make([]CalSchedule, 0)
	schedsResData, err := json.Marshal(resJson.Data)
	if err != nil {
		return nil, errors.New("worker encountered an error")
	}
	if err := json.Unmarshal(schedsResData, &scheds); err != nil {
		return nil, err
	}
	log.Infof("[scheds]: %d %v", len(scheds), scheds)
	if len(scheds) == 0 {
		return nil, nil //errors.New("team schedules returned empty response")
	}
	return &scheds[0], nil
}

func (cc *CalClient) GetDefaultSchedule(ctx context.Context) (*CalSchedule, error) {
	url := fmt.Sprintf("%s/schedules/default", cc.Base)
	log.Debugf("[cal] url: %s", url)
	req, err := retryablehttp.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	req = cc.setHeaders(req)
	res, err := cc.c.Do(req)
	log.Infof("[CreateUser] server returned response: %d %s", res.StatusCode, res.Status)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	resBody, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, err
	}
	log.Infof("[GetDefaultSchedule] response: %s", string(resBody))
	resJson := new(CalClientResponse)
	if err := json.Unmarshal(resBody, resJson); err != nil {
		return nil, err
	}
	sched := new(CalSchedule)
	schedResData, err := json.Marshal(resJson.Data)
	if err != nil {
		log.Error("could not marshal into schedResData")
		return nil, errors.New("worker encountered an error")
	}
	if err := json.Unmarshal(schedResData, sched); err != nil {
		return nil, err
	}
	log.Infof("default schedule: %d", sched.Id)
	return sched, nil
}

func (cc *CalClient) CreateScheduleForUser(ctx context.Context, userId int, name string, timeZone string, isDefault bool) (*CalSchedule, error) {
	jsonBody := map[string]any{
		"name":      name,
		"isDefault": isDefault,
		"timeZone":  timeZone,
	}
	bytesBody, _ := json.Marshal(jsonBody)
	orgId, _ := strconv.ParseInt(os.Getenv("CAL_ORG_ID"), 10, 32)
	url := fmt.Sprintf("%s/organizations/%d/users/%d/schedules", cc.Base, orgId, userId)
	log.Debugf("[cal] url: %s", url)
	req, err := retryablehttp.NewRequest("POST", url, bytes.NewBuffer(bytesBody))
	if err != nil {
		return nil, err
	}
	req = cc.setHeaders(req)
	res, err := cc.c.Do(req)
	log.Infof("[CreateScheduleForUser] server returned response: %d %s", res.StatusCode, res.Status)
	if err != nil {
		return nil, err
	}
	resBytes := make([]byte, 0)
	resBytes, err = io.ReadAll(res.Body)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	resJson := new(CalClientResponse)
	if err := json.Unmarshal(resBytes, resJson); err != nil {
		return nil, err
	}
	schedule := new(CalSchedule)
	schedResData, err := json.Marshal(resJson.Data)
	if err != nil {
		return nil, errors.New("worker encountered an error")
	}
	if err := json.Unmarshal(schedResData, schedule); err != nil {
		return nil, err
	}
	log.Infof("[schedule]: %d %v", schedule.Id, schedule)
	return schedule, nil
}

func (cc *CalClient) CreateEventTypeForUser(ctx context.Context, userId int, teamId int, title string, slug string, scheduleId int) (*CalEventType, error) {
	jsonBody := map[string]any{
		"lengthInMinutes":    30,
		"title":              title,
		"slug":               slug,
		"schedulingType":     "roundRobin",
		"disableGuests":      true,
		"hideOrganizerEmail": true,
		"disableCancelling": map[string]any{
			"disabled":      false,
			"minutesBefore": 30,
		},
		"disableRescheduling": map[string]any{
			"disabled": true,
		},
		"scheduleId": scheduleId,
		"hosts": []map[string]any{
			{
				"userId": userId,
			},
		},
	}
	bytesBody, _ := json.Marshal(jsonBody)
	orgId, _ := strconv.ParseInt(os.Getenv("CAL_ORG_ID"), 10, 32)
	url := fmt.Sprintf("%s/organizations/%d/teams/%d/event-types", cc.Base, orgId, teamId)
	log.Debugf("[cal] url: %s", url)
	req, err := retryablehttp.NewRequest("POST", url, bytes.NewBuffer(bytesBody))
	if err != nil {
		return nil, err
	}
	req = cc.setHeaders(req)
	res, err := cc.c.Do(req)
	log.Infof("[CreateEventTypeForUser] server returned response: %d %s", res.StatusCode, res.Status)
	if err != nil {
		return nil, err
	}
	resBytes := make([]byte, 0)
	resBytes, err = io.ReadAll(res.Body)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	resJson := new(CalClientResponse)
	if err := json.Unmarshal(resBytes, resJson); err != nil {
		return nil, err
	}
	eventType := new(CalEventType)
	eventResData, err := json.Marshal(resJson.Data)
	if err != nil {
		return nil, errors.New("worker encountered an error")
	}
	if err := json.Unmarshal(eventResData, eventType); err != nil {
		return nil, err
	}
	log.Infof("[eventType]: %d %v", eventType.Id, eventType)
	return eventType, nil
}

func (cc *CalClient) BookSlot(ctx context.Context, start string, eventTypeSlug string, teamSlug string, attendee map[string]any) (*CalBookedSlot, error) {
	url := fmt.Sprintf("%s/bookings", cc.Base)
	body := map[string]any{
		"organizationSlug": os.Getenv("CAL_ORG_SLUG"),
		"start":            start,
		"eventTypeSlug":    eventTypeSlug,
		"teamSlug":         teamSlug,
		"attendee":         attendee,
		"location": map[string]any{
			"type":        "integration",
			"integration": "cal-video",
		},
	}
	log.Infof("Cal Request Body: %v", body)
	rawBody, _ := json.Marshal(body)
	req, err := retryablehttp.NewRequest("POST", url, rawBody)
	if err != nil {
		return nil, err
	}
	cc.SetHeader(ctx, "cal-api-version", "2024-08-13")
	req = cc.setHeaders(req)
	res, err := cc.c.Do(req)
	if err != nil {
		return nil, err
	}
	resBytes := make([]byte, 0)
	resBytes, err = io.ReadAll(res.Body)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	var resJson CalClientResponse
	if err := json.Unmarshal(resBytes, &resJson); err != nil {
		return nil, err
	}
	log.Errorf("Response from cal ---------------------------> %v", resJson)
	var bookedSlot CalBookedSlot
	bookedResData, err := json.Marshal(resJson.Data)
	if err != nil {
		return nil, errors.New("error serializing json response")
	}
	if err := json.Unmarshal(bookedResData, &bookedSlot); err != nil {
		return nil, err
	}

	return &bookedSlot, nil
}

type jobInternal struct {
	id            string
	baseURL       string
	teamSlug      string
	eventTypeSlug string
}
type resultInternal struct {
	URL        string
	StatusCode int
	Err        error
	j          jobInternal
	r          CalAvailableSlots
}

func (cc *CalClient) GetAvailableSlots(ctx context.Context, tz string, start string, end string, teamSlug string, eventTypeSlug string) error {
	apiUrl, _ := url.JoinPath(cc.Base, "slots")
	calUrl, _ := url.Parse(apiUrl)
	q := calUrl.Query()
	q.Set("organizationSlug", os.Getenv("CAL_ORG_SLUG"))
	q.Set("timeZone", tz)
	q.Set("start", start)
	q.Set("end", end)
	q.Set("teamSlug", teamSlug)
	q.Set("eventTypeSlug", eventTypeSlug)
	calUrl.RawQuery = q.Encode()

	req, err := retryablehttp.NewRequest("GET", calUrl.String(), nil)
	if err != nil {
		return err
	}

	res, err := cc.c.Do(req)
	if err != nil {
		return err
	}
	res.Body.Close()

	return nil
}

func (cc *CalClient) BatchGetAvailableSlots(globalCtx context.Context, tz string, start string, end string, teamAndEventTypeSlugs map[string][]string) (map[string]*MappedTutorSlots, error) {
	rand.New(rand.NewSource(time.Now().UnixMicro()))

	jobsList := make([]jobInternal, 0, len(teamAndEventTypeSlugs))

	for id, teamAndEventTypeSlug := range teamAndEventTypeSlugs {
		base, _ := url.Parse(cc.Base)
		base = base.JoinPath("slots")
		ji := jobInternal{
			id:            id,
			baseURL:       base.String(),
			teamSlug:      teamAndEventTypeSlug[0],
			eventTypeSlug: teamAndEventTypeSlug[1],
		}
		log.Infof("[JOB]: %#v", ji)
		jobsList = append(jobsList, ji)
	}

	maxWorkers := 5
	batchSize := 10 // int(math.Min(float64(len(teamAndEventTypeSlugs)), 10))
	// jobs := make(chan jobInternal)
	results := make(chan resultInternal, len(jobsList))

	cc.SetHeader(globalCtx, "cal-api-version", "2024-09-04")
	cc.c.HTTPClient.Timeout = 0
	cc.c.RetryMax = 3
	cc.c.RetryWaitMax = 2 * time.Second
	cc.c.RetryWaitMin = 500 * time.Millisecond

	globalCtx, cancel := context.WithTimeout(globalCtx, 60*time.Minute)
	defer cancel()

	log.Infof("Running %d workers", batchSize)
	// mapped := make([]*MappedTutorSlots, 0, len(results))
	mapped := make(map[string]*MappedTutorSlots, 0)
	for i := 0; i < len(jobsList); i += batchSize {
		last := min(i+batchSize, len(jobsList))
		batch := jobsList[i:last]

		batchCtx, batchCancel := context.WithTimeout(globalCtx, 60*time.Second)
		// defer batchCancel()

		log.Info("Running batch...")

		jobCh := make(chan jobInternal)
		for range maxWorkers {
			go func() {
				for job := range jobCh {
					parsedURL, err := url.Parse(job.baseURL)
					if err != nil {
						log.Errorf("Error parsing url (%s): %v", job.baseURL, err)
						results <- resultInternal{URL: job.baseURL, Err: err}
						continue
					}

					// uu := parsedURL.JoinPath("slots")
					q := parsedURL.Query()
					q.Set("organizationSlug", os.Getenv("CAL_ORG_SLUG"))
					q.Set("timeZone", tz)
					q.Set("start", start)
					q.Set("end", end)
					q.Set("teamSlug", job.teamSlug)
					q.Set("eventTypeSlug", job.eventTypeSlug)
					parsedURL.RawQuery = q.Encode()

					reqCtx, reqCancel := context.WithTimeout(batchCtx, 30*time.Second)
					req, err := retryablehttp.NewRequestWithContext(reqCtx, "GET", parsedURL.String(), nil)
					if err != nil {
						log.Errorf("[CAL] there wan an error: %v", err)
						results <- resultInternal{URL: parsedURL.String(), Err: err, StatusCode: 400, j: job}
						reqCancel()
						continue
					}

					req = cc.setHeaders(req)
					res, err := cc.c.Do(req)
					defer reqCancel()
					if err != nil {
						log.Errorf("[CAL] there wan an error: %v", err)
						results <- resultInternal{URL: parsedURL.String(), Err: err, StatusCode: 400, j: job}
						continue
					}

					func() {
						defer res.Body.Close()
						resBytes, err := io.ReadAll(res.Body)
						reqCancel()
						if err != nil {
							log.Errorf("[CAL] there wan an error: %v", err)
							results <- resultInternal{URL: parsedURL.String(), Err: err, StatusCode: 400, j: job}
							return
						}

						var resJson CalClientResponse
						if err := json.Unmarshal(resBytes, &resJson); err != nil {
							log.Errorf("[CAL] there wan an error: %v", err)
							results <- resultInternal{URL: parsedURL.String(), Err: err, StatusCode: 400, j: job}
							return
						}

						log.Infof("Response from cal ---------------------------> %#v", resJson)
						var resData CalAvailableSlots
						marsh, _ := json.MarshalIndent(resJson.Data, "", "  ")
						if err := json.Unmarshal(marsh, &resData); err != nil {
							log.Errorf("[CAL] there wan an error: %v", err)
							results <- resultInternal{URL: parsedURL.String(), Err: err, StatusCode: 400, j: job}
							return
						}

						results <- resultInternal{
							URL:        parsedURL.String(),
							StatusCode: res.StatusCode,
							j:          job,
							r:          resData,
						}

					}()
				}
			}()
		}
		for _, job := range batch {
			jobCh <- job
		}
		close(jobCh)

		for range batch {
			res := <-results
			if res.Err != nil {
				log.Errorf("[ERROR]: %v", res.Err)
			} else {
				log.Infof("SUCCESS")
				res := &MappedTutorSlots{
					Id:    res.j.id,
					Slots: &res.r,
				}
				mapped[res.Id] = res
				// mapped = append(mapped, res)
			}
		}
		batchCancel()
	}
	close(results)

	/* for result := range results {
		res := &MappedTutorSlots{
			Id:    result.j.id,
			Slots: &result.r,
		}
		mapped = append(mapped, res)
	} */
	return mapped, nil

	/* uu, _ := url.Parse(cc.Base)
	uu = uu.JoinPath("slots")
	qq := uu.Query()
	qq.Set("organizationSlug", os.Getenv("CAL_ORG_SLUG"))
	qq.Set("timeZone", tz)
	qq.Set("start", start)
	qq.Set("end", end)

	for _, eventTypeSlug := range teamAndEventTypeSlugs {
		qq.Set("teamSlug", eventTypeSlug[0])
		qq.Set("eventTypeSlug", eventTypeSlug[1])
		uu.RawQuery = qq.Encode()
	}
	cc.SetHeader(ctx, "cal-api-version", "2024-09-04")
	req, err := retryablehttp.NewRequestWithContext(ctx, "GET", uu.String(), nil)
	if err != nil {
		log.Errorf("[CalClient] encountered an error while creating request: %v", err)
		return nil, err
	}
	req = cc.setHeaders(req)

	res, err := cc.c.Do(req)
	if err != nil {
		return nil, err
	}
	resBytes := make([]byte, 0)
	resBytes, err = io.ReadAll(res.Body)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	var resJson CalClientResponse
	if err := json.Unmarshal(resBytes, &resJson); err != nil {
		return nil, err
	}
	log.Infof("Response from cal ---------------------------> %#v", resJson)
	resData := new(CalAvailableSlots)
	marsh, _ := json.Marshal(resJson.Data)
	if err := json.Unmarshal(marsh, &resData); err != nil {
		return nil, err
	}

	return resData, nil */
}

func (cc *CalClient) setHeaders(req *retryablehttp.Request) *retryablehttp.Request {
	calApiKey := os.Getenv("CAL_API_KEY")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", calApiKey))

	for k, v := range cc.headers {
		req.Header.Set(k, v.(string))
	}

	return req
}

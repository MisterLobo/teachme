package lib

import (
	"log"

	"github.com/go-co-op/gocron/v2"
)

var sched gocron.Scheduler

func GetScheduler() gocron.Scheduler {
	if sched != nil {
		return sched
	}
	_sched, err := gocron.NewScheduler()
	if err != nil {
		log.Printf("Could not initialize scheduler: %v", err)
	}
	sched = _sched
	return _sched
}

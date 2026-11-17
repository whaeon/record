package calendar

import (
	"fmt"
	"time"
)

const layout = "2006-01-02"

const (
	MinDate = "2020-01-01"
	MaxDate = "2028-12-31"
)

type Day struct {
	Date         string `json:"date"`
	IsTradingDay bool   `json:"is_trading_day"`
}

func parseISO(iso string) (time.Time, error) {
	t, err := time.ParseInLocation(layout, iso, time.Local)
	if err != nil || t.Format(layout) != iso {
		return time.Time{}, fmt.Errorf("invalid date")
	}
	return t, nil
}

func IsTradingDay(iso string) bool {
	t, err := parseISO(iso)
	if err != nil {
		return false
	}
	wd := t.Weekday()
	if wd == time.Saturday || wd == time.Sunday {
		return false
	}
	_, closed := weekdayClosures[iso]
	return !closed
}

func Range(from, to string) ([]Day, error) {
	if from == "" {
		from = MinDate
	}
	if to == "" {
		to = MaxDate
	}
	start, err := parseISO(from)
	if err != nil {
		return nil, err
	}
	end, err := parseISO(to)
	if err != nil {
		return nil, err
	}
	if end.Before(start) {
		return nil, fmt.Errorf("invalid date range")
	}
	n := int(end.Sub(start).Hours()/24) + 1
	out := make([]Day, 0, n)
	for d := start; !d.After(end); d = d.AddDate(0, 0, 1) {
		iso := d.Format(layout)
		out = append(out, Day{Date: iso, IsTradingDay: IsTradingDay(iso)})
	}
	return out, nil
}

package logs

import "log/slog"

func Info(msg string, args ...any) {
	slog.Info(msg, args...)
}

